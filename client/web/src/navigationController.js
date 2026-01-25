import * as THREE from "three";
import { Names } from "./names.js";

export class NavigationController {
    constructor(context) {
        this.context = context;
        this.facingAngle = 0; // 0, 90, 180, 270 degrees

        this.initButtons();
        this.initKeyboard();
        this.lastMoveTime = 0;
        this.moving = false;
        this.smoothMoveDuration = 370;
    }

    initKeyboard() {
        document.addEventListener("keydown", (event) => {
            const key = event.key.toLowerCase();
            const navigationKeys = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "s", "a", "d", "ц", "ы", "ф", "в"];

            if (navigationKeys.includes(key)) {
                if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            }

            switch (key) {
                case "arrowup":
                case "w":
                case "ц":
                    this.moveForward();
                    break;
                case "arrowdown":
                case "s":
                case "ы":
                    this.moveBackward();
                    break;
                case "arrowleft":
                case "a":
                case "ф":
                    this.rotateLeft();
                    break;
                case "arrowright":
                case "d":
                case "в":
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
        this.smoothRotate(-1);
    }

    rotateRight() {
        this.smoothRotate(1);
    }

    smoothRotate(direction) {
        if (this.moving) return;

        this.moving = true;
        const startAngle = this.facingAngle;
        const targetAngle = startAngle + (direction * 90);
        const startTime = performance.now();

        const sceneController = this.context.sceneController;
        const currentPos = sceneController.sceneObjectPosition(Names.Camera);

        const animate = (time) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / this.smoothMoveDuration, 1);

            // Interpolate angle
            const currentAngle = startAngle + (targetAngle - startAngle) * progress;
            const rad = (currentAngle * Math.PI) / 180;

            // Calculate new look target based on current interpolated angle
            const lookDistance = 0.1;
            const targetX = currentPos.x + Math.cos(rad) * lookDistance;
            const targetZ = currentPos.z + Math.sin(rad) * lookDistance;

            const s = sceneController.scaleFactor;
            sceneController.debugControls.target.set(targetX * s, currentPos.y * s, targetZ * s);
            sceneController.debugControls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Finished
                this.facingAngle = (Math.round(targetAngle) + 360) % 360;
                this.moving = false;
                this.updateCameraRotation(); // Ensure final snap is exact
            }
        };
        requestAnimationFrame(animate);
    }

    updateCameraRotation() {
        const rad = (this.facingAngle * Math.PI) / 180;
        const sceneController = this.context.sceneController;
        const currentPos = sceneController.sceneObjectPosition(Names.Camera);

        // Calculate new look target based on angle
        const lookDistance = 0.1;
        const targetX = currentPos.x + Math.cos(rad) * lookDistance;
        const targetZ = currentPos.z + Math.sin(rad) * lookDistance;

        const s = sceneController.scaleFactor;
        sceneController.debugControls.target.set(targetX * s, currentPos.y * s, targetZ * s);
        sceneController.debugControls.update();
        this.context.minimapController.update();
    }



    moveForward() {
        this.smoothMove(1);
    }

    moveBackward() {
        this.smoothMove(-1);
    }

    smoothMove(direction) {
        if (this.moving) return;

        // No cooldown check as requested

        const terminal = this.context.terminal;
        if (!terminal.lastTeleportMapId || !terminal.lastTeleportPrivateUuid) {
            terminal.println("Error: You must 'map' first to initialize position.");
            return;
        }

        const rad = (this.facingAngle * Math.PI) / 180;
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

        // Start Animation
        this.moving = true;
        const sceneController = this.context.sceneController;
        const startPos = sceneController.sceneObjectPosition(Names.Camera);

        const startX = startPos.x;
        const startZ = startPos.z;
        const targetX = startX + dx;
        const targetZ = startZ + dy;

        const startTime = performance.now();

        const animate = (time) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / this.smoothMoveDuration, 1);

            // Linear interpolation for now, could use easing
            const currentX = startX + (targetX - startX) * progress;
            const currentZ = startZ + (targetZ - startZ) * progress;

            sceneController.moveObjectTo(Names.Camera, currentX, startPos.y, currentZ);

            // Keep looking in the same direction relative to camera
            const lookDist = 0.1;
            const lookX = currentX + Math.cos(rad) * lookDist;
            const lookZ = currentZ + Math.sin(rad) * lookDist;

            const s = sceneController.scaleFactor;
            sceneController.debugControls.target.set(lookX * s, startPos.y * s, lookZ * s);
            sceneController.debugControls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Finished
                terminal.sendTeleport(
                    terminal.lastTeleportMapId,
                    nextX,
                    nextY,
                    terminal.lastTeleportPrivateUuid
                );
                this.lastMoveTime = Date.now();
                this.moving = false;
                this.context.minimapController.update();
            }
        };
        requestAnimationFrame(animate);
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
