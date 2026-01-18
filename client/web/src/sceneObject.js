import { Utils } from "./utils.js";
class Texture {
    constructor(name) {
        this.name = name;
    }
}
class Model {
    constructor(name) {
        this.name = name;
    }
}
export class SceneObject {
    constructor(name, type, texture, model, threeObject, isMovable, controls, changeDate) {
        this.animations = [];
        this.meshes = [];
        this.uuid = Utils.generateUUID();
        this.name = name;
        this.type = type;
        this.texture = new Texture(texture);
        this.model = new Model(model);
        this.threeObject = threeObject;
        this.isMovable = isMovable;
        if (controls != null) {
            this.controls = controls;
        }
        this.changeDate = changeDate;
    }
    serialize() {
        var controlsName = "NONE";
        var controlsStartCommand = "NONE";
        const output = {
            "name": this.name,
            "type": this.type,
            "texture": this.texture,
            "model": this.model,
            "position": {
                "x": this.threeObject.position.x,
                "y": this.threeObject.position.y,
                "z": this.threeObject.position.z
            },
            "rotation": {
                "x": this.threeObject.rotation.x,
                "y": this.threeObject.rotation.y,
                "z": this.threeObject.rotation.z
            },
            "isMovable": this.isMovable,
            "controls": {
                "name": controlsName,
                "startCommand": controlsStartCommand
            },
            "changeDate": this.changeDate
        };
        return output;
    }
}
