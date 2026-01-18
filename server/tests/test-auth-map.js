const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
const privateUuid = 'auth-user-' + Date.now();
const mapId = 'auth-map-' + Date.now();

ws.on('open', () => {
    console.log('Connected to server');

    // Test 1: Try unauthorized map request
    console.log('Test 1: Sending map request without registration (should fail)');
    ws.send(JSON.stringify({ type: 'map', id: mapId, private_uuid: privateUuid }));
});

let registered = false;

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message.type || message.error || message);

    if (message.error === 'Unauthorized: invalid private_uuid' && !registered) {
        console.log('Expected unauthorized error received.');

        // Test 2: Register user
        console.log('Test 2: Registering user...');
        ws.send(JSON.stringify({ type: 'register', private_uuid: privateUuid }));
        registered = true;
    } else if (message.type === 'register' && registered) {
        console.log('User registered. Test 3: Sending authorized map request...');

        // Test 3: Authorized map request
        ws.send(JSON.stringify({ type: 'map', id: mapId, private_uuid: privateUuid }));
    } else if (message.type === 'map') {
        console.log('Authorized map request successful!');
        process.exit(0);
    } else if (message.error) {
        console.error('Unexpected server error:', message.error);
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
