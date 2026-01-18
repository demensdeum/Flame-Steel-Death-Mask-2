const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
const privateUuid = 'tele-user-' + Date.now();
const mapId = 'tele-map';

ws.on('open', () => {
    console.log('Connected to server');

    // Test 1: Register user
    console.log('Test 1: Registering user...');
    ws.send(JSON.stringify({ type: 'register', private_uuid: privateUuid }));
});

let registered = false;

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message.type || message.error || message);

    if (message.type === 'register') {
        registered = true;
        console.log('User registered. Test 2: Sending teleport request...');

        // Test 2: Teleport request
        ws.send(JSON.stringify({
            type: 'teleport',
            map_id: mapId,
            x: 10,
            y: 20,
            private_uuid: privateUuid
        }));
    } else if (message.type === 'teleport') {
        if (message.status === 'OK') {
            console.log('Teleport request successful!');
            process.exit(0);
        } else {
            console.error('Teleport request failed:', message);
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
