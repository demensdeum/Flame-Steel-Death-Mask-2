import * as THREE from "three";
import { SceneObjectCommandTranslate } from "./sceneObjectCommandTranslate.js";
import { SceneObjectCommandRotate } from "./sceneObjectCommandRotate.js";
import { SceneObjectCommandJump } from "./sceneObjectCommandJump.js";
import { SceneObjectCommandTeleport } from "./sceneObjectCommandTeleport.js";
export class SceneObjectCommandPerformer {
    constructor(objectName, delegate, dataSource) {
        this.objectName = objectName;
        this.delegate = delegate;
        this.dataSource = dataSource;
    }
    handleCommand(command) {
        if (command instanceof SceneObjectCommandTranslate) {
            this.performTranslate(command);
        }
        else if (command instanceof SceneObjectCommandRotate) {
            this.performRotate(command);
        }
        else if (command instanceof SceneObjectCommandJump) {
            this.performJump(command);
        }
        else if (command instanceof SceneObjectCommandTeleport) {
            this.performTeleport(command);
        }
        command.step();
    }
    performTranslate(command) {
        const x = command.translate.x;
        const y = command.translate.y;
        const z = command.translate.z;
        this.delegate.controlsRequireObjectTranslate(this, this.objectName, x, y, z);
    }
    performRotate(command) {
        const x = command.rotate.x;
        const y = command.rotate.y;
        const z = command.rotate.z;
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        const quaternion = this.dataSource.controlsQuaternionForObject(this, this.objectName);
        euler.setFromQuaternion(quaternion);
        euler.x += x;
        euler.y += y;
        euler.z += z;
        this.delegate.controlsRequireObjectRotation(this, this.objectName, euler);
    }
    performJump(_) {
        this.delegate.controlsRequireJump(this, this.objectName);
    }
    performTeleport(command) {
        const x = command.position.x;
        const y = command.position.y;
        const z = command.position.z;
        this.delegate.controlsRequireObjectTeleport(this, this.objectName, x, y, z);
    }
    step(_) {
    }
}
