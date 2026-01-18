import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Utils } from "./utils.js";
import { SceneObject } from "./sceneObject.js";
import { Names } from "./names.js";
import { debugPrint, raiseCriticalError } from "./runtime.js";
import { Paths } from "./paths.js";
import { SceneObjectCommandTeleport } from "./sceneObjectCommandTeleport.js";
import { SceneObjectCommandIdle } from "./sceneObjectCommandIdle.js";
import { SceneObjectCommandTranslate } from "./sceneObjectCommandTranslate.js";
import { ObjectsPickerController } from "./objectsPickerController.js";
import { AnimationContainer } from "./animationContainer.js";
import { GameVector3 } from "./gameVector3.js";

export class SceneController {
    constructor(canvas, physicsEnabled, gameSettings, flyMode = false) {
        this.userObjectName = "";
        this.stepCounter = 0;
        this.texturesToLoad = [];
        this.textureLoader = new THREE.TextureLoader();
        this.clock = new THREE.Clock();
        this.animationContainers = {};
        this.objects = {};
        this.objectsUUIDs = {};
        this.commands = {};
        this.canMoveForward = false;
        this.canMoveBackward = false;
        this.canMoveLeft = false;
        this.canMoveRight = false;
        this.wireframeRenderer = false;
        this.flyMode = false;
        this.delegate = null;
        this.highQuality = false;
        this.shadowsEnabled = true;
        this.physicsEnabled = physicsEnabled;
        this.gameSettings = gameSettings;
        this.flyMode = flyMode;
        this.loadingPlaceholderTexture = this.textureLoader.load(Paths.texturePath("com.demensdeum.loading"));
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.windowWidth() / this.windowHeight(), 0.1, 1000);
        const cameraSceneObject = new SceneObject(Names.Camera, Names.Camera, "NONE", "NONE", this.camera, true, null, new Date().getTime());
        this.objects[Names.Camera] = cameraSceneObject;

        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.setSize(this.windowWidth(), this.windowHeight());

