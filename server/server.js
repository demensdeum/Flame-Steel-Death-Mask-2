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
    const numRooms = 5 + Math.floor(Math.random() * 4); // 5 to 9 rooms

    for (let i = 0; i < numRooms; i++) {
        const w = 3 + Math.floor(Math.random() * 3); // 3 to 6
        const h = 3 + Math.floor(Math.random() * 3); // 3 to 6
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



const port = process.env.PORT || 8080;

Promise.all([connectMongo(), connectRedis()]).then(() => {
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
                                max_health: 10
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

                    const keys = await redisClient.keys('user:pos:*');

                    const entities = [];

                    for (const key of keys) {
                        const data = await redisClient.get(key);
                        if (data) {
                            const entity = JSON.parse(data);
                            if (entity.map_id === map_id) {
                                entities.push({
                                    public_uuid: entity.public_uuid,
                                    x: entity.x,
                                    y: entity.y,
                                    map_id: entity.map_id,
                                    type: entity.type
                                });

                            }
                        }
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

