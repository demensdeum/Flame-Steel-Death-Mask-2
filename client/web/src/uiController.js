export class UIController {
    constructor(context) {
        this.context = context;
        this.terminalVisible = true;
        this.init();
    }

    init() {
        const toggleButton = document.getElementById("terminal-toggle");
        if (toggleButton) {
            toggleButton.addEventListener("click", () => this.toggleTerminal());
        }

        const joinButton = document.getElementById("registration-join");
        const nameInput = document.getElementById("registration-name");
        if (joinButton && nameInput) {
            joinButton.addEventListener("click", () => {
                const name = nameInput.value.trim();
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
}
