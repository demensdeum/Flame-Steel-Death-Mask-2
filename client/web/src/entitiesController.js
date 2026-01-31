import { Names } from "./names.js";
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
        const sceneController = this.context.sceneController;
        const cameraObject = sceneController.objects[Names.Camera];
        if (!cameraObject || !cameraObject.threeObject) return;

        const playerPos = cameraObject.threeObject.position;
        const scale = sceneController.scaleFactor;
        const range = 2.5 * scale; // Range in world units (slightly more than 2 grid units)

        for (const [uuid, entity] of this.entities.entries()) {
            if (entity.type !== "seeker" && entity.type !== "filter") continue;

            const sceneObject = sceneController.objects[uuid];
            if (!sceneObject || !sceneObject.threeObject) continue;

            const enemyPos = sceneObject.threeObject.position;
            const distSq = enemyPos.distanceToSquared(playerPos);

            if (distSq <= range * range) {
                // Calculate target rotation to face the player using world coords
                // atan2(dz, dx) for angle in XZ plane
                const targetRotationY = Math.atan2(
                    playerPos.z - enemyPos.z,
                    playerPos.x - enemyPos.x
                );

                const currentRotation = sceneObject.threeObject.rotation;
                const currentY = currentRotation.y;

                // Normalize rotation difference to [-PI, PI]
                let diff = targetRotationY - currentY;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                // Smoothing factor
                const smoothing = 0.08;
                if (Math.abs(diff) > 0.01) {
                    sceneController.rotateObjectTo(
                        uuid,
                        currentRotation.x,
                        currentY + diff * smoothing,
                        currentRotation.z + Math.PI / 2
                    );
                }
            }
        }
    }
}
