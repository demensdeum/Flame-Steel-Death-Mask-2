const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

let attacker_private_uuid = 'test-death-attacker-789';
let target_private_uuid = 'test-death-target-012';
let attacker_public_uuid = null;
let target_public_uuid = null;
const mapId = 'test-map-death';

let stage = 0;

ws.on('open', () => {
    console.log('Connected to server');
    console.log('Test 1: Registering attacker with high attack...');
    ws.send(JSON.stringify({
        type: 'register',
        private_uuid: attacker_private_uuid,
        entity_type: 'seeker'
    }));
    stage = 1;
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message);

    if (message.type === 'register' && stage === 1) {
        attacker_public_uuid = message.public_uuid;
        console.log(`Attacker registered with public_uuid: ${attacker_public_uuid}`);
        console.log('Test 2: Teleporting attacker...');
        ws.send(JSON.stringify({
            type: 'teleport',
            map_id: mapId,
            x: 10,
            y: 10,
            private_uuid: attacker_private_uuid
        }));
        stage = 2;
    } else if (message.type === 'teleport' && stage === 2) {
        console.log('Attacker teleported successfully.');
        console.log('Test 3: Registering target as filter type...');
        ws.send(JSON.stringify({
            type: 'register',
            private_uuid: target_private_uuid,
            entity_type: 'filter'
        }));
        stage = 3;
    } else if (message.type === 'register' && stage === 3) {
        target_public_uuid = message.public_uuid;
        console.log(`Target registered as filter with public_uuid: ${target_public_uuid}`);
        console.log('Test 4: Teleporting target adjacent to attacker...');
        ws.send(JSON.stringify({
            type: 'teleport',
            map_id: mapId,
            x: 10,
            y: 11,
            private_uuid: target_private_uuid
        }));
        stage = 4;
    } else if (message.type === 'teleport' && stage === 4) {
        console.log('Target teleported successfully.');
        console.log('Test 5: Attacking multiple times to reduce health to zero...');
        console.log('Attack #1...');
        ws.send(JSON.stringify({
            type: 'attack',
            target_public_uuid: target_public_uuid,
            attacker_private_uuid: attacker_private_uuid
        }));
        stage = 5;
    } else if (message.type === 'attack' && stage === 5) {
        console.log(`Attack #1 result: damage=${message.damage}, health=${message.target_remaining_health}, removed=${message.entity_removed}`);

        if (message.entity_removed) {
            console.log('✓ Filter entity was removed after health reached zero!');
            console.log('Test 6: Verifying entity is removed - requesting entities list...');
            ws.send(JSON.stringify({
                type: 'entities',
                map_id: mapId,
                private_uuid: attacker_private_uuid
            }));
            stage = 6;
        } else if (message.target_remaining_health > 0) {
            console.log('Attack #2...');
            ws.send(JSON.stringify({
                type: 'attack',
                target_public_uuid: target_public_uuid,
                attacker_private_uuid: attacker_private_uuid
            }));
            // Stay in stage 5 for more attacks
        } else {
            console.error('✗ Entity should have been removed but was not!');
            ws.close();
        }
    } else if (message.type === 'entities' && stage === 6) {
        const targetStillExists = message.entities.some(e => e.public_uuid === target_public_uuid);

        if (!targetStillExists) {
            console.log('✓ Confirmed: Filter entity no longer appears in entities list (removed from Redis)');
            console.log('\n=== Test passed! Filter entity removed on death ===');
        } else {
            console.error('✗ Filter entity still exists in entities list!');
        }
        ws.close();
    } else if (message.error) {
        console.error('Unexpected error:', message.error);
        ws.close();
    }
});

ws.on('close', () => {
    console.log('Disconnected from server');
    process.exit(0);
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    process.exit(1);
});
