import * as THREE from "three";

export class NavigationController {
    constructor(context) {
        this.context = context;
        this.facingAngle = 0; // 0, 90, 180, 270 degrees

        this.initButtons();
    }

    initButtons() {
        document.getElementById("nav-up")?.addEventListener("click", () => this.moveForward());
        document.getElementById("nav-down")?.addEventListener("click", () => this.moveBackward());
        document.getElementById("nav-left")?.addEventListener("click", () => this.rotateLeft());
        document.getElementById("nav-right")?.addEventListener("click", () => this.rotateRight());
    }

    rotateLeft() {
        this.facingAngle = (this.facingAngle - 90 + 360) % 360;
        this.updateCameraRotation();
    }

    rotateRight() {
        this.facingAngle = (this.facingAngle + 90) % 360;
        this.updateCameraRotation();
    }


    updateCameraRotation() {
        const rad = (this.facingAngle * Math.PI) / 180;
        const camera = this.context.sceneController.camera;
        const controls = this.context.sceneController.debugControls;

        // Calculate new look target based on angle
        const lookDistance = 1;
        const targetX = camera.position.x + Math.cos(rad) * lookDistance;
        const targetZ = camera.position.z + Math.sin(rad) * lookDistance;

        controls.target.set(targetX, camera.position.y, targetZ);
        controls.update();
    }


    moveForward() {
        this.sendTeleportMove(1);
    }

    moveBackward() {
        this.sendTeleportMove(-1);
    }

    sendTeleportMove(direction) {
        const terminal = this.context.terminal;
        if (!terminal.lastTeleportMapId || !terminal.lastTeleportPrivateUuid) {
            terminal.println("Error: You must 'map' first to initialize position.");
            return;
        }

        const rad = (this.facingAngle * Math.PI) / 180;
        // 0 deg = +X, 90 deg = +Z, 180 deg = -X, 270 deg = -Z


        const dx = Math.round(Math.cos(rad) * direction);
        const dy = Math.round(Math.sin(rad) * direction);

        const nextX = (terminal.lastTeleportX || 0) + dx;
        const nextY = (terminal.lastTeleportY || 0) + dy;

        terminal.sendTeleport(
            terminal.lastTeleportMapId,
            nextX,
            nextY,
            terminal.lastTeleportPrivateUuid
        );
    }
}
