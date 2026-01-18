const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
const mapId = 'ent-map-' + Date.now();
const user1 = 'ent-user1-' + Date.now();
const user2 = 'ent-user2-' + Date.now();

ws.on('open', async () => {
    console.log('Connected to server');

    // Test 1: Register and teleport user 1
    console.log('Registering and teleporting user 1...');
    ws.send(JSON.stringify({ type: 'register', private_uuid: user1 }));
});

let stage = 0;

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message.type || message.error || message);

    if (message.type === 'register' && stage === 0) {
        ws.send(JSON.stringify({ type: 'teleport', map_id: mapId, x: 1, y: 1, private_uuid: user1 }));
        stage = 1;
    } else if (message.type === 'teleport' && stage === 1) {
        console.log('User 1 teleported. Registering and teleporting user 2...');
        ws.send(JSON.stringify({ type: 'register', private_uuid: user2 }));
        stage = 2;
    } else if (message.type === 'register' && stage === 2) {
        ws.send(JSON.stringify({ type: 'teleport', map_id: mapId, x: 2, y: 2, private_uuid: user2 }));
        stage = 3;
    } else if (message.type === 'teleport' && stage === 3) {
        console.log('User 2 teleported. Requesting entities...');
        ws.send(JSON.stringify({ type: 'entities', map_id: mapId, private_uuid: user1 }));
        stage = 4;
    } else if (message.type === 'entities') {

        console.log(`Entities on ${message.map_id}:`, message.entities.length);
        if (message.entities.length >= 2) {
            console.log('Entities retrieval SUCCESS!');
            process.exit(0);
        } else {
            console.error('Entities retrieval FAILED: expected at least 2 entities.');
            process.exit(1);
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
}, 15000);
