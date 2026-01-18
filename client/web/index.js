const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the src directory
app.use(express.static(path.join(__dirname, 'src')));

app.listen(port, () => {
    console.log(`Web client server running at http://localhost:${port}`);
});
