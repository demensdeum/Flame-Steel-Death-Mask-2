export class EntitiesController {
    constructor(context) {
        this.context = context;
        this.entities = new Map(); // publicUuid -> entityData
        this.pollingInterval = null;
    }

    startPolling() {
        if (this.pollingInterval) return;

        this.pollingInterval = setInterval(() => {
            const terminal = this.context.terminal;
            if (terminal.lastTeleportMapId && terminal.lastTeleportPrivateUuid) {
                terminal.sendEntitiesRequest(terminal.lastTeleportMapId, terminal.lastTeleportPrivateUuid);
            }
        }, 5000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    reconcile(serverEntities) {
        const localPublicUuid = this.context.terminal.publicUuid;
        const currentUuids = new Set(serverEntities.map(e => e.public_uuid));

        // 1. Remove entities no longer present
        for (const [uuid, entity] of this.entities.entries()) {
            if (!currentUuids.has(uuid)) {
                this.removeEntity(uuid);
            }
        }

        // 2. Add or update entities
        serverEntities.forEach(entity => {
            if (entity.public_uuid === localPublicUuid) return;

            const existing = this.entities.get(entity.public_uuid);
            if (!existing) {
                this.addEntity(entity);
            } else if (existing.x !== entity.x || existing.y !== entity.y) {
                this.updateEntity(entity);
            }
        });

        // 3. Update minimap
        if (this.context.minimapController) {
            this.context.minimapController.setEntities(Array.from(this.entities.values()));
        }
    }

    addEntity(entity) {
        const modelName = `com.demensdeum.flame-steel-death-mask-2.${entity.type}`;
        this.context.sceneController.addModelAt(
            entity.public_uuid,
            modelName,
            entity.x,
            1,
            entity.y,
            0,
            0,
            0,
            false,
            null
        );
        this.entities.set(entity.public_uuid, entity);
        console.log(`Added entity ${entity.public_uuid} (${entity.type}) at (${entity.x}, ${entity.y})`);
    }

    updateEntity(entity) {
        const sceneController = this.context.sceneController;
        const startPos = sceneController.sceneObjectPosition(entity.public_uuid);
        const targetX = entity.x;
        const targetY = 1;
        const targetZ = entity.y;
        const duration = 500;
        const startTime = performance.now();

        const animate = (time) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const currentX = startPos.x + (targetX - startPos.x) * progress;
            const currentZ = startPos.z + (targetZ - startPos.z) * progress;

            sceneController.moveObjectTo(
                entity.public_uuid,
                currentX,
                targetY,
                currentZ
            );

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);

        this.entities.set(entity.public_uuid, entity);
        console.log(`Smoothly updating entity ${entity.public_uuid} to (${entity.x}, ${entity.y})`);
    }

    removeEntity(uuid) {
        this.context.sceneController.removeObjectWithName(uuid);
        this.entities.delete(uuid);
        console.log(`Removed entity ${uuid}`);
    }

    step() {
        const localPublicUuid = this.context.terminal.publicUuid;
        const playerX = this.context.terminal.lastTeleportX;
        const playerY = this.context.terminal.lastTeleportY;

        if (playerX === undefined || playerY === undefined) return;

        const sceneController = this.context.sceneController;

        for (const [uuid, entity] of this.entities.entries()) {
            if (uuid === localPublicUuid) continue;
            if (entity.type !== "seeker" && entity.type !== "filter") continue;

            const dx = entity.x - playerX;
            const dy = entity.y - playerY;
            const distance = Math.abs(dx) + Math.abs(dy);

            if (distance <= 2) {
                // Determine target rotation based on relative position
                // 0 degrees is positive X (right)
                // 90 degrees is positive Z (down/back)
                // 180 degrees is negative X (left)
                // 270 degrees is negative Z (up/forward)

                let targetRotationY = 0;
                if (dx === 1 && dy === 0) targetRotationY = Math.PI; // Player is to the left
                else if (dx === -1 && dy === 0) targetRotationY = 0; // Player is to the right
                else if (dx === 0 && dy === 1) targetRotationY = Math.PI * 1.5; // Player is forward
                else if (dx === 0 && dy === -1) targetRotationY = Math.PI * 0.5; // Player is backward
                else if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
                    // Diagonal (distance 2)
                    targetRotationY = Math.atan2(-dy, -dx);
                } else if (Math.abs(dx) === 2 && dy === 0) {
                    targetRotationY = dx > 0 ? Math.PI : 0;
                } else if (dx === 0 && Math.abs(dy) === 2) {
                    targetRotationY = dy > 0 ? Math.PI * 1.5 : Math.PI * 0.5;
                } else {
                    continue; // Skip if no specific logic for this distance
                }

                const currentRotation = sceneController.sceneObject(uuid).threeObject.rotation;
                const currentY = currentRotation.y;

                // Normalize rotation difference to [-PI, PI]
                let diff = targetRotationY - currentY;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                // Smoothing factor
                const smoothing = 0.1;
                if (Math.abs(diff) > 0.01) {
                    sceneController.rotateObjectTo(
                        uuid,
                        currentRotation.x,
                        currentY + diff * smoothing,
                        currentRotation.z
                    );
                }
            }
        }
    }
}
