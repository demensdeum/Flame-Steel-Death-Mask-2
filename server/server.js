const { WebSocketServer } = require('ws');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const { createClient } = require('redis');


const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = 'flame-steel-death-mask-2';
let db;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient;

async function connectMongo() {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(dbName);
}

async function connectRedis() {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    await redisClient.connect();
    console.log('Connected to Redis');
}


function generateMap(id) {
    const width = 100;
    const height = 100;
    const grid = Array.from({ length: height }, () => Array(width).fill('X'));

    const rooms = [];
    const numRooms = 15 + Math.floor(Math.random() * 20); // 5 to 9 rooms

    for (let i = 0; i < numRooms; i++) {
        const w = 3 + Math.floor(Math.random() * 10); // 3 to 6
        const h = 3 + Math.floor(Math.random() * 10); // 3 to 6
        const x = Math.floor(Math.random() * (width - w - 2)) + 1;
        const y = Math.floor(Math.random() * (height - h - 2)) + 1;

        for (let ry = y; ry < y + h; ry++) {
            for (let rx = x; rx < x + w; rx++) {
                grid[ry][rx] = '_';
            }
        }

        rooms.push({ x: Math.floor(x + w / 2), y: Math.floor(y + h / 2) });
    }

    for (let i = 0; i < rooms.length - 1; i++) {
        const start = rooms[i];
        const end = rooms[i + 1];

        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        for (let cx = minX; cx <= maxX; cx++) {
            grid[start.y][cx] = '_';
        }

        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        for (let cy = minY; cy <= maxY; cy++) {
            grid[cy][end.x] = '_';
        }
    }

    return {
        id,
        grid: grid.map(row => row.join('')),
        version: 2
    };
}




async function startFilterSpawner() {
    const minDelay = 5000;
    const maxDelay = 60000;
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    setTimeout(async () => {
        try {
            // 1. Find all seekers
            const keys = await redisClient.keys('user:pos:*');
            const seekers = [];

            for (const key of keys) {
                const data = await redisClient.get(key);
                if (data) {
                    const entity = JSON.parse(data);
                    if (entity.type === 'seeker') {
                        seekers.push(entity);
                    }
                }
            }

            if (seekers.length > 0) {
                // 2. Pick a random seeker
                const randomSeeker = seekers[Math.floor(Math.random() * seekers.length)];

                // 3. Generate spawn position near seeker
                // Random offset between -3 and 3 for both x and y, excluding 0,0 if we wanted, but overlapping is fine?
                // Let's avoid exact overlap just in case, but simple collision isn't strictly prohibited by the prompt.
                // Prompt says "near".
                const offsetX = Math.floor(Math.random() * 7) - 3; // -3 to 3
                const offsetY = Math.floor(Math.random() * 7) - 3; // -3 to 3
                const spawnX = Math.max(0, Math.min(99, randomSeeker.x + offsetX)); // Clamp to 0-99 map bounds
                const spawnY = Math.max(0, Math.min(99, randomSeeker.y + offsetY));

                // 4. Create filter entity
                const usersCollection = db.collection('users');
                const privateUuid = crypto.randomUUID();
                const publicUuid = crypto.randomUUID();

                const filterEntity = {
                    private_uuid: privateUuid,
                    public_uuid: publicUuid,
                    type: 'filter',
                    attributes: {
                        bits: 0,
                        attack: 1,
                        defence: 1,
                        current_health: 10,
                        max_health: 10,
                        heal_items: 0
                    }
                };

                await usersCollection.insertOne(filterEntity);

                // 5. Place in Redis
                const redisKey = `user:pos:${privateUuid}`;
                const entityData = {
                    private_uuid: privateUuid,
                    public_uuid: publicUuid,
                    x: spawnX,
                    y: spawnY,
                    map_id: randomSeeker.map_id,
                    type: 'filter'
                };

                // Add to map set
                const mapSetKey = `map:entities:${randomSeeker.map_id}`;
                await redisClient.sAdd(mapSetKey, privateUuid);

                await redisClient.set(redisKey, JSON.stringify(entityData), {
                    EX: 600 // 10 minutes expiry, same as players for now
                });

                console.log(`Spawned filter ${publicUuid} near seeker ${randomSeeker.public_uuid} at (${spawnX}, ${spawnY}) on map ${randomSeeker.map_id}`);
            }
        } catch (err) {
            console.error('Error in filter spawner:', err);
        }

        // Schedule next spawn
        startFilterSpawner();
    }, delay);
}

