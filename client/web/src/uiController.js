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

        const joinButton = document.getElementById("registration-join");
        const nameInput = document.getElementById("registration-name");
        console.log("UIController: joinButton:", joinButton, "nameInput:", nameInput);
        if (joinButton && nameInput) {
            joinButton.addEventListener("click", () => {
                const name = nameInput.value.trim();
                console.log("UIController: Join clicked, name:", name);
                if (name) {
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
}
