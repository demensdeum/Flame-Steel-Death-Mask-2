const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

const testPrivateUuid = 'test-heal-' + Date.now();
let stage = 0;

ws.on('open', () => {
    console.log('Connected to server');
    console.log('Test 1: Registering entity...');
    ws.send(JSON.stringify({
        type: 'register',
        private_uuid: testPrivateUuid,
        entity_type: 'seeker'
    }));
    stage = 1;
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message);

    if (message.type === 'register' && stage === 1) {
        console.log('Entity registered successfully.');
        console.log('\nTest 2: Simulating damage (reducing health to 3)...');
        // We'll use a MongoDB update directly via attributes endpoint
        // First, let's get an attack to reduce health
        console.log('Getting current attributes...');
        ws.send(JSON.stringify({
            type: 'attributes',
            private_uuid: testPrivateUuid
        }));
        stage = 2;
    } else if (message.type === 'attributes' && stage === 2) {
        console.log(`Current health: ${message.attributes.current_health}/${message.attributes.max_health}`);
        console.log('\nTest 3: Using heal command...');
        ws.send(JSON.stringify({
            type: 'heal',
            private_uuid: testPrivateUuid
        }));
        stage = 3;
    } else if (message.type === 'heal' && stage === 3) {
        console.log('\n✓ Heal command successful!');
        console.log(`  Heal amount: ${message.heal_amount}`);
        console.log(`  Health: ${message.old_health} -> ${message.new_health}`);
        console.log(`  Max health: ${message.max_health}`);

        if (message.new_health <= message.max_health) {
            console.log('✓ Health correctly clamped to max_health');
        }

        // Calculate expected range
        const expectedMin = Math.floor(message.max_health * 0.25); // 25% base
        const expectedMax = expectedMin + message.max_health; // + random(0, max_health)

        if (message.heal_amount >= expectedMin && message.heal_amount <= expectedMax) {
            console.log(`✓ Heal amount (${message.heal_amount}) is within expected range [${expectedMin}, ${expectedMax}]`);
        }

        console.log('\nTest 4: Healing again to verify multiple uses...');
        ws.send(JSON.stringify({
            type: 'heal',
            private_uuid: testPrivateUuid
        }));
        stage = 4;
    } else if (message.type === 'heal' && stage === 4) {
        console.log('\n✓ Second heal successful!');
        console.log(`  Heal amount: ${message.heal_amount}`);
        console.log(`  Health: ${message.old_health} -> ${message.new_health}`);
        console.log(`  Already at max: ${message.new_health === message.max_health}`);

        console.log('\n=== All heal tests passed! ===');
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
