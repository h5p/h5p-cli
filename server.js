const express = require('express');
const config = require('./config.js');
const multer = require('multer')({ dest: `./${config.folders.temp}` });
const api = require('./api.js');
let app = express();
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.get('/dashboard', api.dashboard);
app.get('/projects', api.projects);
app.get('/runnable', api.contentTypes);
app.get('/export/:library/:folder', api.export);
app.post('/import/:folder', multer.single('file'), api.import);
app.post('/create/:type/:folder', api.create);
app.post('/remove/:folder', api.remove);
app.get('/split/:library/:folder', api.splitView);
app.get('/view/:library/:folder', api.view);
app.get('/edit/:library/:folder/libraries', api.ajaxLibraries);
app.get('/edit/:library/:folder', api.edit);
app.post('/edit/:library/:folder/libraries', api.ajaxLibraries);
app.post('/edit/:library/:folder/files', multer.single('file'), api.uploadFile);
app.post('/edit/:library/:folder', multer.none(), api.saveContent);
app.use(express.static('./'));
app.listen(config.port, () => {
  console.log(`h5p content type development server running on port ${config.port}`);
});
