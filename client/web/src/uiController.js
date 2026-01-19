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
}
