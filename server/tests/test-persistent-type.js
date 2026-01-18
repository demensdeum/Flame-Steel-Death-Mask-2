const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
const mapId = 'pers-map-' + Date.now();
const privateUuid = 'pers-user-' + Date.now();
const testType = 'chest';

ws.on('open', () => {
    console.log('Connected to server');
    console.log(`Registering user with entity_type: ${testType}...`);
    ws.send(JSON.stringify({ type: 'register', private_uuid: privateUuid, entity_type: testType }));
});


ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message.type || message.error || message);

    if (message.type === 'register') {
        console.log('User registered. Sending teleport request (no type provided)...');
        ws.send(JSON.stringify({
            type: 'teleport',
            map_id: mapId,
            x: 5,
            y: 5,
            private_uuid: privateUuid
        }));
    } else if (message.type === 'teleport') {
        console.log('Teleported successfully. Requesting entities to verify type...');
        ws.send(JSON.stringify({ type: 'entities', map_id: mapId, private_uuid: privateUuid }));
    } else if (message.type === 'entities') {
        const entity = message.entities.find(e => e.public_uuid === message.public_uuid || e.map_id === mapId);
        if (entity && entity.type === testType) {
            console.log(`SUCCESS: Entity has correct persistent type: ${entity.type}`);
            process.exit(0);
        } else {
            console.error(`FAILED: Expected type ${testType}, got ${entity ? entity.type : 'none'}`);
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
}, 10000);
