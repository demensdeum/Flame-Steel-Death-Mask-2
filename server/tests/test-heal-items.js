const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

const testPrivateUuid = 'test-heal-items-' + Date.now();

ws.on('open', () => {
    console.log('Connected to server');
    console.log('Test: Registering new entity to check heal_items attribute...');
    ws.send(JSON.stringify({
        type: 'register',
        private_uuid: testPrivateUuid,
        entity_type: 'seeker'
    }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message);

    if (message.type === 'register') {
        console.log('Entity registered. Requesting attributes...');
        ws.send(JSON.stringify({
            type: 'attributes',
            private_uuid: testPrivateUuid
        }));
    } else if (message.type === 'attributes') {
        console.log('\nAttributes received:');
        console.log(JSON.stringify(message.attributes, null, 2));

        if (message.attributes.heal_items !== undefined) {
            console.log('\n✓ heal_items attribute exists with value:', message.attributes.heal_items);
        } else {
            console.error('\n✗ heal_items attribute is missing!');
        }

        ws.close();
    } else if (message.error) {
        console.error('Error:', message.error);
        ws.close();
    }
});

ws.on('close', () => {
    console.log('\nDisconnected from server');
    process.exit(0);
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    process.exit(1);
});
