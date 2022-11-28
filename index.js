const express = require('express');
const config = require('./config.js');
const api = require('./api.js');
let app = express();
app.use(express.json());
app.listen(config.port, () => {
  console.log(`h5p-dev server running on port ${config.port}`);
});
app.get('/api', api.test);
app.use(express.static('./'));