        if (this.highQuality) {
            this.renderer.setPixelRatio(window.devicePixelRatio);
        }
        if (this.shadowsEnabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8;
        this.objectsPickerController = new ObjectsPickerController(this.renderer, this.camera, this);
        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();
        document.body.appendChild(this.renderer.domElement);
        const camera = this.camera;
        const renderer = this.renderer;
        const self = this;
        const onWindowResize = () => {
            debugPrint("onWindowResize");
            camera.aspect = self.windowWidth() / self.windowHeight();
            camera.updateProjectionMatrix();
            camera.aspect = self.windowWidth() / self.windowHeight();
            camera.updateProjectionMatrix();
            renderer.setSize(self.windowWidth(), self.windowHeight());

        };
        window.addEventListener("resize", onWindowResize, false);
        this.debugControls = new OrbitControls(camera, renderer.domElement);
        debugPrint(this.debugControls);
    }
    lockOrbitControls() {
        this.debugControls.maxPolarAngle = Math.PI / 2 - Utils.degreesToRadians(50);
        this.debugControls.minDistance = 2.8;
        this.debugControls.maxDistance = 3.4;
        this.debugControls.enablePan = false;
        this.debugControls.enableDamping = true;
        this.debugControls.dampingFactor = 0.225;
    }
    setFog(color = 0xcccccc, near = 10, far = 30) {
        this.scene.fog = new THREE.Fog(color, near, far);
    }
    windowWidth() {
        debugPrint("windowWidth: " + window.innerWidth);
        return window.innerWidth;
    }
    windowHeight() {
        debugPrint("windowHeight: " + window.innerHeight);
        return window.innerHeight;
    }
    decorControlsDidRequestCommandWithName(_, commandName) {
        if (commandName in this.commands) {
            return this.commands[commandName];
        }
        else {
            raiseCriticalError("SceneController DecorControlsDataSource Error: No command with name " + commandName);
            return new SceneObjectCommandIdle("Error Placeholder", 0);
        }
    }
    isObjectWithNameOlderThan(name, date) {
        const objectChangeDate = this.sceneObject(name).changeDate;
        if (name.startsWith("Udod")) {
            debugPrint(objectChangeDate + " < " + date);
        }
        return objectChangeDate < date;
    }
    controlsQuaternionForObject(_, objectName) {
        const sceneObject = this.sceneObject(objectName);
        return sceneObject.threeObject.quaternion;
    }
    controlsRequireJump(_, objectName) {
        const sceneObject = this.sceneObject(objectName);
    }
    controlsRequireObjectTranslate(_, objectName, x, y, z) {
        this.translateObject(objectName, x, y, z);
    }
    controlsRequireObjectRotation(_, objectName, euler) {
        const sceneObject = this.sceneObject(objectName);
        sceneObject.threeObject.quaternion.setFromEuler(euler);
        sceneObject.changeDate = Utils.timestamp();
    }
    controlsCanMoveLeftObject(_, __) {
        return this.canMoveLeft;
    }
    controlsCanMoveRightObject(_, __) {
        return this.canMoveRight;
    }
    controlsCanMoveForwardObject(_, __) {
        return this.canMoveForward;
    }
    controlsCanMoveBackwardObject(_, __) {
        return this.canMoveBackward;
    }
    weatherControllerDidRequireToAddInstancedMeshToScene(_, instancedMesh) {
        this.scene.add(instancedMesh);
    }
    addCommand(name, type, time, x, y, z, rX, rY, rZ, nextCommandName) {
        const position = new THREE.Vector3(x, y, z);
        const rotation = new THREE.Vector3(rX, rY, rZ);
        if (type == "teleport") {
            const command = new SceneObjectCommandTeleport(name, time, position, rotation, nextCommandName);
            this.commands[name] = command;
            return command;
        }
        else if (type == "translate") {
            const translate = position;
            const command = new SceneObjectCommandTranslate(name, time, translate, nextCommandName);
            this.commands[name] = command;
            return command;
        }
        raiseCriticalError("Unknown type for command parser: " + type);
        return new SceneObjectCommandIdle(name, time);
    }
    commandWithName(name) {
        return this.commands[name];
    }

    addLight() {
        if (this.shadowsEnabled == false) {
            debugPrint("Can't add light, because shadows are disabled");
            return;
        }
        const light = new THREE.DirectionalLight(0xffffff, 7);
        light.position.set(1, 2, 1);
        if (this.shadowsEnabled) {
            light.castShadow = true;
        }
        this.scene.add(light);
    }

    saveGameSettings() {
        this.gameSettings.save();
    }
    step() {
        this.stepCounter += 1;
        if (this.gameSettings.frameDelay != 0 && Math.floor(this.stepCounter % this.gameSettings.frameDelay) != 0) {
            return;
        }
        const delta = this.clock.getDelta();
        this.controlsStep(delta);
        this.weatherController?.step(delta);
        this.animationsStep(delta);
        this.render();
    }
    controlsStep(delta) {
        Object.keys(this.objects).forEach(key => {
            const sceneObject = this.objects[key];
            const controls = sceneObject.controls;
            controls?.step(delta);
        });
    }

    animationsStep(delta) {
        Object.keys(this.animationContainers).forEach((animationContainerName) => {
            const animationContainer = this.animationContainers[animationContainerName];
            if (animationContainer.animationMixer) {
                animationContainer.animationMixer.update(delta);
            }
            else {
                const object = animationContainer.sceneObject;
                const model = object.threeObject;
                const animationMixer = new THREE.AnimationMixer(model);
                const animation = object.animations.find((e) => { return e.name == animationContainer.animationName; });
                if (animation == null) {
                    debugPrint(`No animation with name: ${animationContainer.animationName}`);
                }
                else {
                    animationMixer.clipAction(animation).play();
                    animationContainer.animationMixer = animationMixer;
                }
            }
        });
    }

    render() {
        this.renderer.render(this.scene, this.camera);
        this.debugControls.update();
    }

