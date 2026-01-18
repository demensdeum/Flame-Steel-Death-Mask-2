const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
const mapId = 'test-map-' + Date.now();

ws.on('open', () => {
    console.log('Connected to server');

    // Test 1: Generate new map
    console.log(`Requesting new map with id: ${mapId}`);
    ws.send(JSON.stringify({ type: 'map', id: mapId }));
});

let firstMapGrid = null;

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received from server:', message.type || message.error || message);

    if (message.type === 'map') {
        if (!firstMapGrid) {
            firstMapGrid = JSON.stringify(message.data.grid);
            console.log('First map received and stored for comparison.');

            // Test 2: Request the same map again to verify persistence
            console.log(`Requesting the same map again with id: ${mapId}`);
            ws.send(JSON.stringify({ type: 'map', id: mapId }));
        } else {
            const secondMapGrid = JSON.stringify(message.data.grid);
            if (firstMapGrid === secondMapGrid) {
                console.log('Persistence verification SUCCESS: Received the same map grid.');
                process.exit(0);
            } else {
                console.error('Persistence verification FAILED: Received a different map grid.');
                process.exit(1);
            }
        }
    } else if (message.error) {
        console.error('Server error:', message.error);
        process.exit(1);
    }
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    process.exit(1);
});

setTimeout(() => {
    console.error('Verification timed out');
    process.exit(1);
}, 10000);
