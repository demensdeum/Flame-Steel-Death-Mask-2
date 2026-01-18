const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
const mapId = 'type-map-' + Date.now();
const privateUuid = 'type-user-' + Date.now();
const typesToTest = ['seeker', 'filter', 'chest'];

ws.on('open', () => {
    console.log('Connected to server');
    console.log('Registering user...');
    ws.send(JSON.stringify({ type: 'register', private_uuid: privateUuid }));
});

let currentTypeIndex = 0;

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message.type || message.error || message);

    if (message.type === 'register') {
        sendTeleport();
    } else if (message.type === 'teleport') {
        console.log(`Teleported as ${typesToTest[currentTypeIndex]}. Requesting entities...`);
        ws.send(JSON.stringify({ type: 'entities', map_id: mapId, private_uuid: privateUuid }));
    } else if (message.type === 'entities') {
        const entity = message.entities.find(e => e.map_id === mapId);
        if (entity && entity.type === typesToTest[currentTypeIndex]) {
            console.log(`SUCCESS: Found entity with type ${entity.type}`);
            currentTypeIndex++;
            if (currentTypeIndex < typesToTest.length) {
                sendTeleport();
            } else {
                console.log('All types verified successfully!');
                process.exit(0);
            }
        } else {
            console.error(`FAILED: Expected type ${typesToTest[currentTypeIndex]}, got ${entity ? entity.type : 'none'}`);
            process.exit(1);
        }
    } else if (message.error) {
        console.error('Server error:', message.error);
        process.exit(1);
    }
});

function sendTeleport() {
    const type = typesToTest[currentTypeIndex];
    console.log(`Sending teleport request with entity_type: ${type}`);
    ws.send(JSON.stringify({
        type: 'teleport',
        map_id: mapId,
        x: 10,
        y: 20,
        entity_type: type,
        private_uuid: privateUuid
    }));
}


ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    process.exit(1);
});

setTimeout(() => {
    console.error('Verification timed out');
    process.exit(1);
}, 15000);