    addSceneObject(sceneObject) {
        const alreadyAddedObject = sceneObject.name in this.objects;
        if (alreadyAddedObject) {
            debugger;
            raiseCriticalError("Duplicate name for object!!!:" + sceneObject.name);
            return;
        }
        this.objectsUUIDs[sceneObject.uuid] = sceneObject;
        this.objects[sceneObject.name] = sceneObject;
        this.scene.add(sceneObject.threeObject);
        this.objectsPickerController.addSceneObject(sceneObject);
    }

    serializedSceneObjects() {
        const keys = Object.keys(this.objects);
        const output = keys.map(key => ({ [key]: this.objects[key].serialize() }));
        const result = output.reduce((acc, obj) => ({ ...acc, ...obj }), {});
        return result;
    }
    serializeSceneObject(name) {
        const output = this.objects[name];
        output.serialize();
        return output;
    }

    removeAllSceneObjectsExceptCamera() {
        Object.keys(this.objects).map(k => {
            if (k == Names.Camera) {
                return;
            }
            this.removeObjectWithName(k);
        });
        this.scene.background = null;
        this.currentSkyboxName = null;
        Object.keys(this.objects).map(k => {
            delete this.commands[k];
        });

        this.scene.background = null;
    }
    removeObjectWithName(name) {
        const sceneObject = this.objects[name];
        if (sceneObject == null) {
            raiseCriticalError(`removeObjectWithName: ${name} is null! WTF1!!`);
            debugger;
            return;
        }
        this.objectsPickerController.removeSceneObject(sceneObject);
        this.scene.remove(sceneObject.threeObject);
        delete this.objects[name];
        delete this.objectsUUIDs[sceneObject.uuid];
    }
    switchSkyboxIfNeeded(args) {
        if (this.currentSkyboxName == args.name) {
            return;
        }
        if (args.environmentOnly == false) {
            const urls = [
                `${Paths.assetsDirectory}/${Paths.skyboxLeftTexturePath(args.name)}${Paths.textureSuffix}${Paths.textureExtension}`,
                `${Paths.assetsDirectory}/${Paths.skyboxRightTexturePath(args.name)}${Paths.textureSuffix}${Paths.textureExtension}`,
                `${Paths.assetsDirectory}/${Paths.skyboxTopTexturePath(args.name)}${Paths.textureSuffix}${Paths.textureExtension}`,
                `${Paths.assetsDirectory}/${Paths.skyboxBottomTexturePath(args.name)}${Paths.textureSuffix}${Paths.textureExtension}`,
                `${Paths.assetsDirectory}/${Paths.skyboxBackTexturePath(args.name)}${Paths.textureSuffix}${Paths.textureExtension}`,
                `${Paths.assetsDirectory}/${Paths.skyboxFrontTexturePath(args.name)}${Paths.textureSuffix}${Paths.textureExtension}`
            ];
            const textureCube = new THREE.CubeTextureLoader().load(urls);
            this.scene.background = textureCube;
        }
        const pmremGenerator = this.pmremGenerator;
        new RGBELoader()
            .setDataType(THREE.HalfFloatType)
            .setPath("./" + Paths.assetsDirectory + "/")
            .load(Paths.environmentPath(args.name), (texture) => {
                var environmentMap = pmremGenerator.fromEquirectangular(texture).texture;
                this.scene.environment = environmentMap;
                texture.dispose();
                pmremGenerator.dispose();
            });
        this.currentSkyboxName = args.name;
    }
    setBackgroundColor(red, green, blue) {
        this.scene.background = new THREE.Color(red, green, blue);
    }
    addModelAt(name, modelName, x, y, z, rX, rY, rZ, isMovable, controls, boxSize = 1.0, successCallback = () => { }, color = 0xFFFFFF, transparent = false, opacity = 1.0) {
        debugPrint("addModelAt");
        const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const boxMaterial = new THREE.MeshStandardMaterial({
            color: color,
            map: this.loadingPlaceholderTexture,
            transparent: true,
            opacity: 0.7
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.x = x;
        box.position.y = y;
        box.position.z = z;
        box.rotation.x = rX;
        box.rotation.y = rY;
        box.rotation.z = rZ;
        const sceneController = this;
        const sceneObject = new SceneObject(name, "Model", "NONE", modelName, box, isMovable, controls, new Date().getTime());
        sceneController.addSceneObject(sceneObject);
        const modelLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('build/three/examples/jsm/libs/draco/');
        modelLoader.setDRACOLoader(dracoLoader);
        const modelPath = Paths.modelPath(modelName);
        const self = this;
        const onModelLoaded = (container) => {
            if ((sceneObject.uuid in self.objectsUUIDs) == false) {
                debugPrint(`Don't add model for object name ${sceneObject.name}, because it's removed`);
                return;
            }
            const model = container.scene;
            self.scene.add(model);
            model.position.x = box.position.x;
            model.position.y = box.position.y;
            model.position.z = box.position.z;
            model.rotation.x = box.rotation.x;
            model.rotation.y = box.rotation.y;
            model.rotation.z = box.rotation.z;
            self.scene.remove(box);
            sceneObject.threeObject = model;
            sceneObject.animations = container.animations;
            model.traverse((entity) => {
                if (entity.isMesh) {
                    const mesh = entity;
                    if (self.shadowsEnabled) {
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                    }
                    if (transparent) {
                        mesh.material.transparent = true;
                        mesh.material.opacity = opacity;
                    }
                    sceneObject.meshes.push(mesh);
                    if (sceneController.wireframeRenderer) {
                        mesh.material.wireframe = true;
                        mesh.material.needsUpdate = true;
                    }
                }
            });
            if (self.shadowsEnabled) {
                model.castShadow = true;
                model.receiveShadow = true;
            }
            debugPrint(`Model load success: ${modelPath}`);
            successCallback();
        };
        const onModelLoadingProgess = (_) => {
        };
        const onModelLoadError = (error) => {
            debugger;
            debugPrint(`Model loading error: ${error}`);
        };
        modelLoader.load(modelPath, onModelLoaded, onModelLoadingProgess, onModelLoadError);
    }
    objectPlayAnimation(objectName, animationName) {
        const animationKey = `${objectName}_${animationName}`;
        if (animationKey in this.animationContainers) {
            debugPrint(`animation already playing: ${animationName}`);
            return;
        }
        this.animationContainers[animationKey] = new AnimationContainer(this.sceneObject(objectName), animationName);
    }
    objectStopAnimation(objectName, animationName) {
        const animationKey = `${objectName}_${animationName}`;
        if (animationKey in this.animationContainers) {
            delete this.animationContainers[animationKey];
        }
    }
    addBoxAt(name, x, y, z, textureName = "com.demensdeum.failback", size = 1.0, color = 0xFFFFFF, transparent = false, opacity = 1.0) {
        debugPrint("addBoxAt: " + x + " " + y + " " + z);
        const texturePath = Paths.texturePath(textureName);
        const boxGeometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            map: this.loadingPlaceholderTexture,
            transparent: transparent,
            opacity: opacity
        });
        const newMaterial = new THREE.MeshStandardMaterial({
            color: color,
            map: this.textureLoader.load(texturePath, (texture) => {
                material.map = texture;
                material.needsUpdate;
            }, (error) => {
                console.log(`WUT!!!! Error: ${error}`);
            }),
            transparent: true,
            opacity: opacity
        });
        this.texturesToLoad.push(newMaterial);
        const box = new THREE.Mesh(boxGeometry, material);
        box.position.x = x;
        box.position.y = y;
        box.position.z = z;
        const sceneObject = new SceneObject(name, "Box", textureName, "NONE", box, false, null, new Date().getTime());
        sceneObject.meshes.push(box);
        this.addSceneObject(sceneObject);
    }
    addPlaneAt(name, x, y, z, width, height, textureName, color = 0xFFFFFF, resetDepthBuffer = false, transparent = false, opacity = 1.0, receiveShadow = true) {
        debugPrint("addPlaneAt");
        const texturePath = Paths.texturePath(textureName);
        const planeGeometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            map: this.loadingPlaceholderTexture,
            depthWrite: !resetDepthBuffer,
            side: THREE.DoubleSide,
            transparent: transparent,
            opacity: opacity
        });
        const newMaterial = new THREE.MeshStandardMaterial({
            color: color,
            map: this.textureLoader.load(texturePath, (texture) => {
                material.map = texture;
                material.needsUpdate = true;
            }, (error) => {
                console.log(`WUT! Error: ${error}`);
            }),
            depthWrite: !resetDepthBuffer,
            side: THREE.DoubleSide,
            transparent: transparent,
            opacity: opacity
        });
        if (newMaterial.map != null) {
            this.texturesToLoad.push(newMaterial);
            newMaterial.map.colorSpace = THREE.SRGBColorSpace;
        }
        const plane = new THREE.Mesh(planeGeometry, material);
        plane.position.x = x;
        plane.position.y = y;
        plane.position.z = z;
        if (this.shadowsEnabled) {
            plane.receiveShadow = receiveShadow;
        }
        if (resetDepthBuffer) {
            plane.renderOrder = -1;
        }
        const sceneObject = new SceneObject(name, "Plane", textureName, "NONE", plane, false, null, new Date().getTime());
        this.addSceneObject(sceneObject);
    }
    objectsPickerControllerDidPickObject(_, object) {
        debugPrint(`pick: ${object.name}`);
        if (this.delegate != null) {
            this.delegate.sceneControllerDidPickSceneObjectWithName(this, object.name);
        }
    }
    removeSceneObjectWithName(name) {
        this.removeObjectWithName(name);
    }
    sceneObjectPosition(name) {
        const outputObject = this.sceneObject(name);
        const outputPosition = outputObject.threeObject.position.clone();
        return outputPosition;
    }
    objectCollidesWithObject(alisaName, bobName) {
        const alisa = this.sceneObject(alisaName);
        const bob = this.sceneObject(bobName);
        const alisaColliderBox = new THREE.Box3().setFromObject(alisa.threeObject);
        const bobCollider = new THREE.Box3().setFromObject(bob.threeObject);
        const output = alisaColliderBox.intersectsBox(bobCollider);
        return output;
    }
    sceneObject(name, x = 0, y = 0, z = 0) {
        var object = this.objects[name];
        if (!object || object == undefined) {
            debugPrint("Can't find object with name: {" + name + "}!!!!!");
            if (name == Names.Skybox) {
                debugPrint("But it's skybox so don't mind!");
            }
            else {
                debugger;
                raiseCriticalError("Adding dummy box with name: " + name);
                this.addBoxAt(name, x, y, z, "com.demensdeum.failback.texture.png", 1);
            }
            return this.sceneObject(name);
        }
        return object;
    }
    controlsRequireObjectTeleport(_, name, x, y, z) {
        const sceneObject = this.sceneObject(name);
        sceneObject.threeObject.position.x = x;
        sceneObject.threeObject.position.y = y;
        sceneObject.threeObject.position.z = z;
    }
    translateObject(name, x, y, z) {
        const sceneObject = this.sceneObject(name);
        sceneObject.threeObject.translateX(x);
        sceneObject.threeObject.translateY(y);
        sceneObject.threeObject.translateZ(z);
        sceneObject.changeDate = Utils.timestamp();
    }
    moveObjectTo(name, x, y, z) {
        const sceneObject = this.sceneObject(name, x, y, z);
        sceneObject.threeObject.position.x = x;
        sceneObject.threeObject.position.y = y;
        sceneObject.threeObject.position.z = z;
        sceneObject.changeDate = Utils.timestamp();
    }
    rotateObjectTo(name, x, y, z) {
        const sceneObject = this.sceneObject(name);
        sceneObject.threeObject.rotation.x = x;
        sceneObject.threeObject.rotation.y = y;
        sceneObject.threeObject.rotation.z = z;
        sceneObject.changeDate = Utils.timestamp();
    }
}
SceneController.itemSize = 1;
SceneController.carSize = 1;
SceneController.roadSegmentSize = 2;
SceneController.skyboxPositionDiff = 0.5;
