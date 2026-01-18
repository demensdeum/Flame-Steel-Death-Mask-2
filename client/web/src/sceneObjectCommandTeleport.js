import { SceneObjectCommand } from "./sceneObjectCommand.js";
export class SceneObjectCommandTeleport extends SceneObjectCommand {
    constructor(name, time, position, rotation, nextCommand) {
        super(name, time, nextCommand);
        this.position = position;
        this.rotation = rotation;
    }
}
