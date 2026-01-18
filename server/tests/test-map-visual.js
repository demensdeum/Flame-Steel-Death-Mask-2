const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
const mapId = 'visual-map-' + Date.now();

ws.on('open', () => {
    console.log('Connected to server');
    ws.send(JSON.stringify({ type: 'map', id: mapId }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.type === 'map') {
        console.log('Map received:');
        message.data.grid.forEach(row => {
            console.log(row);
        });
        process.exit(0);
    } else {
        console.error('Unexpected response:', message);
        process.exit(1);
    }
});

setTimeout(() => {
    console.error('Verification timed out');
    process.exit(1);
}, 5000);
