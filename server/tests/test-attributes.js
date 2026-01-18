const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
const privateUuid = 'attr-user-' + Date.now();

ws.on('open', () => {
    console.log('Connected to server');

    // Test: Register user
    console.log('Registering user...');
    ws.send(JSON.stringify({ type: 'register', private_uuid: privateUuid }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message.type || message.error || message);

    if (message.type === 'register') {
        console.log('User registered. Requesting attributes...');
        ws.send(JSON.stringify({ type: 'attributes', private_uuid: privateUuid }));
    } else if (message.type === 'attributes') {
        const attr = message.attributes;
        console.log('Attributes received:', attr);

        const expected = {
            bits: 0,
            attack: 1,
            defence: 1,
            current_health: 10,
            max_health: 10
        };

        let match = true;
        for (const key in expected) {
            if (attr[key] !== expected[key]) {
                console.error(`Mismatch for ${key}: expected ${expected[key]}, got ${attr[key]}`);
                match = false;
            }
        }

        if (match) {
            console.log('Attributes verification SUCCESS!');
            process.exit(0);
        } else {
            console.error('Attributes verification FAILED!');
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
