import { State } from "./state.js";
import { Utils } from "./utils.js";
export class InGameState extends State {
    constructor() {
        super(...arguments);
    }
    initialize() {
        this.context.sceneController.switchSkyboxIfNeeded({
            name: "com.demensdeum.blue.field"
        });
    }
    step() {
        console.log("inGameState step");
    }
}
