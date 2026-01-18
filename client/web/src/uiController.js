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
    }

    toggleTerminal() {
        const terminal = document.getElementById("terminal");
        if (terminal) {
            this.terminalVisible = !this.terminalVisible;
            terminal.style.display = this.terminalVisible ? "flex" : "none";
        }
    }
}
