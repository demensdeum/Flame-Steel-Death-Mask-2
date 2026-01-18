export class MinimapController {
    constructor(context) {
        this.context = context;
        this.canvas = document.getElementById("minimap-canvas");
        this.ctx = this.canvas?.getContext("2d");
        this.grid = null;
        this.tileSize = 15;
        this.playerColor = "#ff0000";
        this.wallColor = "#00ff00";
        this.groundColor = "#004400";
        this.entities = [];
    }

    setGrid(grid) {
        this.grid = grid;
        this.update();
    }

    setEntities(entities) {
        this.entities = entities;
        this.update();
    }

    update() {
        if (!this.ctx || !this.grid) return;

        this.clear();

        const terminal = this.context.terminal;
        const rows = this.grid.length;
        const cols = this.grid[0].length;

        let offsetX, offsetY;

        if (terminal.lastTeleportX !== undefined && terminal.lastTeleportY !== undefined) {
            // Center on player
            offsetX = this.canvas.width / 2 - (terminal.lastTeleportX * this.tileSize + this.tileSize / 2);
            offsetY = this.canvas.height / 2 - (terminal.lastTeleportY * this.tileSize + this.tileSize / 2);
        } else {
            // Center the entire map if player position unknown
            offsetX = (this.canvas.width - cols * this.tileSize) / 2;
            offsetY = (this.canvas.height - rows * this.tileSize) / 2;
        }

        this.drawGrid(offsetX, offsetY);
        this.drawEntities(offsetX, offsetY);
        this.drawPlayer(offsetX, offsetY);
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid(offsetX, offsetY) {
        const rows = this.grid.length;
        const cols = this.grid[0].length;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const char = this.grid[y][x];
                this.ctx.fillStyle = char === 'X' ? this.wallColor : this.groundColor;
                this.ctx.fillRect(
                    offsetX + x * this.tileSize,
                    offsetY + y * this.tileSize,
                    this.tileSize - 1,
                    this.tileSize - 1
                );
            }
        }
    }

    drawEntities(offsetX, offsetY) {
        this.ctx.fillStyle = "#ffff00"; // Other entities are yellow
        this.entities.forEach(entity => {
            const ex = offsetX + entity.x * this.tileSize;
            const ey = offsetY + entity.y * this.tileSize;
            this.ctx.fillRect(ex, ey, this.tileSize - 1, this.tileSize - 1);
        });
    }

    drawPlayer(offsetX, offsetY) {
        const terminal = this.context.terminal;
        const nav = this.context.navigationController;

        if (terminal.lastTeleportX === undefined || terminal.lastTeleportY === undefined || !this.grid) return;

        const px = offsetX + terminal.lastTeleportX * this.tileSize + this.tileSize / 2;
        const py = offsetY + terminal.lastTeleportY * this.tileSize + this.tileSize / 2;

        this.ctx.save();
        this.ctx.translate(px, py);
        this.ctx.rotate((nav.facingAngle * Math.PI) / 180);

        // Draw arrow
        this.ctx.fillStyle = this.playerColor;
        this.ctx.beginPath();
        this.ctx.moveTo(this.tileSize / 2, 0);
        this.ctx.lineTo(-this.tileSize / 2, -this.tileSize / 3);
        this.ctx.lineTo(-this.tileSize / 2, this.tileSize / 3);
        this.ctx.fill();

        this.ctx.restore();
    }

}
