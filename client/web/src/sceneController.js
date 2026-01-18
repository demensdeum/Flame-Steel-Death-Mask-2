import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Utils } from "./utils.js";
import { SceneObject } from "./sceneObject.js";
import * as dat from "dat.gui";
import { Names } from "./names.js";
import { SimplePhysicsController } from "./simplePhysicsController.js";
import { PhysicsControllerCollisionDirection } from "./physicsControllerCollisionDirection.js";
import { debugPrint, raiseCriticalError } from "./runtime.js";
import { Paths } from "./paths.js";
import { SceneObjectCommandTeleport } from "./sceneObjectCommandTeleport.js";
import { SceneObjectCommandIdle } from "./sceneObjectCommandIdle.js";
import { SceneObjectCommandTranslate } from "./sceneObjectCommandTranslate.js";
import { ObjectsPickerController } from "./objectsPickerController.js";
import { AnimationContainer } from "./animationContainer.js";
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { GameVector3 } from "./gameVector3.js";
import { GameCssObject3D } from "./gameCssObject3D.js";
const gui = new dat.GUI({ autoPlace: false });
var moveGUIElement = document.querySelector('.moveGUI');
var guiDomElement = gui.domElement;
moveGUIElement?.appendChild(guiDomElement);
export class SceneController {
    constructor(canvas, physicsController, physicsEnabled, gameSettings, flyMode = false) {
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
        this.cssObjects3D = {};
        this.renderers = [];
        this.physicsEnabled = physicsEnabled;
        this.gameSettings = gameSettings;
        this.flyMode = flyMode;
        this.physicsController = physicsController;
        this.physicsController.delegate = this;
        if (this.flyMode &&
            this.physicsController instanceof SimplePhysicsController) {
            this.physicsController.enabled = false;
        }
        if (physicsController instanceof SimplePhysicsController) {
            physicsController.simplePhysicsControllerDelegate = this;
        }
        this.loadingPlaceholderTexture = this.textureLoader.load(Paths.texturePath("com.demensdeum.loading"));
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.windowWidth() / this.windowHeight(), 0.1, 1000);
        const cameraSceneObject = new SceneObject(Names.Camera, Names.Camera, "NONE", "NONE", this.camera, true, null, new Date().getTime());
        this.objects[Names.Camera] = cameraSceneObject;
        this.css3DRendererBottom = new CSS3DRenderer();
        this.css3DRendererBottom.domElement.style.position = "absolute";
        document.querySelector("#css-canvas-bottom")?.appendChild(this.css3DRendererBottom.domElement);
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.css3DRendererTop = new CSS3DRenderer();
        this.css3DRendererTop.domElement.style.position = "absolute";
        document.querySelector("#css-canvas-top")?.appendChild(this.css3DRendererTop.domElement);
        this.renderers.push(this.css3DRendererBottom);
        this.renderers.push(this.renderer);
        this.renderers.push(this.css3DRendererTop);
        this.renderers.forEach((renderer) => {
            renderer.setSize(this.windowWidth(), this.windowHeight());
        });
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
            this.renderers.forEach((renderer) => {
                renderer.setSize(self.windowWidth(), self.windowHeight());
            });
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
    physicControllerRequireApplyPosition(objectName, _, position) {
        this.sceneObject(objectName).threeObject.position.x = position.x;
        this.sceneObject(objectName).threeObject.position.y = position.y;
        this.sceneObject(objectName).threeObject.position.z = position.z;
    }
    physicsControllerDidDetectFreeSpace(_, __, direction) {
        switch (direction) {
            case PhysicsControllerCollisionDirection.Down:
                break;
            case PhysicsControllerCollisionDirection.Front:
                this.canMoveForward = true;
            case PhysicsControllerCollisionDirection.Back:
                this.canMoveBackward = true;
            case PhysicsControllerCollisionDirection.Left:
                this.canMoveLeft = true;
            case PhysicsControllerCollisionDirection.Right:
                this.canMoveRight = true;
        }
    }
    physicsControllerDidDetectDistance(_, collision) {
        if (this.flyMode) {
            this.canMoveForward = true;
            this.canMoveBackward = true;
            this.canMoveLeft = true;
            this.canMoveRight = true;
        }
        const alice = collision.alice;
        const bob = collision.bob;
        const direction = collision.direction;
        const distance = collision.distance;
        if (alice.name == this.userObjectName &&
            bob.name == "Map" &&
            direction == PhysicsControllerCollisionDirection.Front) {
            this.canMoveForward = distance > 0.3;
        }
        if (alice.name == this.userObjectName &&
            bob.name == "Map" &&
            direction == PhysicsControllerCollisionDirection.Back) {
            this.canMoveBackward = distance > 0.3;
        }
        if (alice.name == this.userObjectName &&
            bob.name == "Map" &&
            direction == PhysicsControllerCollisionDirection.Left) {
            this.canMoveLeft = distance > 0.3;
        }
        if (alice.name == this.userObjectName &&
            bob.name == "Map" &&
            direction == PhysicsControllerCollisionDirection.Right) {
            this.canMoveRight = distance > 0.3;
        }
    }
    simplePhysicControllerRequireToAddArrowHelperToScene(_, arrowHelper) {
        this.scene.add(arrowHelper);
    }
    simplePhysicsControllerRequireToDeleteArrowHelperFromScene(_, arrowHelper) {
        this.scene.remove(arrowHelper);
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
        this.physicsController.requireJump(sceneObject);
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
    addText(name, object, userInteractionsEnabled = false) {
        const field = gui.add(object, name);
        if (userInteractionsEnabled == false) {
            field.domElement.style.pointerEvents = "none";
        }
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
    addValueFloat(name, object, minimal, maximal, onChange) {
        gui.add(object, name, minimal, maximal).onChange(onChange);
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
        if (this.physicsController) {
            if (this.physicsController instanceof SimplePhysicsController) {
                this.physicsController.enabled = this.physicsEnabled;
            }
            this.physicsController.step(delta);
        }
        this.weatherController?.step(delta);
        this.animationsStep(delta);
        this.render();
        this.updateUI();
    }
    controlsStep(delta) {
        Object.keys(this.objects).forEach(key => {
            const sceneObject = this.objects[key];
            const controls = sceneObject.controls;
            controls?.step(delta);
        });
    }
    addCssPlaneObject(args) {
        const cssObject = new CSS3DObject(args.div);
        cssObject.position.x = args.position.x;
        cssObject.position.y = args.position.y;
        cssObject.position.z = args.position.z;
        cssObject.scale.x = args.scale.x;
        cssObject.scale.y = args.scale.y;
        cssObject.scale.z = args.scale.z;
        const root = new GameCssObject3D();
        root.isTop = args.display.isTop;
        root.stickToCamera = args.display.stickToCamera;
        root.originalPosition = args.position;
        root.originalRotation = args.rotation;
        root.add(cssObject);
        root.rotation.x = args.rotation.x;
        root.rotation.y = args.rotation.y;
        root.rotation.z = args.rotation.z;
        const material = new THREE.MeshStandardMaterial({
            opacity: 0.25,
            color: new THREE.Color(0x000000),
            blending: THREE.NoBlending
        });
        const geometry = new THREE.PlaneGeometry(args.planeSize.width, args.planeSize.height);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = args.shadows.receiveShadow;
        mesh.castShadow = args.shadows.castShadow;
        root.add(mesh);
        if (args.name in this.cssObjects3D) {
            raiseCriticalError(`Duplicate cssObjects3D name ${args.name}!`);
            debugger;
        }
        this.cssObjects3D[args.name] = root;
        this.scene.add(root);
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
    stickCssObjectToCamera(object) {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        const distance = -object.originalPosition.z / 8;
        const newPosition = new THREE.Vector3()
            .copy(this.camera.position)
            .addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), distance);
        object.position.copy(newPosition);
        object.rotation.copy(this.camera.rotation);
    }
    render() {
        this.renderers.forEach((renderer) => {
            if (renderer == this.css3DRendererBottom || renderer == this.css3DRendererTop) {
                Object.keys(this.cssObjects3D).map(k => {
                    const object = this.cssObjects3D[k];
                    this.scene.remove(object);
                    if (renderer == this.css3DRendererBottom) {
                        if (!object.isTop) {
                            this.scene.add(object);
                            if (object.stickToCamera) {
                                this.stickCssObjectToCamera(object);
                            }
                        }
                    }
                    else if (renderer == this.css3DRendererTop) {
                        if (object.isTop) {
                            this.scene.add(object);
                            if (object.stickToCamera) {
                                this.stickCssObjectToCamera(object);
                            }
                        }
                    }
                });
            }
            renderer.render(this.scene, this.camera);
        });
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
        this.physicsController.addSceneObject(sceneObject);
        this.objectsPickerController.addSceneObject(sceneObject);
    }
    alert(args) {
        const alertName = `alertWindow-${Utils.generateUUID()}`;
        const alertWindowDiv = document.createElement('div');
        alertWindowDiv.style.color = "white";
        alertWindowDiv.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
        alertWindowDiv.style.fontSize = "30px";
        alertWindowDiv.style.padding = "22px";
        alertWindowDiv.style.textAlign = "center";
        alertWindowDiv.style.width = "640px";
        const textSpan = document.createElement('span');
        textSpan.textContent = args.text;
        textSpan.style.display = "block";
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.style.color = "white";
        okButton.style.backgroundColor = 'green';
        okButton.style.fontSize = "20px";
        okButton.style.padding = "12px";
        okButton.style.marginTop = "10px";
        okButton.style.width = "180px";
        okButton.style.border = "none";
        okButton.style.cursor = "pointer";
        const closeWindow = () => {
            this.removeCssObjectWithName(alertName);
        };
        okButton.addEventListener('click', function () {
            closeWindow();
            args.okCallback();
        });
        alertWindowDiv.appendChild(textSpan);
        //alertWindowDiv.appendChild(okButton)
        this.addCssPlaneObject({
            name: alertName,
            div: alertWindowDiv,
            planeSize: {
                width: 2,
                height: 2
            },
            position: new GameVector3(0, 0, -8),
            rotation: GameVector3.zero(),
            scale: new GameVector3(0.01, 0.01, 0.01),
            shadows: {
                receiveShadow: false,
                castShadow: false
            },
            display: {
                isTop: true,
                stickToCamera: true
            }
        });
        debugPrint(args.text);
        debugPrint(args.okCallback);
        setTimeout(() => {
            closeWindow();
            args.okCallback();
        }, 7000);
    }
    removeCssObjectWithName(name) {
        const object = this.cssObjects3D[name];
        this.scene.remove(object);
        var cssObjectsForDeletion = [];
        object.traverse((child) => {
            if (child.isCSS3DObject) {
                cssObjectsForDeletion.push(child);
            }
        });
        cssObjectsForDeletion.forEach((victim) => {
            object.remove(victim);
        });
        delete this.cssObjects3D[name];
    }
    confirm(args) {
        const confirmWindowName = `confirmWindow-${Utils.generateUUID()}`;
        const closeWindow = () => {
            this.removeCssObjectWithName(confirmWindowName);
        };
        const confirmWindowDiv = document.createElement('div');
        confirmWindowDiv.style.color = "white";
        confirmWindowDiv.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
        confirmWindowDiv.style.fontSize = "30px";
        confirmWindowDiv.style.padding = "22px";
        confirmWindowDiv.style.textAlign = "center";
        confirmWindowDiv.style.width = "640px";
        const textSpan = document.createElement('span');
        textSpan.textContent = args.text;
        textSpan.style.display = "block";
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.style.color = "white";
        okButton.style.backgroundColor = 'green';
        okButton.style.fontSize = "20px";
        okButton.style.padding = "12px";
        okButton.style.marginTop = "10px";
        okButton.style.border = "none";
        okButton.style.width = "180px";
        okButton.style.cursor = "pointer";
        okButton.addEventListener('click', function () {
            closeWindow();
            args.okCallback();
        });
        const cancelButton = document.createElement('button');
        cancelButton.textContent = '❌❌❌';
        cancelButton.style.color = "white";
        cancelButton.style.backgroundColor = 'white';
        cancelButton.style.fontSize = "20px";
        cancelButton.style.padding = "16px";
        cancelButton.style.marginTop = "10px";
        cancelButton.style.border = "none";
        cancelButton.style.width = "180px";
        cancelButton.style.cursor = "pointer";
        cancelButton.addEventListener('click', function () {
            closeWindow();
            args.cancelCallback();
        });
        confirmWindowDiv.appendChild(textSpan);
        confirmWindowDiv.appendChild(okButton);
        confirmWindowDiv.appendChild(cancelButton);
        this.addCssPlaneObject({
            name: confirmWindowName,
            div: confirmWindowDiv,
            planeSize: {
                width: 2,
                height: 2
            },
            position: new GameVector3(0, 0, -8),
            rotation: GameVector3.zero(),
            scale: new GameVector3(0.01, 0.01, 0.01),
            shadows: {
                receiveShadow: false,
                castShadow: false
            },
            display: {
                isTop: true,
                stickToCamera: true
            }
        });
        debugPrint(args.text);
        debugPrint(args.okCallback);
        debugPrint(args.cancelCallback);
    }
    prompt(args) {
        const confirmWindowName = `confirmWindow-${Utils.generateUUID()}`;
        const closeWindow = () => {
            this.removeCssObjectWithName(confirmWindowName);
        };
        const confirmWindowDiv = document.createElement('div');
        confirmWindowDiv.style.color = "white";
        confirmWindowDiv.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
        confirmWindowDiv.style.fontSize = "30px";
        confirmWindowDiv.style.padding = "22px";
        confirmWindowDiv.style.textAlign = "center";
        confirmWindowDiv.style.width = "640px";
        const textSpan = document.createElement('span');
        textSpan.textContent = args.text;
        textSpan.style.display = "block";
        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.value = args.value;
        inputField.style.marginTop = "10px";
        inputField.style.width = "80%";
        inputField.style.fontSize = "20px";
        inputField.style.padding = "10px";
        inputField.onclick = () => { inputField.focus(); };
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.style.color = "white";
        okButton.style.backgroundColor = 'green';
        okButton.style.fontSize = "20px";
        okButton.style.padding = "12px";
        okButton.style.marginTop = "10px";
        okButton.style.border = "none";
        okButton.style.width = "180px";
        okButton.style.cursor = "pointer";
        okButton.addEventListener('click', function () {
            closeWindow();
            args.okCallback(inputField.value);
        });
        const cancelButton = document.createElement('button');
        cancelButton.textContent = '❌❌❌';
        cancelButton.style.color = "white";
        cancelButton.style.backgroundColor = 'white';
        cancelButton.style.fontSize = "20px";
        cancelButton.style.padding = "16px";
        cancelButton.style.marginTop = "10px";
        cancelButton.style.border = "none";
        cancelButton.style.width = "180px";
        cancelButton.style.cursor = "pointer";
        cancelButton.addEventListener('click', function () {
            closeWindow();
            args.cancelCallback();
        });
        confirmWindowDiv.appendChild(textSpan);
        confirmWindowDiv.appendChild(inputField);
        confirmWindowDiv.appendChild(okButton);
        confirmWindowDiv.appendChild(cancelButton);
        this.addCssPlaneObject({
            name: confirmWindowName,
            div: confirmWindowDiv,
            planeSize: {
                width: 2,
                height: 2
            },
            position: new GameVector3(0, 0, -8),
            rotation: GameVector3.zero(),
            scale: new GameVector3(0.01, 0.01, 0.01),
            shadows: {
                receiveShadow: false,
                castShadow: false
            },
            display: {
                isTop: true,
                stickToCamera: true
            }
        });
        debugPrint(args.text);
        debugPrint(args.okCallback);
        debugPrint(args.cancelCallback);
        // BROWSERS BUG: https://github.com/demensdeum/Masonry-AR/issues/64
        setTimeout(() => {
            inputField.focus();
        }, 500);
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
    addButton(name, object) {
        gui.add(object, name);
        const boxSize = 1;
        const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const material = new THREE.MeshStandardMaterial({
            color: "white",
            map: this.loadingPlaceholderTexture,
            transparent: true,
            opacity: 0
        });
        const box = new THREE.Mesh(boxGeometry, material);
        box.position.x = 0;
        box.position.y = 0;
        box.position.z = 0;
        const buttonSceneObject = new SceneObject(name, "Button", "", "", box, false, null, new Date().getTime());
        this.objects[name] = buttonSceneObject;
    }
    updateUI() {
        for (const i in gui.__controllers) {
            gui.__controllers[i].updateDisplay();
        }
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
        for (const i in gui.__controllers) {
            gui.remove(gui.__controllers[i]);
        }
        Object.keys(this.objects).map(k => {
            delete this.commands[k];
        });
        Object.keys(this.cssObjects3D).map(k => {
            this.removeCssObjectWithName(k);
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
        this.physicsController.removeSceneObject(sceneObject);
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
