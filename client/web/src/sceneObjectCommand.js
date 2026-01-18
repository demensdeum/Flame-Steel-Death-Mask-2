export class SceneObjectCommand {
    constructor(name, time, nextCommandName) {
        this.name = name;
        this.time = time;
        this.originalTime = time;
        if (nextCommandName != null) {
            this.nextCommandName = nextCommandName;
        }
    }
    reset() {
        this.time = this.originalTime;
    }
    step() {
        this.time -= 1;
    }
    isExpired() {
        return this.time < 1;
    }
}
