import { SceneObjectCommand } from "./sceneObjectCommand.js";
export class SceneObjectCommandTranslate extends SceneObjectCommand {
    constructor(name, time, translate, nextCommandName) {
        super(name, time, nextCommandName);
        this.translate = translate;
    }
}
