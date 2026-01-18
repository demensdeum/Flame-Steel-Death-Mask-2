import * as THREE from "three";
import { GameVector3 } from "./gameVector3.js";
export class GameCssObject3D extends THREE.Object3D {
    constructor() {
        super(...arguments);
        this.isTop = true;
        this.stickToCamera = true;
        this.originalRotation = GameVector3.zero();
        this.originalPosition = GameVector3.zero();
    }
}
