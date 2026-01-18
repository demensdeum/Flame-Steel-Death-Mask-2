const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

let attacker_private_uuid = 'test-attacker-123';
let target_private_uuid = 'test-target-456';
let attacker_public_uuid = null;
let target_public_uuid = null;
const mapId = 'test-map-attack';

let stage = 0;

ws.on('open', () => {
    console.log('Connected to server');
    console.log('Test 1: Registering attacker...');
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
        console.log('Test 2: Teleporting attacker to (5, 5)...');
        ws.send(JSON.stringify({
            type: 'teleport',
            map_id: mapId,
            x: 5,
            y: 5,
            private_uuid: attacker_private_uuid
        }));
        stage = 2;
    } else if (message.type === 'teleport' && stage === 2) {
        console.log('Attacker teleported successfully.');
        console.log('Test 3: Registering target...');
        ws.send(JSON.stringify({
            type: 'register',
            private_uuid: target_private_uuid,
            entity_type: 'filter'
        }));
        stage = 3;
    } else if (message.type === 'register' && stage === 3) {
        target_public_uuid = message.public_uuid;
        console.log(`Target registered with public_uuid: ${target_public_uuid}`);
        console.log('Test 4: Teleporting target to (5, 6) - adjacent to attacker...');
        ws.send(JSON.stringify({
            type: 'teleport',
            map_id: mapId,
            x: 5,
            y: 6,
            private_uuid: target_private_uuid
        }));
        stage = 4;
    } else if (message.type === 'teleport' && stage === 4) {
        console.log('Target teleported successfully. Both entities are now adjacent.');
        console.log('Test 5: Attempting attack (should succeed)...');
        ws.send(JSON.stringify({
            type: 'attack',
            target_public_uuid: target_public_uuid,
            attacker_private_uuid: attacker_private_uuid
        }));
        stage = 5;
    } else if (message.type === 'attack' && stage === 5) {
        if (message.status === 'OK') {
            console.log('✓ Attack successful!');
            console.log(`  Damage dealt: ${message.damage}`);
            console.log(`  Target remaining health: ${message.target_remaining_health}`);

            console.log('Test 6: Teleporting target to (7, 7) - not adjacent...');
            ws.send(JSON.stringify({
                type: 'teleport',
                map_id: mapId,
                x: 7,
                y: 7,
                private_uuid: target_private_uuid
            }));
            stage = 6;
        } else {
            console.error('✗ Attack failed:', message);
            ws.close();
        }
    } else if (message.type === 'teleport' && stage === 6) {
        console.log('Target moved to distant position.');
        console.log('Test 7: Attempting attack from distance (should fail)...');
        ws.send(JSON.stringify({
            type: 'attack',
            target_public_uuid: target_public_uuid,
            attacker_private_uuid: attacker_private_uuid
        }));
        stage = 7;
    } else if (message.error && stage === 7) {
        console.log('✓ Attack correctly rejected (distance check):', message.error);

        console.log('Test 8: Teleporting target to different map...');
        ws.send(JSON.stringify({
            type: 'teleport',
            map_id: 'different-map',
            x: 5,
            y: 6,
            private_uuid: target_private_uuid
        }));
        stage = 8;
    } else if (message.type === 'teleport' && stage === 8) {
        console.log('Target moved to different map.');
        console.log('Test 9: Attempting attack on different map (should fail)...');
        ws.send(JSON.stringify({
            type: 'attack',
            target_public_uuid: target_public_uuid,
            attacker_private_uuid: attacker_private_uuid
        }));
        stage = 9;
    } else if (message.error && stage === 9) {
        console.log('✓ Attack correctly rejected (different map):', message.error);

        console.log('\n=== All tests passed! ===');
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
