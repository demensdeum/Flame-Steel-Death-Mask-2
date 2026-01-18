const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
const privateUuid = 'test-user-' + Date.now();

ws.on('open', () => {
    console.log('Connected to server');

    // Test 1: Register new user
    console.log(`Registering new user with private_uuid: ${privateUuid}`);
    ws.send(JSON.stringify({ type: 'register', private_uuid: privateUuid }));
});

let firstPublicUuid = null;

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received from server:', message.type || message.error || message);

    if (message.type === 'register') {
        if (!firstPublicUuid) {
            firstPublicUuid = message.public_uuid;
            console.log(`Received public_uuid: ${firstPublicUuid}`);
            console.log('Verifying persistence by registering again...');

            // Test 2: Register same user again to verify persistence
            ws.send(JSON.stringify({ type: 'register', private_uuid: privateUuid }));
        } else {
            const secondPublicUuid = message.public_uuid;
            if (firstPublicUuid === secondPublicUuid) {
                console.log('Registration persistence verification SUCCESS: Received the same public_uuid.');
                process.exit(0);
            } else {
                console.error('Registration persistence verification FAILED: Received a different public_uuid.');
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