const port = process.env.PORT || 8080;

Promise.all([connectMongo(), connectRedis()]).then(() => {
    startFilterSpawner();
    const wss = new WebSocketServer({ port });
    console.log(`WebSocket server started on port ${port}`);


    wss.on('connection', (ws) => {

        console.log('Client connected');

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data);
                console.log('Received message:', message);

                if (message.type === 'health') {
                    const response = JSON.stringify({ status: 'OK' });
                    ws.send(response);
                    console.log('Sent health check response:', response);
                } else if (message.type === 'map') {
                    const mapId = message.id;
                    const privateUuid = message.private_uuid;

                    if (!mapId || !privateUuid) {
                        ws.send(JSON.stringify({ error: 'Missing map id or private_uuid' }));
                        return;
                    }

                    const usersCollection = db.collection('users');
                    const user = await usersCollection.findOne({ private_uuid: privateUuid });

                    if (!user) {
                        console.log(`Unauthorized map request with private_uuid: ${privateUuid}`);
                        ws.send(JSON.stringify({ error: 'Unauthorized: invalid private_uuid' }));
                        return;
                    }

                    const mapsCollection = db.collection('maps');

                    let map = await mapsCollection.findOne({ id: mapId });

                    if (!map) {
                        console.log(`Map ${mapId} not found, generating new one...`);
                        map = generateMap(mapId);
                        await mapsCollection.insertOne(map);
                    } else {
                        console.log(`Map ${mapId} found in database.`);
                    }

                    ws.send(JSON.stringify({ type: 'map', data: map }));
                } else if (message.type === 'register') {
                    const { private_uuid, entity_type } = message;
                    if (!private_uuid) {
                        ws.send(JSON.stringify({ error: 'Missing private_uuid' }));
                        return;
                    }

                    const entityTypes = ['seeker', 'filter', 'chest', 'teleport'];
                    const usersCollection = db.collection('users');
                    let user = await usersCollection.findOne({ private_uuid: private_uuid });

                    if (!user) {
                        if (!entity_type || !entityTypes.includes(entity_type)) {
                            ws.send(JSON.stringify({ error: `Registration requires a valid entity_type for new users: ${entityTypes.join(', ')}` }));
                            return;
                        }
                        console.log(`New user registration for ${private_uuid} as ${entity_type}`);
                        const publicUuid = crypto.randomUUID();
                        user = {
                            private_uuid: private_uuid,
                            public_uuid: publicUuid,
                            type: entity_type,
                            attributes: {
                                bits: 0,
                                attack: 1,
                                defence: 1,
                                current_health: 10,
                                max_health: 10,
                                heal_items: 0
                            }
                        };
                        await usersCollection.insertOne(user);
                    } else {
                        console.log(`User ${private_uuid} already registered.`);
                        if (entity_type && entityTypes.includes(entity_type) && entity_type !== user.type) {
                            console.log(`Updating user ${private_uuid} entity_type to ${entity_type}`);
                            await usersCollection.updateOne({ private_uuid: private_uuid }, { $set: { type: entity_type } });
                            user.type = entity_type;
                        }
                    }

                    ws.send(JSON.stringify({ type: 'register', public_uuid: user.public_uuid, entity_type: user.type }));


                } else if (message.type === 'teleport') {
                    const { map_id, x, y, private_uuid } = message;

                    if (!map_id || x === undefined || y === undefined || !private_uuid) {
                        ws.send(JSON.stringify({ error: 'Missing parameters for teleport' }));
                        return;
                    }

                    const usersCollection = db.collection('users');
                    const user = await usersCollection.findOne({ private_uuid: private_uuid });

                    if (!user) {
                        console.log(`Unauthorized teleport request with private_uuid: ${private_uuid}`);
                        ws.send(JSON.stringify({ error: 'Unauthorized: invalid private_uuid' }));
                        return;
                    }

                    const userData = {
                        private_uuid: user.private_uuid,
                        public_uuid: user.public_uuid,
                        x,
                        y,
                        map_id,
                        type: user.type
                    };

                    const redisKey = `user:pos:${private_uuid}`;

                    // --- Handle Map-Based Indexing in Redis ---
                    const oldDataRaw = await redisClient.get(redisKey);
                    if (oldDataRaw) {
                        const oldData = JSON.parse(oldDataRaw);
                        if (oldData.map_id !== map_id) {
                            // Remove from old map Set
                            const oldMapSetKey = `map:entities:${oldData.map_id}`;
                            await redisClient.sRem(oldMapSetKey, private_uuid);
                        }
                    }

                    // Add to current map Set
                    const currentMapSetKey = `map:entities:${map_id}`;
                    await redisClient.sAdd(currentMapSetKey, private_uuid);

                    await redisClient.set(redisKey, JSON.stringify(userData), {
                        EX: 600 // 10 minutes
                    });

                    console.log(`User ${private_uuid} teleported to ${map_id} at (${x}, ${y}) as ${user.type}`);

                    ws.send(JSON.stringify({ type: 'teleport', status: 'OK', public_uuid: user.public_uuid }));

                } else if (message.type === 'entities') {
                    const { map_id, private_uuid } = message;
                    if (!map_id || !private_uuid) {
                        ws.send(JSON.stringify({ error: 'Missing map_id or private_uuid' }));
                        return;
                    }

                    const usersCollection = db.collection('users');
                    const user = await usersCollection.findOne({ private_uuid: private_uuid });

                    if (!user) {
                        console.log(`Unauthorized entities request with private_uuid: ${private_uuid}`);
                        ws.send(JSON.stringify({ error: 'Unauthorized: invalid private_uuid' }));
                        return;
                    }

                    const mapSetKey = `map:entities:${map_id}`;
                    const entityPrivateUuids = await redisClient.sMembers(mapSetKey);

                    const entities = [];
                    const expiredUuids = [];

                    for (const entityUuid of entityPrivateUuids) {
                        const redisKey = `user:pos:${entityUuid}`;
                        const data = await redisClient.get(redisKey);
                        if (data) {
                            const entity = JSON.parse(data);
                            // Double check if map matches (in case of stale set data)
                            if (entity.map_id === map_id) {
                                entities.push({
                                    public_uuid: entity.public_uuid,
                                    x: entity.x,
                                    y: entity.y,
                                    map_id: entity.map_id,
                                    type: entity.type
                                });
                            } else {
                                expiredUuids.push(entityUuid);
                            }
                        } else {
                            expiredUuids.push(entityUuid);
                        }
                    }

                    // Cleanup expired or moved entities from this map's Set
                    if (expiredUuids.length > 0) {
                        await redisClient.sRem(mapSetKey, expiredUuids);
                        console.log(`Cleaned up ${expiredUuids.length} expired entities from map ${map_id}`);
                    }

                    ws.send(JSON.stringify({ type: 'entities', map_id, entities }));
                } else if (message.type === 'attributes') {
                    const { private_uuid } = message;
                    if (!private_uuid) {
                        ws.send(JSON.stringify({ error: 'Missing private_uuid' }));
                        return;
                    }

                    const usersCollection = db.collection('users');
                    const user = await usersCollection.findOne({ private_uuid: private_uuid });

                    if (!user) {
                        console.log(`Unauthorized attributes request with private_uuid: ${private_uuid}`);
                        ws.send(JSON.stringify({ error: 'Unauthorized: invalid private_uuid' }));
                        return;
                    }

                    ws.send(JSON.stringify({
                        type: 'attributes',
                        public_uuid: user.public_uuid,
                        attributes: user.attributes
                    }));
                } else if (message.type === 'heal') {
                    const { private_uuid } = message;

                    if (!private_uuid) {
                        ws.send(JSON.stringify({ error: 'Missing private_uuid' }));
                        return;
                    }

                    const usersCollection = db.collection('users');
                    const user = await usersCollection.findOne({ private_uuid: private_uuid });

                    if (!user) {
                        console.log(`Unauthorized heal request with private_uuid: ${private_uuid}`);
                        ws.send(JSON.stringify({ error: 'Unauthorized: invalid private_uuid' }));
                        return;
                    }

                    // Calculate heal amount: 25% of max_health + random(0, max_health)
                    const baseHeal = Math.floor(user.attributes.max_health * 0.25);
                    const randomBonus = Math.floor(Math.random() * (user.attributes.max_health + 1));
                    const totalHeal = baseHeal + randomBonus;

                    const oldHealth = user.attributes.current_health;
                    const newHealth = Math.min(
                        user.attributes.max_health,
                        user.attributes.current_health + totalHeal
                    );

                    // Update health in database
                    await usersCollection.updateOne(
                        { private_uuid: private_uuid },
                        { $set: { 'attributes.current_health': newHealth } }
                    );

                    console.log(`Heal: ${user.public_uuid} healed for ${totalHeal} (base: ${baseHeal}, bonus: ${randomBonus}). Health: ${oldHealth} -> ${newHealth}`);

                    ws.send(JSON.stringify({
                        type: 'heal',
                        status: 'OK',
                        heal_amount: totalHeal,
                        old_health: oldHealth,
                        new_health: newHealth,
                        max_health: user.attributes.max_health
                    }));
                } else if (message.type === 'attack') {
                    const { target_public_uuid, attacker_private_uuid } = message;

                    if (!target_public_uuid || !attacker_private_uuid) {
                        ws.send(JSON.stringify({ error: 'Missing target_public_uuid or attacker_private_uuid' }));
                        return;
                    }

                    // 1. Authenticate attacker
                    const usersCollection = db.collection('users');
                    const attacker = await usersCollection.findOne({ private_uuid: attacker_private_uuid });

                    if (!attacker) {
                        console.log(`Unauthorized attack request with private_uuid: ${attacker_private_uuid}`);
                        ws.send(JSON.stringify({ error: 'Unauthorized: invalid attacker_private_uuid' }));
                        return;
                    }

                    // 2. Get attacker position from Redis
                    const attackerRedisKey = `user:pos:${attacker_private_uuid}`;
                    const attackerPosData = await redisClient.get(attackerRedisKey);

                    if (!attackerPosData) {
                        ws.send(JSON.stringify({ error: 'Attacker position not found. Must teleport first.' }));
                        return;
                    }

                    const attackerPos = JSON.parse(attackerPosData);

                    // 3. Find target entity in Redis
                    const keys = await redisClient.keys('user:pos:*');
                    let targetPos = null;
                    let targetPrivateUuid = null;

                    for (const key of keys) {
                        const data = await redisClient.get(key);
                        if (data) {
                            const entity = JSON.parse(data);
                            if (entity.public_uuid === target_public_uuid) {
                                targetPos = entity;
                                targetPrivateUuid = entity.private_uuid;
                                break;
                            }
                        }
                    }

                    if (!targetPos) {
                        ws.send(JSON.stringify({ error: 'Target not found or not on any map' }));
                        return;
                    }

                    // 4. Validate same map
                    if (attackerPos.map_id !== targetPos.map_id) {
                        ws.send(JSON.stringify({ error: 'Target is on a different map' }));
                        return;
                    }

                    // 5. Validate distance (must be exactly 1 cell, horizontal or vertical)
                    const manhattanDistance = Math.abs(attackerPos.x - targetPos.x) + Math.abs(attackerPos.y - targetPos.y);

                    if (manhattanDistance !== 1) {
                        ws.send(JSON.stringify({ error: 'Target must be exactly 1 cell away (horizontally or vertically)' }));
                        return;
                    }

                    // 6. Get target user attributes
                    const target = await usersCollection.findOne({ private_uuid: targetPrivateUuid });

                    if (!target) {
                        ws.send(JSON.stringify({ error: 'Target user not found in database' }));
                        return;
                    }

                    // 7. Calculate damage: max(0, attacker.attack - random(0, target.defence))
                    const defenceReduction = Math.floor(Math.random() * (target.attributes.defence + 1));
                    const damage = Math.max(0, attacker.attributes.attack - defenceReduction);

                    // 8. Update target health
                    const newHealth = Math.max(0, target.attributes.current_health - damage);
                    await usersCollection.updateOne(
                        { private_uuid: targetPrivateUuid },
                        { $set: { 'attributes.current_health': newHealth } }
                    );

                    console.log(`Attack: ${attacker.public_uuid} attacked ${target.public_uuid} for ${damage} damage. Target health: ${target.attributes.current_health} -> ${newHealth}`);

                    // 9. Check if target is dead (filter type only)
                    let entityRemoved = false;
                    if (newHealth <= 0 && target.type === 'filter') {
                        // Remove from MongoDB
                        await usersCollection.deleteOne({ private_uuid: targetPrivateUuid });

                        // Remove from Redis
                        const targetRedisKey = `user:pos:${targetPrivateUuid}`;
                        await redisClient.del(targetRedisKey);

                        entityRemoved = true;
                        console.log(`Filter entity ${target.public_uuid} removed (health <= 0)`);
                    }

                    // 10. Send response
                    ws.send(JSON.stringify({
                        type: 'attack',
                        status: 'OK',
                        damage: damage,
                        target_public_uuid: target.public_uuid,
                        target_remaining_health: newHealth,
                        entity_removed: entityRemoved
                    }));
                } else if (message.type === 'unlock') {
                    const { target_public_uuid, unlocker_private_uuid } = message;

                    if (!target_public_uuid || !unlocker_private_uuid) {
                        ws.send(JSON.stringify({ error: 'Missing target_public_uuid or unlocker_private_uuid' }));
                        return;
                    }

                    // 1. Authenticate player
                    const usersCollection = db.collection('users');
                    const player = await usersCollection.findOne({ private_uuid: unlocker_private_uuid });

                    if (!player) {
                        ws.send(JSON.stringify({ error: 'Unauthorized: invalid unlocker_private_uuid' }));
                        return;
                    }

                    // 2. Get player position from Redis
                    const playerRedisKey = `user:pos:${unlocker_private_uuid}`;
                    const playerPosData = await redisClient.get(playerRedisKey);

                    if (!playerPosData) {
                        ws.send(JSON.stringify({ error: 'Player position not found. Must teleport first.' }));
                        return;
                    }

                    const playerPos = JSON.parse(playerPosData);

                    // 3. Find target chest in Redis
                    const keys = await redisClient.keys('user:pos:*');
                    let chestPos = null;
                    let chestPrivateUuid = null;

                    for (const key of keys) {
                        const data = await redisClient.get(key);
                        if (data) {
                            const entity = JSON.parse(data);
                            if (entity.public_uuid === target_public_uuid) {
                                chestPos = entity;
                                chestPrivateUuid = entity.private_uuid;
                                break;
                            }
                        }
                    }

                    if (!chestPos) {
                        ws.send(JSON.stringify({ error: 'Chest not found or not on any map' }));
                        return;
                    }

                    // 4. Validate same map and distance
                    if (playerPos.map_id !== chestPos.map_id) {
                        ws.send(JSON.stringify({ error: 'Chest is on a different map' }));
                        return;
                    }

                    const distance = Math.abs(playerPos.x - chestPos.x) + Math.abs(playerPos.y - chestPos.y);
                    if (distance !== 1) {
                        ws.send(JSON.stringify({ error: 'Chest must be exactly 1 cell away' }));
                        return;
                    }

                    // 5. Get chest entity from MongoDB
                    const chest = await usersCollection.findOne({ private_uuid: chestPrivateUuid });
                    if (!chest || chest.type !== 'chest') {
                        ws.send(JSON.stringify({ error: 'Target is not a valid chest' }));
                        return;
                    }

                    // 6. Cost check
                    const chestBits = chest.attributes.bits || 0;
                    if (chestBits < 0) {
                        const price = Math.abs(chestBits);
                        if (player.attributes.bits < price) {
                            ws.send(JSON.stringify({ type: 'unlock', status: 'FAILED', error: `Not enough bits. Need ${price}, have ${player.attributes.bits}` }));
                            return;
                        }
                    }

                    // 7. Transfer loot and update player attributes
                    const loot = chest.attributes;
                    const updateData = {
                        'attributes.bits': player.attributes.bits + (loot.bits || 0),
                        'attributes.attack': player.attributes.attack + (loot.attack || 0),
                        'attributes.defence': player.attributes.defence + (loot.defence || 0),
                        'attributes.max_health': player.attributes.max_health + (loot.max_health || 0),
                        'attributes.heal_items': player.attributes.heal_items + (loot.heal_items || 0)
                    };

                    // Health transfer
                    const healthGain = loot.current_health || 0;
                    const newMaxHealth = updateData['attributes.max_health'];
                    updateData['attributes.current_health'] = Math.min(newMaxHealth, player.attributes.current_health + healthGain);

                    await usersCollection.updateOne({ private_uuid: unlocker_private_uuid }, { $set: updateData });

                    // 8. Remove chest from DB and Redis
                    await usersCollection.deleteOne({ private_uuid: chestPrivateUuid });
                    const targetRedisKey = `user:pos:${chestPrivateUuid}`;
                    await redisClient.del(targetRedisKey);

                    console.log(`Unlock: ${player.public_uuid} unlocked chest ${chest.public_uuid}. Loot: ${JSON.stringify(loot)}`);

                    ws.send(JSON.stringify({
                        type: 'unlock',
                        status: 'OK',
                        loot: loot
                    }));
                }



            } catch (error) {
                console.error('Error processing message:', error);
                ws.send(JSON.stringify({ error: 'Internal server error or invalid protocol' }));
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });
});

