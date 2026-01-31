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

        this.forwardPressed = false;
        this.backwardPressed = false;
        this.leftPressed = false;
        this.rightPressed = false;
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
                    this.forwardPressed = true;
                    this.moveForward();
                    break;
                case "arrowdown":
                case "s":
                case "ы":
                    this.backwardPressed = true;
                    this.moveBackward();
                    break;
                case "arrowleft":
                case "a":
                case "ф":
                    this.leftPressed = true;
                    this.rotateLeft();
                    break;
                case "arrowright":
                case "d":
                case "в":
                    this.rightPressed = true;
                    this.rotateRight();
                    break;
            }
        });

        document.addEventListener("keyup", (event) => {
            const key = event.key.toLowerCase();
            switch (key) {
                case "arrowup":
                case "w":
                case "ц":
                    this.forwardPressed = false;
                    break;
                case "arrowdown":
                case "s":
                case "ы":
                    this.backwardPressed = false;
                    break;
                case "arrowleft":
                case "a":
                case "ф":
                    this.leftPressed = false;
                    break;
                case "arrowright":
                case "d":
                case "в":
                    this.rightPressed = false;
                    break;
            }
        });
    }

    initButtons() {
        const upButton = document.getElementById("nav-up");
        const downButton = document.getElementById("nav-down");
        const leftButton = document.getElementById("nav-left");
        const rightButton = document.getElementById("nav-right");

        upButton?.addEventListener("pointerdown", () => {
            this.forwardPressed = true;
            this.moveForward();
        });
        upButton?.addEventListener("pointerup", () => this.forwardPressed = false);
        upButton?.addEventListener("pointerleave", () => this.forwardPressed = false);
        upButton?.addEventListener("contextmenu", (e) => e.preventDefault());

        downButton?.addEventListener("pointerdown", () => {
            this.backwardPressed = true;
            this.moveBackward();
        });
        downButton?.addEventListener("pointerup", () => this.backwardPressed = false);
        downButton?.addEventListener("pointerleave", () => this.backwardPressed = false);
        downButton?.addEventListener("contextmenu", (e) => e.preventDefault());

        leftButton?.addEventListener("pointerdown", () => {
            this.leftPressed = true;
            this.rotateLeft();
        });
        leftButton?.addEventListener("pointerup", () => this.leftPressed = false);
        leftButton?.addEventListener("pointerleave", () => this.leftPressed = false);
        leftButton?.addEventListener("contextmenu", (e) => e.preventDefault());

        rightButton?.addEventListener("pointerdown", () => {
            this.rightPressed = true;
            this.rotateRight();
        });
        rightButton?.addEventListener("pointerup", () => this.rightPressed = false);
        rightButton?.addEventListener("pointerleave", () => this.rightPressed = false);
        rightButton?.addEventListener("contextmenu", (e) => e.preventDefault());

        document.getElementById("nav-attack")?.addEventListener("click", () => this.attack());
        document.getElementById("nav-attack")?.addEventListener("contextmenu", (e) => e.preventDefault());
        document.getElementById("nav-unlock")?.addEventListener("click", () => this.unlock());
        document.getElementById("nav-unlock")?.addEventListener("contextmenu", (e) => e.preventDefault());
        document.getElementById("nav-heal")?.addEventListener("click", () => this.heal());
        document.getElementById("nav-heal")?.addEventListener("contextmenu", (e) => e.preventDefault());
        document.getElementById("terminal-toggle")?.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    rotateLeft() {
        this.smoothRotate(-1);
    }

    rotateRight() {
        this.smoothRotate(1);
    }

    smoothRotate(direction) {
        const sceneController = this.context.sceneController;
        if (this.moving || sceneController.isCameraMoving) return;

        this.moving = true;
        sceneController.isCameraMoving = true;

        const startAngle = this.facingAngle;
        const targetAngle = startAngle + (direction * 90);
        const startTime = performance.now();

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
            sceneController.orbitControls.target.set(targetX * s, currentPos.y * s, targetZ * s);
            sceneController.orbitControls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Finished
                this.facingAngle = (Math.round(targetAngle) + 360) % 360;
                this.moving = false;
                sceneController.isCameraMoving = false;
                this.updateCameraRotation(); // Ensure final snap is exact

                if (this.leftPressed || sceneController.isCameraMoving) {
                    this.rotateLeft();
                } else if (this.rightPressed || sceneController.isCameraMoving) {
                    this.rotateRight();
                }

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
        sceneController.orbitControls.target.set(targetX * s, currentPos.y * s, targetZ * s);
        sceneController.orbitControls.update();
        this.context.minimapController.update();
    }

    isForwardOrBackwardPressed() {
        return this.forwardPressed || this.backwardPressed;
    }



    moveForward() {
        this.smoothMove(1);
    }

    moveBackward() {
        this.smoothMove(-1);
    }

    smoothMove(direction) {
        const sceneController = this.context.sceneController;
        if (this.moving || sceneController.isCameraMoving) return;


        // No cooldown check as requested

        const terminal = this.context.terminal;
        if (!terminal.lastTeleportMapId || !terminal.lastTeleportPrivateUuid) {
            terminal.println("Error: You must 'map' first to initialize position.");
            return;
        }

        const rad = (this.facingAngle * Math.PI) / 180;
        const dx = Math.round(Math.cos(rad) * direction);
        const dy = Math.round(Math.sin(rad) * direction);

        const currentPos = sceneController.sceneObjectPosition(Names.Camera);
        const nextX = Math.round(currentPos.x) + dx;
        const nextY = Math.round(currentPos.z) + dy;

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
        sceneController.isCameraMoving = true;
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
            sceneController.orbitControls.target.set(lookX * s, startPos.y * s, lookZ * s);
            sceneController.orbitControls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Finished
                terminal.syncPlayerPosition();
                this.lastMoveTime = Date.now();
                this.moving = false;
                sceneController.isCameraMoving = false;
                this.context.minimapController.update();

                if (this.forwardPressed || sceneController.isCameraMoving) {
                    this.moveForward();
                } else if (this.backwardPressed || sceneController.isCameraMoving) {
                    this.moveBackward();
                }

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
            this.startAttackAnimation();
            terminal.sendAttack(target.public_uuid);
        } else {
            terminal.println("No 'filter' entity in range to attack.");
        }
    }

    startAttackAnimation() {
        const sceneController = this.context.sceneController;
        if (this.moving || sceneController.isCameraMoving) return;

        const startPos = sceneController.sceneObjectPosition(Names.Camera);
        const rad = (this.facingAngle * Math.PI) / 180;
        const bumpDist = 0.06;
        const duration = 150; // ms

        const startTime = performance.now();

        const animate = (time) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Sine wave for smooth forward and back movement
            // sin(PI * progress) goes 0 -> 1 -> 0
            const factor = Math.sin(Math.PI * progress);
            const currentX = startPos.x + Math.cos(rad) * bumpDist * factor;
            const currentZ = startPos.z + Math.sin(rad) * bumpDist * factor;

            sceneController.moveObjectTo(Names.Camera, currentX, startPos.y, currentZ);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                sceneController.moveObjectTo(Names.Camera, startPos.x, startPos.y, startPos.z);
            }
        };
        requestAnimationFrame(animate);
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
