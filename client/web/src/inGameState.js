import { State } from "./state.js";
import { Utils } from "./utils.js";
export class InGameState extends State {
    constructor() {
        super(...arguments);
    }
    initialize() {
        this.context.sceneController.setBackgroundColor(0x000000);
    }
    step() {
        this.context.sceneController.switchSkyboxIfNeeded({
            name: "com.demensdeum.blue.field",
            environmentOnly: false
        });
    }
}
