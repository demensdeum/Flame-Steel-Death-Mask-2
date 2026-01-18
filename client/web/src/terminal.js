export class Terminal {
    constructor(context) {
        this.context = context;
        this.outputArea = document.getElementById("terminal-output");
        this.inputField = document.getElementById("terminal-input");
        this.history = JSON.parse(localStorage.getItem("terminal-history") || "[]");
        this.historyIndex = -1;
        this.currentInput = "";

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


        this.connect();
    }

    connect() {
        this.socket = new WebSocket("ws://localhost:8080");

        this.socket.onopen = () => {
            this.println("--- Connected to ws://localhost:8080 ---");
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
            this.println("--- Disconnected from server ---");
        };

        this.socket.onerror = (error) => {
            this.println("WebSocket Error: " + error.message);
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
            this.socket.send(JSON.stringify({
                type: "register",
                private_uuid: parts[1],
                entity_type: parts[2]
            }));
        } else if (cmd === "map") {
            if (parts.length < 3) {
                this.println("Error: Missing arguments. Usage: map <map_id> <private_uuid>");
                return;
            }
            this.socket.send(JSON.stringify({
                type: "map",
                id: parts[1],
                private_uuid: parts[2]
            }));
        } else if (cmd === "teleport") {
            if (parts.length < 5) {
                this.println("Error: Missing arguments. Usage: teleport <map_id> <x> <y> <private_uuid>");
                return;
            }
            this.socket.send(JSON.stringify({
                type: "teleport",
                map_id: parts[1],
                x: parseInt(parts[2]),
                y: parseInt(parts[3]),
                private_uuid: parts[4]
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
        } else {
            this.println(`Unknown command: '${cmd}'. Type 'help' for available commands.`);
        }
    }

    handleServerResponse(data) {
        if (data.type === "map") {
            this.println("\n--- Map Received ---");
            const grid = data.data.grid;
            grid.forEach(row => {
                this.println(row);
            });
            this.println("--- End of Map ---\n");

            this.println("Constructing 3D Scene...");
            this.context.sceneController.removeAllSceneObjectsExceptCamera();

            const modelName = "com.demensdeum.flamesteeldeathmask2.wall";

            for (let y = 0; y < grid.length; y++) {
                const row = grid[y];
                for (let x = 0; x < row.length; x++) {
                    const char = row[x];
                    const name = `block_${x}_${y}`;
                    if (char === 'X') {
                        this.context.sceneController.addModelAt(name, modelName, x, 1, y, 0, 0, 0, false, null);
                    } else if (char === '_') {
                        this.context.sceneController.addModelAt(name, modelName, x, 0, y, 0, 0, 0, false, null);
                    }
                }
            }
            this.println("3D Scene Construction Complete.");

            // Top-down camera view
            const mazeHeight = grid.length;
            const mazeWidth = grid[0].length;
            const centerX = mazeWidth / 2;
            const centerZ = mazeHeight / 2;
            const viewDistance = Math.max(mazeWidth, mazeHeight) * 1.2;

            this.context.sceneController.camera.position.set(centerX, viewDistance, centerZ);
            this.context.sceneController.debugControls.target.set(centerX, 0, centerZ);
            this.context.sceneController.debugControls.update();
            this.println("Camera set to top-down view.");
        } else if (data.type === "register") {
            this.println(`Registration successful! Your public_uuid is: ${data.public_uuid}`);
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
