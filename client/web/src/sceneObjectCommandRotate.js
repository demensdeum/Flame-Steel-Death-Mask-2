import { SceneObjectCommand } from "./sceneObjectCommand.js";
export class SceneObjectCommandRotate extends SceneObjectCommand {
    constructor(name, time, rotate) {
        super(name, time);
        this.rotate = rotate;
    }
}
