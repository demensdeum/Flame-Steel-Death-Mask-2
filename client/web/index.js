const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3000;
const baseUrl = process.env.BASE_URL || '';

// Proxy WebSocket requests to the backend server
const wsProxy = createProxyMiddleware({
    target: process.env.SERVER_URL || 'http://localhost:8080',
    ws: true,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: {
        [`^${baseUrl}/socket`]: '' // Strip prefix when sending to backend
    }
});

// Mount proxy and static files under baseUrl
app.use(`${baseUrl}/socket`, wsProxy);
app.use(baseUrl, express.static(path.join(__dirname, 'src')));


app.listen(port, () => {
    console.log(`Web client server running at http://localhost:${port}`);
});

