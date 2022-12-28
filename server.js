const express = require('express');
const config = require('./config.js');
//const multer = require('multer')({ dest: `./${config.folders.uploads}` });
const api = require('./api.js');
let app = express();
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.get('/content/:library/:folder', api.content);
app.get('/editor/:library/:folder/libraries', api.ajaxLibraries);
app.post('/editor/:library/:folder/libraries', api.ajaxLibraries);
app.get('/editor/:library/:folder', api.editor);
app.use(express.static('./'));
app.listen(config.port, () => {
  console.log(`h5p content type development server running on port ${config.port}`);
});
