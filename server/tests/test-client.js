const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    console.log('Connected to server');
    const healthCheck = JSON.stringify({ type: 'health' });
    console.log('Sending:', healthCheck);
    ws.send(healthCheck);
});

ws.on('message', (data) => {
    console.log('Received from server:', data.toString());
    const message = JSON.parse(data);
    if (message.status === 'OK') {
        console.log('Health check successful!');
        process.exit(0);
    } else {
        console.error('Unexpected response:', message);
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
}, 5000);
