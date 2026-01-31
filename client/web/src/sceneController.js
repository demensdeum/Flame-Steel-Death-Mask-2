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
        this.highQuality = false;
        this.shadowsEnabled = true;
        this.physicsEnabled = physicsEnabled;
        this.gameSettings = gameSettings;
        this.flyMode = flyMode;
        this.scaleFactor = 1;
        this.loadingPlaceholderTexture = this.textureLoader.load(Paths.texturePath("com.demensdeum.loading"));
        this.isCameraMoving = false;


        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.windowWidth() / this.windowHeight(), 0.1, 1000 * this.scaleFactor);
        this.scene.add(this.camera);
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
        this.orbitControls = new OrbitControls(camera, renderer.domElement);
        debugPrint(this.orbitControls);
        this.instancedMeshes = {};
        this.pointLights = {};
        this.ambientLight = null;
    }
    get scale() {
        return this.scaleFactor;
    }
    lockOrbitControls() {
        this.orbitControls.maxPolarAngle = Math.PI / 2 - Utils.degreesToRadians(50);
        this.orbitControls.minDistance = 2.8;
        this.orbitControls.maxDistance = 3.4;
        this.orbitControls.enablePan = false;
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.225;
    }
    setOrbitControlsEnabled(enabled) {
        this.orbitControls.enabled = enabled;
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
        const s = this.scaleFactor;
        this.translateObject(objectName, x * s, y * s, z * s);
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
    addCommand(name, type, time, x, y, z, rX, rY, rZ, nextCommandName) {
        const s = this.scaleFactor;
        const position = new THREE.Vector3(x * s, y * s, z * s);
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

    addPointLight(objectName, position, color = 0xffffff, intensity = 1.0, distance = 0, decay = 2) {
        const s = this.scaleFactor;
        const light = new THREE.PointLight(color, intensity, distance * s, decay);
        light.position.set(position.x * s, position.y * s, position.z * s);
        if (this.shadowsEnabled) {
            light.castShadow = true;
            light.shadow.bias = -0.005;
            light.shadow.mapSize.width = 1024;
            light.shadow.mapSize.height = 1024;
            light.shadow.camera.near = 0.1;
            light.shadow.camera.far = 100 * s;
        }
        const sceneObject = new SceneObject(objectName, "PointLight", "NONE", "NONE", light, false, null, Utils.timestamp());
        this.addSceneObject(sceneObject);
        this.pointLights[objectName] = light;
        return sceneObject;
    }

    addEnvironmentLight(color = 0xffffff, intensity = 0.2) {
        if (this.ambientLight != null) {
            this.scene.remove(this.ambientLight);
            this.ambientLight.dispose();
        }
        this.ambientLight = new THREE.AmbientLight(color, intensity);
        this.scene.add(this.ambientLight);
    }

    stickObjectToObject(childName, parentName) {
        const child = this.pointLights[childName] || this.sceneObject(childName).threeObject;
        const parent = this.pointLights[parentName] || this.sceneObject(parentName).threeObject;
        parent.add(child);
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
        this.orbitControls.update();
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
        Object.keys(this.instancedMeshes).forEach((modelName) => {
            const instancedMesh = this.instancedMeshes[modelName];
            this.scene.remove(instancedMesh);
            instancedMesh.dispose();
        });
        this.instancedMeshes = {};

        Object.keys(this.pointLights).forEach((name) => {
            const light = this.pointLights[name];
            light.removeFromParent();
            if (light.shadow && light.shadow.map) {
                light.shadow.map.dispose();
            }
        });
        this.pointLights = {};

        if (this.ambientLight != null) {
            this.scene.remove(this.ambientLight);
            this.ambientLight.dispose();
            this.ambientLight = null;
        }
        this.scene.fog = null;
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
        const s = this.scaleFactor;
        const boxGeometry = new THREE.BoxGeometry(boxSize * s, boxSize * s, boxSize * s);
        const boxMaterial = new THREE.MeshStandardMaterial({
            color: color,
            map: this.loadingPlaceholderTexture,
            transparent: true,
            opacity: 0.7
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.x = x * s;
        box.position.y = y * s;
        box.position.z = z * s;
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
            model.scale.set(self.scaleFactor, self.scaleFactor, self.scaleFactor);
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
            debugPrint(`Model loading error: ${error}`);
            if (sceneObject.loadingRetries === undefined) {
                sceneObject.loadingRetries = 0;
            }
            if (sceneObject.loadingRetries < 5) {
                sceneObject.loadingRetries++;
                debugPrint(`Retrying model load (${sceneObject.loadingRetries}/5) for ${modelName} in 3 seconds...`);
                setTimeout(() => {
                    modelLoader.load(modelPath, onModelLoaded, onModelLoadingProgess, onModelLoadError);
                }, 3000);
            } else {
                debugPrint(`Model loading failed after 5 retries: ${modelPath}`);
                debugger;
            }
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
        const s = this.scaleFactor;
        const texturePath = Paths.texturePath(textureName);
        const boxGeometry = new THREE.BoxGeometry(size * s, size * s, size * s);
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
        box.position.x = x * s;
        box.position.y = y * s;
        box.position.z = z * s;
        const sceneObject = new SceneObject(name, "Box", textureName, "NONE", box, false, null, new Date().getTime());
        sceneObject.meshes.push(box);
        this.addSceneObject(sceneObject);
    }
    addPlaneAt(name, x, y, z, width, height, textureName, color = 0xFFFFFF, resetDepthBuffer = false, transparent = false, opacity = 1.0, receiveShadow = true) {
        debugPrint("addPlaneAt");
        const s = this.scaleFactor;
        const texturePath = Paths.texturePath(textureName);
        const planeGeometry = new THREE.PlaneGeometry(width * s, height * s);
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
        plane.position.x = x * s;
        plane.position.y = y * s;
        plane.position.z = z * s;
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
        outputPosition.divideScalar(this.scaleFactor);
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
        const s = this.scaleFactor;
        const sceneObject = this.sceneObject(name);
        sceneObject.threeObject.position.x = x * s;
        sceneObject.threeObject.position.y = y * s;
        sceneObject.threeObject.position.z = z * s;
    }
    translateObject(name, x, y, z) {
        const sceneObject = this.sceneObject(name);
        sceneObject.threeObject.translateX(x);
        sceneObject.threeObject.translateY(y);
        sceneObject.threeObject.translateZ(z);
        sceneObject.changeDate = Utils.timestamp();
    }
    moveObjectTo(name, x, y, z) {
        const s = this.scaleFactor;
        const sceneObject = this.sceneObject(name, x * s, y * s, z * s);
        sceneObject.threeObject.position.x = x * s;
        sceneObject.threeObject.position.y = y * s;
        sceneObject.threeObject.position.z = z * s;
        sceneObject.changeDate = Utils.timestamp();
    }
    rotateObjectTo(name, x, y, z) {
        const sceneObject = this.sceneObject(name);
        sceneObject.threeObject.rotation.x = x;
        sceneObject.threeObject.rotation.y = y;
        sceneObject.threeObject.rotation.z = z;
        sceneObject.changeDate = Utils.timestamp();
    }
    addInstancedModel(modelName, positions) {
        if (modelName in this.instancedMeshes) {
            return;
        }

        const count = positions.length;
        const modelLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./three/examples/jsm/libs/draco/');
        modelLoader.setDRACOLoader(dracoLoader);

        const modelPath = Paths.modelPath(modelName);
        const self = this;

        const onModelLoaded = (container) => {
            const model = container.scene;
            let mesh = null;

            model.traverse((child) => {
                if (child.isMesh && !mesh) {
                    mesh = child;
                }
            });

            if (mesh) {
                const instancedMesh = new THREE.InstancedMesh(mesh.geometry, mesh.material, count);
                instancedMesh.castShadow = self.shadowsEnabled;
                instancedMesh.receiveShadow = self.shadowsEnabled;

                const s = self.scaleFactor;
                const dummy = new THREE.Object3D();
                for (let i = 0; i < count; i++) {
                    const position = positions[i];
                    dummy.position.set(position.x * s, position.y * s, position.z * s);
                    dummy.scale.set(s, s, s);
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(i, dummy.matrix);
                }
                instancedMesh.instanceMatrix.needsUpdate = true;
                instancedMesh.computeBoundingSphere();

                self.instancedMeshes[modelName] = instancedMesh;
                self.scene.add(instancedMesh);
                debugPrint(`Added instanced model: ${modelName} with count: ${count}`);
            } else {
                debugPrint(`Failed to add instanced model: ${modelName} - no mesh found`);
            }
        };
        const onModelLoadError = (error) => {
            debugPrint(`Error loading instanced model ${modelName}: ${error}`);
            if (self.instancedModelRetries === undefined) {
                self.instancedModelRetries = {};
            }
            if (self.instancedModelRetries[modelName] === undefined) {
                self.instancedModelRetries[modelName] = 0;
            }

            if (self.instancedModelRetries[modelName] < 5) {
                self.instancedModelRetries[modelName]++;
                debugPrint(`Retrying instanced model load (${self.instancedModelRetries[modelName]}/5) for ${modelName} in 3 seconds...`);
                setTimeout(() => {
                    modelLoader.load(modelPath, onModelLoaded, undefined, onModelLoadError);
                }, 3000);
            } else {
                debugPrint(`Instanced model loading failed after 5 retries: ${modelName}`);
            }
        };

        modelLoader.load(modelPath, onModelLoaded, undefined, onModelLoadError);
    }
}
SceneController.itemSize = 1;
SceneController.carSize = 1;
SceneController.roadSegmentSize = 2;
SceneController.skyboxPositionDiff = 0.5;
