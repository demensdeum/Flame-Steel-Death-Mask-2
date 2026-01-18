const { WebSocketServer } = require('ws');
const { MongoClient } = require('mongodb');

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = 'gameServer';
let db;

async function connectMongo() {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(dbName);
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

connectMongo().then(() => {
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
                    if (!mapId) {
                        ws.send(JSON.stringify({ error: 'Missing map id' }));
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

