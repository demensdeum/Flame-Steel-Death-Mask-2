const { WebSocketServer } = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

console.log(`WebSocket server started on port ${port}`);

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('Received message:', message);

            if (message.type === 'health') {
                const response = JSON.stringify({ status: 'OK' });
                ws.send(response);
                console.log('Sent health check response:', response);
            }
        } catch (error) {
            console.error('Error parsing JSON message:', error);
            ws.send(JSON.stringify({ error: 'Invalid JSON protocol' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
