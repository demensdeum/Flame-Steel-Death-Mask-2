export class UIController {
    constructor(context) {
        this.context = context;
        this.terminalVisible = false;
        this.init();
    }

    init() {
        console.log("UIController: initializing...");
        const toggleButton = document.getElementById("terminal-toggle");
        if (toggleButton) {
            toggleButton.addEventListener("click", () => this.toggleTerminal());
        }

        this.checkAutoLogin();

        const joinButton = document.getElementById("registration-join");
        const nameInput = document.getElementById("registration-name");
        console.log("UIController: joinButton:", joinButton, "nameInput:", nameInput);
        if (joinButton && nameInput) {
            joinButton.addEventListener("click", () => {
                const name = nameInput.value.trim();
                console.log("UIController: Join clicked, name:", name);
                if (name) {
                    localStorage.setItem("flame-steel-codename", name);
                    this.context.terminal.registerAndJoin(name);
                } else {
                    alert("Please enter a codename.");
                }
            });

            nameInput.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    joinButton.click();
                }
            });
        }
    }


    checkAutoLogin() {
        const storedName = localStorage.getItem("flame-steel-codename");
        if (storedName) {
            const nameInput = document.getElementById("registration-name");
            if (nameInput) {
                nameInput.value = storedName;
            }
            console.log("UIController: Auto-login with:", storedName);
            this.context.terminal.registerAndJoin(storedName);
        }
    }

    hideRegistrationOverlay() {
        const overlay = document.getElementById("registration-overlay");
        if (overlay) {
            overlay.style.display = "none";
        }
    }

    toggleTerminal() {
        const terminal = document.getElementById("terminal");
        if (terminal) {
            this.terminalVisible = !this.terminalVisible;
            terminal.style.display = this.terminalVisible ? "flex" : "none";
        }
    }

    showMessage(text, duration = 4000) {
        const overlay = document.getElementById("game-message-overlay");
        const textEl = document.getElementById("game-message-text");
        if (overlay && textEl) {
            textEl.innerText = text;
            overlay.style.display = "flex";

            // Clear any existing timeout
            if (this._messageTimeout) clearTimeout(this._messageTimeout);

            if (duration > 0) {
                this._messageTimeout = setTimeout(() => {
                    overlay.style.display = "none";
                    this._messageTimeout = null;
                }, duration);
            }
        }
    }

    fadeOut(duration = 500) {
        console.log(`UIController: fadeOut starting, duration: ${duration}`);
        return new Promise((resolve) => {
            const overlay = document.getElementById("fade-overlay");
            if (!overlay) {
                console.warn("UIController: fade-overlay not found for fadeOut");
                resolve();
                return;
            }
            overlay.style.transition = `opacity ${duration}ms ease-in-out`;
            overlay.style.opacity = "1";
            setTimeout(() => {
                console.log("UIController: fadeOut complete");
                resolve();
            }, duration);
        });
    }

    fadeIn(duration = 500) {
        console.log(`UIController: fadeIn starting, duration: ${duration}`);
        return new Promise((resolve) => {
            const overlay = document.getElementById("fade-overlay");
            if (!overlay) {
                console.warn("UIController: fade-overlay not found for fadeIn");
                resolve();
                return;
            }
            overlay.style.transition = `opacity ${duration}ms ease-in-out`;
            overlay.style.opacity = "0";
            setTimeout(() => {
                console.log("UIController: fadeIn complete");
                resolve();
            }, duration);
        });
    }

    showGUI() {
        console.log("UIController: showGUI called");
        const elements = [
            "minimap-container",
            "attributes-container",
            "navigation-controls",
            "action-controls",
            "terminal-toggle"
        ];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id.includes("controls") || id === "minimap-container") {
                    console.log(`UIController: showing flex element: ${id}`);
                    el.style.display = "flex";
                } else {
                    console.log(`UIController: showing block element: ${id}`);
                    el.style.display = "block";
                }

            } else {
                console.warn(`UIController: showGUI: element not found: ${id}`);
            }
        });
    }
}

