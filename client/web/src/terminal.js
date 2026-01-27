import { Names } from "./names.js";

export class Terminal {
    constructor(context) {
        this.context = context;
        this.outputArea = document.getElementById("terminal-output");
        this.inputField = document.getElementById("terminal-input");
        this.history = JSON.parse(localStorage.getItem("terminal-history") || "[]");
        this.historyIndex = -1;
        this.currentInput = "";

        this.lastTeleportMapId = null;
        this.lastTeleportPrivateUuid = null;
        this.lastTeleportX = undefined;
        this.lastTeleportY = undefined;
        this.publicUuid = null;
        this.entityType = null;

        if (!this.outputArea || !this.inputField) {
            console.error("Terminal elements not found!");
            return;
        }

        this.inputField.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                const command = this.inputField.value;
                this.handleCommand(command);
                if (command.trim() !== "") {
                    this.history.push(command);
                    localStorage.setItem("terminal-history", JSON.stringify(this.history));
                }
                this.historyIndex = -1;
                this.inputField.value = "";

            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                if (this.history.length > 0) {
                    if (this.historyIndex === -1) {
                        this.currentInput = this.inputField.value;
                        this.historyIndex = this.history.length - 1;
                    } else if (this.historyIndex > 0) {
                        this.historyIndex--;
                    }
                    this.inputField.value = this.history[this.historyIndex];
                }
            } else if (event.key === "ArrowDown") {
                event.preventDefault();
                if (this.historyIndex !== -1) {
                    if (this.historyIndex < this.history.length - 1) {
                        this.historyIndex++;
                        this.inputField.value = this.history[this.historyIndex];
                    } else {
                        this.historyIndex = -1;
                        this.inputField.value = this.currentInput;
                    }
                }
            }
        });


        this.attributesPollInterval = null;
        this.privateUuidForAttributes = null;
        this.mapReconstructionTimeout = null;

        this.connect();
    }

    registerAndJoin(name) {
        console.log("Terminal: registerAndJoin called with:", name);
        console.log("Terminal: socket state:", this.socket ? this.socket.readyState : "no socket");
        if (this.socket.readyState !== WebSocket.OPEN) {
            this.println("Error: Not connected to server.");
            console.error("Terminal: Cannot register, socket not open.");
            return;
        }
        this.println(`>>> Initializing identity as: ${name}`);
        this.socket.send(JSON.stringify({
            type: "register",
            private_uuid: name,
            entity_type: "seeker"
        }));
        this._lastRegisterPrivateUuid = name;
        this._lastRegisterEntityType = "seeker";
        this._joining = true;
    }

    startAttributesPolling(privateUuid) {
        this.privateUuidForAttributes = privateUuid;

        // Stop any existing polling
        if (this.attributesPollInterval) {
            clearInterval(this.attributesPollInterval);
        }

        // Start polling every 4 seconds
        this.attributesPollInterval = setInterval(() => {
            if (this.socket.readyState === WebSocket.OPEN && this.privateUuidForAttributes) {
                this.socket.send(JSON.stringify({
                    type: "attributes",
                    private_uuid: this.privateUuidForAttributes
                }));
            }
        }, 4000);

        // Do an immediate poll
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "attributes",
                private_uuid: this.privateUuidForAttributes
            }));
        }
    }

    stopAttributesPolling() {
        if (this.attributesPollInterval) {
            clearInterval(this.attributesPollInterval);
            this.attributesPollInterval = null;
        }
        this.privateUuidForAttributes = null;
    }

    updateAttributesDisplay(attributes) {
        const healthSpan = document.getElementById('attr-health');
        const attackSpan = document.getElementById('attr-attack');
        const defenceSpan = document.getElementById('attr-defence');
        const bitsSpan = document.getElementById('attr-bits');
        const healsSpan = document.getElementById('attr-heals');

        if (healthSpan) healthSpan.textContent = `${attributes.current_health}/${attributes.max_health}`;
        if (attackSpan) attackSpan.textContent = attributes.attack;
        if (defenceSpan) defenceSpan.textContent = attributes.defence;
        if (bitsSpan) bitsSpan.textContent = attributes.bits;
        if (healsSpan) healsSpan.textContent = attributes.heal_items || 0;
    }

    connect() {
        if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
            return;
        }

        if (this.socket) {
            // Clean up old socket to prevent multiple listeners or loops
            this.socket.onclose = null;
            this.socket.onerror = null;
            this.socket.onmessage = null;
            this.socket.onopen = null;
            this.socket.close();
        }

        this.isConnecting = true;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

        // Get current path and ensure it ends with a slash if not just root
        let path = window.location.pathname;
        if (path.endsWith('.html')) {
            path = path.substring(0, path.lastIndexOf('/'));
        }
        if (!path.endsWith('/')) {
            path += '/';
        }
        // Subpath will be like "/flame-steel-death-mask-2/"
        // We append socket to it
        const wsUrl = `${protocol}//${window.location.host}${path}socket`;

        this.println(`--- Connecting to ${wsUrl}... ---`);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            this.isConnecting = false;
            this.println(`--- Connected to server ---`);
            this.println("Type 'help' for a list of commands.");
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerResponse(data);
            } catch (e) {
                this.println("Server (Raw): " + event.data);
            }
        };

        this.socket.onclose = () => {
            this.isConnecting = false;
            this.println("--- Connection lost. Reconnecting in 5s... ---");
            setTimeout(() => this.connect(), 5000);
        };

        this.socket.onerror = (error) => {
            this.isConnecting = false;
            this.println("--- Connection error. Retrying in 5s... ---");
            this.socket.close();
        };
    }


    handleCommand(user_input) {
        user_input = user_input.trim();
        if (!user_input) return;

        this.println(`>>> ${user_input}`);

        const parts = user_input.split(/\s+/);
        const cmd = parts[0].toLowerCase();


        if (cmd === "help") {
            this.println("\nAvailable commands:");
            this.println("  health                     Check server status");
            this.println("  register <private_uuid> <type> Register a user with type (seeker, filter, chest, teleport)");
            this.println("  map <map_id> <private_uuid> Request a procedural map (requires registration)");
            this.println("  teleport <map_id> <x> <y> <private_uuid> Teleport to a position (requires registration)");
            this.println("  entities <map_id> <private_uuid> List all users on a map (requires registration)");
            this.println("  attributes <private_uuid>  Get player attributes (requires registration)");
            this.println("  heal <private_uuid>        Heal yourself (requires registration)");
            this.println("  attack <target_public_uuid> <attacker_private_uuid> Attack another entity (requires registration)");
            this.println("  unlock <target_public_uuid> <unlocker_private_uuid> Unlock a chest (requires registration)");
            this.println("  clear                     Clear the terminal");
            this.println("  exit / quit               Close the client\n");
            return;
        }

        if (cmd === "clear") {
            this.clear();
            return;
        }

        if (cmd === "exit" || cmd === "quit") {
            this.println("Goodbye!");
            // Optional: close tab or just stop
            return;
        }

        if (this.socket.readyState !== WebSocket.OPEN) {
            this.println("Error: Not connected to server.");
            return;
        }

        if (cmd === "health") {
            this.socket.send(JSON.stringify({ type: "health" }));
        } else if (cmd === "register") {
            if (parts.length < 3) {
                this.println("Error: Missing arguments. Usage: register <private_uuid> <type>");
                return;
            }
            const privateUuid = parts[1];
            const entityType = parts[2].toLowerCase();
            const validTypes = ["seeker", "filter", "chest", "teleport"];

            if (!validTypes.includes(entityType)) {
                this.println(`Error: Invalid entity_type '${entityType}'. Allowed types: ${validTypes.join(", ")}`);
                return;
            }

            this.socket.send(JSON.stringify({
                type: "register",
                private_uuid: privateUuid,
                entity_type: entityType
            }));
            // Store for later use in registration response
            this._lastRegisterPrivateUuid = privateUuid;
            this._lastRegisterEntityType = entityType;
        } else if (cmd === "map") {
            if (parts.length < 3) {
                this.println("Error: Missing arguments. Usage: map <map_id> <private_uuid>");
                return;
            }
            this.lastTeleportMapId = parts[1];
            this.lastTeleportPrivateUuid = parts[2];
            this.socket.send(JSON.stringify({
                type: "map",
                id: this.lastTeleportMapId,
                private_uuid: this.lastTeleportPrivateUuid
            }));
        } else if (cmd === "teleport") {
            if (parts.length < 5) {
                this.println("Error: Missing arguments. Usage: teleport <map_id> <x> <y> <private_uuid>");
                return;
            }
            this.lastTeleportMapId = parts[1];
            this.lastTeleportX = parseInt(parts[2]);
            this.lastTeleportY = parseInt(parts[3]);
            this.lastTeleportPrivateUuid = parts[4];
            this.socket.send(JSON.stringify({
                type: "teleport",
                map_id: this.lastTeleportMapId,
                x: this.lastTeleportX,
                y: this.lastTeleportY,
                private_uuid: this.lastTeleportPrivateUuid
            }));


        } else if (cmd === "entities") {
            if (parts.length < 3) {
                this.println("Error: Missing arguments. Usage: entities <map_id> <private_uuid>");
                return;
            }
            this.socket.send(JSON.stringify({
                type: "entities",
                map_id: parts[1],
                private_uuid: parts[2]
            }));
        } else if (cmd === "attributes") {
            if (parts.length < 2) {
                this.println("Error: Missing private_uuid. Usage: attributes <private_uuid>");
                return;
            }
            this.socket.send(JSON.stringify({
                type: "attributes",
                private_uuid: parts[1]
            }));
        } else if (cmd === "heal") {
            if (parts.length < 2) {
                this.println("Error: Missing private_uuid. Usage: heal <private_uuid>");
                return;
            }
            this.socket.send(JSON.stringify({
                type: "heal",
                private_uuid: parts[1]
            }));
        } else if (cmd === "attack") {
            if (parts.length < 3) {
                this.println("Error: Missing arguments. Usage: attack <target_public_uuid> <attacker_private_uuid>");
                return;
            }
            this.socket.send(JSON.stringify({
                type: "attack",
                target_public_uuid: parts[1],
                attacker_private_uuid: parts[2]
            }));
        } else if (cmd === "unlock") {
            if (parts.length < 3) {
                this.println("Error: Missing arguments. Usage: unlock <target_public_uuid> <unlocker_private_uuid>");
                return;
            }
            this.socket.send(JSON.stringify({
                type: "unlock",
                target_public_uuid: parts[1],
                unlocker_private_uuid: parts[2]
            }));
        } else {
            this.println(`Unknown command: '${cmd}'. Type 'help' for available commands.`);
        }
    }

    sendTeleport(mapId, x, y, uuid) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            this.println("Error: Cannot teleport, socket is closed.");
            return;
        }
        this.println(`>>> GUI Teleport to ${x}, ${y}`);
        this.lastTeleportX = x;
        this.lastTeleportY = y;
        this.socket.send(JSON.stringify({
            type: "teleport",
            map_id: mapId,
            x: x,
            y: y,
            private_uuid: uuid
        }));
    }

    sendAttack(targetPublicUuid) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            this.println("Error: Cannot attack, socket is closed.");
            return;
        }
        if (!this.lastTeleportPrivateUuid) {
            this.println("Error: No private UUID found. Register first.");
            return;
        }
        this.println(`>>> GUI Attack on ${targetPublicUuid}`);
        this.socket.send(JSON.stringify({
            type: "attack",
            target_public_uuid: targetPublicUuid,
            attacker_private_uuid: this.lastTeleportPrivateUuid
        }));
    }

    sendUnlock(targetPublicUuid) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            this.println("Error: Cannot unlock, socket is closed.");
            return;
        }
        if (!this.lastTeleportPrivateUuid) {
            this.println("Error: No private UUID found. Register first.");
            return;
        }
        this.println(`>>> GUI Unlock on ${targetPublicUuid}`);
        this.socket.send(JSON.stringify({
            type: "unlock",
            target_public_uuid: targetPublicUuid,
            unlocker_private_uuid: this.lastTeleportPrivateUuid
        }));
    }

    sendHeal() {
        if (this.socket.readyState !== WebSocket.OPEN) {
            this.println("Error: Cannot heal, socket is closed.");
            return;
        }
        if (!this.lastTeleportPrivateUuid) {
            this.println("Error: No private UUID found. Register first.");
            return;
        }
        this.println(`>>> GUI Heal`);
        this.socket.send(JSON.stringify({
            type: "heal",
            private_uuid: this.lastTeleportPrivateUuid
        }));
    }

    sendEntitiesRequest(mapId, privateUuid) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        this.socket.send(JSON.stringify({
            type: "entities",
            map_id: mapId,
            private_uuid: privateUuid
        }));
    }


    handleServerResponse(data) {

        if (data.type === "map") {
            this.println("\n--- Map Received ---");
            const grid = data.data.grid;
            grid.forEach(row => {
                this.println(row);
            });
            this.println("--- End of Map ---\n");

            const layerSpan = document.getElementById('attr-layer');
            if (layerSpan) {
                layerSpan.textContent = data.data.id;
            }

            // Debounce the heavy reconstruction logic
            if (this.mapReconstructionTimeout) {
                clearTimeout(this.mapReconstructionTimeout);
            }

            this.mapReconstructionTimeout = setTimeout(() => {
                if (data.data.id === "1") {
                    setTimeout(() => {
                        if (this.context.uiController) {
                            this.context.uiController.showMessage("Welcome back.\nThe service requires you.", 2000);
                        }
                    }, 1000);
                }

                this.println("Constructing 3D Scene...");
                this.context.minimapController.setGrid(grid);
                this.context.sceneController.removeAllSceneObjectsExceptCamera();
                this.context.sceneController.addEnvironmentLight(0xffffff, 4.0);
                this.context.sceneController.setFog(0x000000, 1, 40);

                const modelName = "com.demensdeum.flame-steel-death-mask-2.grid";
                const environmentPositions = [];

                for (let y = 0; y < grid.length; y++) {
                    const row = grid[y];
                    for (let x = 0; x < row.length; x++) {
                        const char = row[x];
                        if (char === 'X') {
                            // Only add wall if neighbor is ground
                            let hasGroundNeighbor = false;
                            for (let dy = -1; dy <= 1; dy++) {
                                for (let dx = -1; dx <= 1; dx++) {
                                    if (dx === 0 && dy === 0) continue;
                                    const ny = y + dy;
                                    const nx = x + dx;
                                    if (ny >= 0 && ny < grid.length && nx >= 0 && nx < row.length) {
                                        if (grid[ny][nx] === '_') {
                                            hasGroundNeighbor = true;
                                            break;
                                        }
                                    }
                                }
                                if (hasGroundNeighbor) break;
                            }

                            if (hasGroundNeighbor) {
                                environmentPositions.push({ x, y: 1, z: y });
                            }
                        } else if (char === '_') {
                            environmentPositions.push({ x, y: 0, z: y });
                            environmentPositions.push({ x, y: 2, z: y });
                        }
                    }
                }
                this.context.sceneController.addInstancedModel(modelName, environmentPositions);

                const cameraLightName = "PlayerCameraLight";
                this.context.sceneController.addPointLight(cameraLightName, { x: 0, y: 0, z: 0 }, 0xd3d3d3, 1.0, 5, 2);
                this.context.sceneController.stickObjectToObject(cameraLightName, "Camera");

                this.println("3D Scene Construction Complete.");

                // Top-down camera view
                const mazeHeight = grid.length;
                const mazeWidth = grid[0].length;
                const centerX = mazeWidth / 2;
                const centerZ = mazeHeight / 2;
                const viewDistance = Math.max(mazeWidth, mazeHeight) * 1.2;

                this.context.sceneController.moveObjectTo(Names.Camera, centerX, viewDistance, centerZ);
                const s = this.context.sceneController.scaleFactor;
                this.context.sceneController.debugControls.target.set(centerX * s, 0, centerZ * s);
                this.context.sceneController.debugControls.update();
                this.println("Camera set to top-down view.");

                // Auto-teleport to food/ground if possible
                const groundCells = [];
                for (let y = 0; y < grid.length; y++) {
                    for (let x = 0; x < grid[y].length; x++) {
                        if (grid[y][x] === '_') {
                            groundCells.push({ x, y });
                        }
                    }
                }

                if (groundCells.length > 0) {
                    const randomCell = groundCells[Math.floor(Math.random() * groundCells.length)];
                    this.println(`Auto-teleporting to random free space: (${randomCell.x}, ${randomCell.y})`);

                    // Explicitly update cache variables to ensure consistency
                    const mapId = data.data.id;
                    const privateUuid = this.lastTeleportPrivateUuid;

                    this.lastTeleportMapId = mapId;
                    this.lastTeleportX = randomCell.x;
                    this.lastTeleportY = randomCell.y;

                    this.sendTeleport(mapId, randomCell.x, randomCell.y, privateUuid);
                }
            }, 1000); // 1 second debounce
        } else if (data.type === "register") {
            this.println(`Registration successful! Your public_uuid is: ${data.public_uuid}`);
            this.publicUuid = data.public_uuid;
            this.entityType = this._lastRegisterEntityType;
            // Auto-start attributes polling if we have a private_uuid
            if (this._lastRegisterPrivateUuid) {
                this.println("Starting attributes polling...");
                this.startAttributesPolling(this._lastRegisterPrivateUuid);
            }

            if (this._joining) {
                this.println("Joining world map 1...");
                this.socket.send(JSON.stringify({
                    type: "map",
                    id: "1",
                    private_uuid: this._lastRegisterPrivateUuid
                }));
                this.lastTeleportMapId = "1";
                this.lastTeleportPrivateUuid = this._lastRegisterPrivateUuid;
                this._joining = false;

                // Hide registration overlay
                if (this.context.uiController) {
                    this.context.uiController.hideRegistrationOverlay();
                }
            }
        } else if (data.type === "attributes") {
            // Update the attributes display silently (don't print to terminal)
            if (data.attributes) {
                this.updateAttributesDisplay(data.attributes);

                if (data.attributes.current_health <= 0) {
                    this.println("Health critical! Emergency teleport to Respawn Hub...");
                    const uuid = this.privateUuidForAttributes || this._lastRegisterPrivateUuid;
                    if (uuid) {
                        this.handleCommand(`map 1 ${uuid}`);
                    }
                }
            }
        } else if (data.type === "heal") {
            if (data.status === "OK") {
                this.println(`Healed for ${data.heal_amount} HP!`);
                this.println(`Health: ${data.old_health} -> ${data.new_health}`);
            } else {
                this.println(`Heal failed.`);
            }
        } else if (data.type === "attack") {
            if (data.status === "OK") {
                this.println(`Attack successful!`);
                this.println(`Damage dealt: ${data.damage}`);
                this.println(`Target health: ${data.target_remaining_health}`);
                if (data.entity_removed) {
                    this.println(`Target destroyed!`);
                }
            } else {
                this.println(`Attack failed.`);
            }
        } else if (data.type === "unlock") {
            if (data.status === "OK") {
                this.println(`Unlock successful!`);
                if (data.loot) {
                    this.println(`Loot received:`);
                    if (data.loot.bits) this.println(`- Bits: ${data.loot.bits}`);
                    if (data.loot.attack) this.println(`- Attack: ${data.loot.attack}`);
                    if (data.loot.defence) this.println(`- Defence: ${data.loot.defence}`);
                    if (data.loot.max_health) this.println(`- Max Health: ${data.loot.max_health}`);
                    if (data.loot.heal_items) this.println(`- Heal Items: ${data.loot.heal_items}`);
                }
            } else {
                this.println(`Unlock failed: ${data.error || "Unknown error"}`);
            }
        } else if (data.type === "teleport") {
            this.println(`Teleport successful! Public UUID: ${data.public_uuid}`);
            if (this.lastTeleportX !== undefined && this.lastTeleportY !== undefined) {
                const x = this.lastTeleportX;
                const z = this.lastTeleportY; // y from grid is z in scene

                if (this.context.navigationController.isForwardOrBackwardPressed()) {
                    this.println(`Skipping camera teleport as movement buttons are pressed.`);
                    return;
                }

                const height = 1;
                this.context.sceneController.moveObjectTo(Names.Camera, x, height, z);

                // Respect the current facing direction from NavigationController
                const rad = (this.context.navigationController.facingAngle * Math.PI) / 180;
                const lookDistance = 1;
                const targetX = x + Math.cos(rad) * lookDistance;
                const targetZ = z + Math.sin(rad) * lookDistance;

                const s = this.context.sceneController.scaleFactor;
                this.context.sceneController.debugControls.target.set(targetX * s, height * s, targetZ * s);
                this.context.sceneController.debugControls.update();
                this.context.minimapController.update();
                this.println(`Camera moved to player position: (${x}, ${z})`);

                if (this.context.entitiesController) {
                    this.context.entitiesController.startPolling();
                    // Check if player is on a teleport entity
                    for (const entity of this.context.entitiesController.entities.values()) {
                        if (entity.type === 'teleport' && entity.x === x && entity.y === z) {
                            const nextMapId = parseInt(this.lastTeleportMapId) + 1;
                            this.println(`Character is on top of teleport: transitioning to map ${nextMapId}`);
                            this.handleCommand(`map ${nextMapId} ${this.lastTeleportPrivateUuid}`);
                            break;
                        }
                    }
                }
            }



        } else if (data.type === "entities") {
            this.println(`\n--- Entities on Map ${data.map_id} ---`);
            if (data.entities && data.entities.length > 0) {
                data.entities.forEach(entity => {
                    this.println(`- [${entity.type.toUpperCase()}] UUID: ${entity.public_uuid} at (${entity.x}, ${entity.y})`);
                });
            } else {
                this.println("No entities found.");
            }
            this.println("--- End of Entities ---\n");

            if (this.context.entitiesController) {
                this.context.entitiesController.reconcile(data.entities);
            }
        } else if (data.status === "OK") {


            this.println("Server status: OK");
        } else if (data.error) {
            this.println(`Server error: ${data.error}`);
        } else {
            this.println("Response from server:");
            this.println(JSON.stringify(data, null, 2));
        }
    }


    println(text) {
        const line = document.createElement("div");
        line.style.marginBottom = "4px";
        line.textContent = text;
        line.style.whiteSpace = "pre-wrap";
        this.outputArea.appendChild(line);
        this.outputArea.scrollTop = this.outputArea.scrollHeight;
    }

    clear() {
        this.outputArea.innerHTML = "";
    }
}
