import * as THREE from "three";

export class NavigationController {
    constructor(context) {
        this.context = context;
        this.facingAngle = 0; // 0, 90, 180, 270 degrees

        this.initButtons();
        this.initKeyboard();
        this.lastMoveTime = 0;
    }

    initKeyboard() {
        document.addEventListener("keydown", (event) => {
            // Prevent default scrolling behavior for arrow keys
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                // event.preventDefault(); // Optional: might block terminal input if not careful. 
                // However, terminal input is an <input> element. 
                // If the user is typing in the terminal, we probably shouldn't move.
                // Let's check active element.
                if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            }

            switch (event.key) {
                case "ArrowUp":
                    this.moveForward();
                    break;
                case "ArrowDown":
                    this.moveBackward();
                    break;
                case "ArrowLeft":
                    this.rotateLeft();
                    break;
                case "ArrowRight":
                    this.rotateRight();
                    break;
            }
        });
    }

    initButtons() {
        document.getElementById("nav-up")?.addEventListener("click", () => this.moveForward());
        document.getElementById("nav-down")?.addEventListener("click", () => this.moveBackward());
        document.getElementById("nav-left")?.addEventListener("click", () => this.rotateLeft());
        document.getElementById("nav-right")?.addEventListener("click", () => this.rotateRight());
        document.getElementById("nav-attack")?.addEventListener("click", () => this.attack());
        document.getElementById("nav-unlock")?.addEventListener("click", () => this.unlock());
        document.getElementById("nav-heal")?.addEventListener("click", () => this.heal());
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
        this.context.minimapController.update();
    }



    moveForward() {
        this.sendTeleportMove(1);
    }

    moveBackward() {
        this.sendTeleportMove(-1);
    }

    sendTeleportMove(direction) {
        const now = Date.now();
        if (now - this.lastMoveTime < 350) {
            return;
        }

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

        const minimapController = this.context.minimapController;
        if (minimapController && minimapController.grid) {
            const row = minimapController.grid[nextY];
            if (row) {
                const char = row[nextX];
                if (char === 'X') {
                    terminal.println("Cannot move: path is blocked by a wall.");
                    return;
                }
            }
        }

        terminal.sendTeleport(
            terminal.lastTeleportMapId,
            nextX,
            nextY,
            terminal.lastTeleportPrivateUuid
        );
        this.lastMoveTime = now;
    }

    attack() {
        const terminal = this.context.terminal;
        const entitiesController = this.context.entitiesController;

        if (terminal.entityType !== "seeker") {
            terminal.println("Error: Only 'seeker' can attack.");
            return;
        }

        const playerX = terminal.lastTeleportX;
        const playerY = terminal.lastTeleportY;

        if (playerX === undefined || playerY === undefined) {
            terminal.println("Error: Player position unknown. Teleport first.");
            return;
        }

        let target = null;
        for (const entity of entitiesController.entities.values()) {
            if (entity.type !== "filter") continue;

            const dx = Math.abs(entity.x - playerX);
            const dy = Math.abs(entity.y - playerY);

            // Proximity check: 1 cell vertically or horizontally (Manhattan distance 1)
            if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                target = entity;
                break;
            }
        }

        if (target) {
            terminal.sendAttack(target.public_uuid);
        } else {
            terminal.println("No 'filter' entity in range to attack.");
        }
    }

    unlock() {
        const terminal = this.context.terminal;
        const entitiesController = this.context.entitiesController;

        const playerX = terminal.lastTeleportX;
        const playerY = terminal.lastTeleportY;

        if (playerX === undefined || playerY === undefined) {
            terminal.println("Error: Player position unknown. Teleport first.");
            return;
        }

        let target = null;
        for (const entity of entitiesController.entities.values()) {
            if (entity.type !== "chest") continue;

            const dx = Math.abs(entity.x - playerX);
            const dy = Math.abs(entity.y - playerY);

            // Proximity check: 1 cell vertically or horizontally (Manhattan distance 1)
            if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                target = entity;
                break;
            }
        }

        if (target) {
            terminal.sendUnlock(target.public_uuid);
        } else {
            terminal.println("No 'chest' entity in range to unlock.");
        }
    }

    heal() {
        this.context.terminal.sendHeal();
    }
}
