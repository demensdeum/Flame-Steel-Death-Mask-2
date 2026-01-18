const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3000;

// Proxy WebSocket requests to the backend server
const wsProxy = createProxyMiddleware({
    target: process.env.SERVER_URL || 'http://localhost:8080',
    ws: true,
    changeOrigin: true,
    logLevel: 'debug'
});

app.use('/socket', wsProxy);

// Serve static files from the src directory
app.use(express.static(path.join(__dirname, 'src')));

app.listen(port, () => {
    console.log(`Web client server running at http://localhost:${port}`);
});

