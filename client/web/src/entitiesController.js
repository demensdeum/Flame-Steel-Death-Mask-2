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
        this.context.sceneController.moveObjectTo(
            entity.public_uuid,
            entity.x,
            1,
            entity.y
        );
        this.entities.set(entity.public_uuid, entity);
        console.log(`Updated entity ${entity.public_uuid} to (${entity.x}, ${entity.y})`);
    }

    removeEntity(uuid) {
        this.context.sceneController.removeObjectWithName(uuid);
        this.entities.delete(uuid);
        console.log(`Removed entity ${uuid}`);
    }
}
