var http = require('http');
var dispatcher = require('httpdispatcher');
var fs = require('fs');
var path = require('path');
var express = require('express');
var extend = require('node.extend');

var H5PLibrary = require('./h5p-library.js');
var H5PLibraryList = require('./h5p-library-list.js');

var pjson = require('../package.json');
var h5pIntegration = require('./h5p-integration-template.json');

var app = express();

//var h5pServer = module.exports = {};

function H5PServer(configFile) {
  this.cwd = process.cwd();
  configFile = configFile || 'h5p-server.json';

  try {
    this.config = require(path.join(this.cwd, configFile));
  } catch (err) {
    return console.error('Missing mandatory h5p-server.json in current working directory: ' + err);
  }

  var libraryList;
  var dependencies;
  var js = [];
  var css = [];

  this.libraryDir = path.join(this.cwd, this.config.libraryDir);
  this.mainLibraryDir = path.join(this.libraryDir, this.config.mainLibraryDir);
  this.contentDir = path.join(this.cwd, this.config.contentDir);

  this.libraryList = H5PLibraryList.fromDirectory(this.libraryDir);
  this.mainLibrary = H5PLibrary.fromFile(path.join(this.mainLibraryDir, 'library.json'));
  this.mainLibrary.setParentFolderName(this.config.mainLibraryDir);

  this.createDependencyList();
  this.createJsAndCssList();

  this.printConfig();
}

H5PServer.prototype.printConfig = function () {
  console.log('>>> Current setup:');
  console.log('Using main library in ' + this.mainLibraryDir);
  console.log('Fetching other libraries from ' + this.libraryDir);
  console.log('Fetching content from ' + this.contentDir);
  console.log('Main library: ' + this.mainLibrary.getTextualNameAndVersion());
  console.log('<<<\n');
};

H5PServer.prototype.start = function (done) {
  var self = this;

  app.use('/libs', express.static('libs'));
  app.use('/content', express.static(this.config.contentDir));
  app.use('/assets', express.static(__dirname + '/assets'));

  app.get("/", function(req, res) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      var currentContentName = req.query.content;
      

      var devConfig = self.getDevConfig();
      currentContentName = currentContentName || devConfig.contents[0];

      var response = '<html><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
      '<link rel="stylesheet" type="text/css" href="/assets/h5p-core/library/styles/h5p.css">' +
      '<script type="text/javascript" src="/assets/h5p-core/library/js/jquery.js"></script>' +
      '<script type="text/javascript" src="/assets/h5p-core/library/js/h5p.js"></script>' +
      '<script type="text/javascript" src="/assets/h5p-core/library/js/h5p-event-dispatcher.js"></script>' +
      '<script type="text/javascript" src="/assets/h5p-core/library/js/h5p-x-api-event.js"></script>' +
      '<script type="text/javascript" src="/assets/h5p-core/library/js/h5p-x-api.js"></script>' +
      '<script type="text/javascript" src="/assets/h5p-core/library/js/h5p-content-type.js"></script>' +
      '<script type="text/javascript">' +
      'H5PIntegration=' + JSON.stringify(self.createH5PIntegration(self.getJsonContent(currentContentName), currentContentName)) + ';' +
      'H5PDev=' + JSON.stringify(self.getDevConfig(currentContentName)) + ';' +
      '</script>' +
      '<script type="text/javascript" src="/assets/h5p-server.js"></script>' +
      '<link rel="stylesheet" type="text/css" href="/assets/h5p-server.css">' +
      '</head>' +
      '<body>' +
      '<div class="h5p-dev-header">' +
        '<span class="machine-name-and-version">' + self.mainLibrary.getTextualNameAndVersion() +
        '<span class="author">[ by ' + self.mainLibrary.getAuthor() + ' ]</span></span>' +
        '<span class="h5p-cli-version">CLI version: ' + pjson.version + '</span>' +
      '</div>' +
      '<div class="h5p-dev-menu">' +
        '<div class="h5p-dev-menu-group h5p-dev-contents"><div class="header">Content switcher</div><div class="content"></div></div>' +
        '<div class="h5p-dev-menu-group h5p-dev-events"><div class="header">Events<span class="event-counter">0</span></div><div class="content"></div></div>' +
        '<div class="h5p-dev-menu-group h5p-dev-library-meta"><div class="header">Library metadata</div><div class="content"></div></div>' +
      '</div>' +
      '<div class="h5p-dev-h5p">' +
      '<div class="h5p-iframe-wrapper"><iframe id="h5p-iframe-1" class="h5p-iframe" data-content-id="1" style="height:1px" src="about:blank" frameBorder="0" scrolling="no"></iframe></div></div>' +
      '</div>' +
      '</body>' +
      '</html>';

      res.end(response);
  });

  var self = this;
  var server = app.listen(this.config.port, this.config.host, function () {
    console.log('--> H5P development server listening at http://%s:%s', self.config.host, self.config.port);
    if (done) {
      done('http://' + self.config.host + ':' + self.config.port)
    }
  });
};

H5PServer.prototype.getJsonContent = function (contentName) {
  var devConfig = this.getDevConfig();
  contentName = contentName || devConfig.contents[0];
  return require(path.join(this.contentDir, contentName, 'content.json'));

  // Need to invalidate content.json!
  // console.log(require.cache);
  //return content;
};

H5PServer.prototype.getDevConfig = function (currentContent) {
  var self = this;

  var dirs = fs.readdirSync(this.contentDir).filter(function (file) {
    return fs.statSync(path.join(self.contentDir, file)).isDirectory();
  });

  var devConfig = {
    contents: dirs,
    currentContent: currentContent || dirs[0],
    mainLibrary: this.mainLibrary.getData()
  };
  return devConfig;
};

H5PServer.prototype.createDependencyList = function () {
  this.dependencies = new H5PLibraryList();
  this.mainLibrary.getDependencies(this.libraryList, this.dependencies);
  this.mainLibrary.getDependenciesFromSemantics(this.libraryList, this.dependencies);
};

H5PServer.prototype.createJsAndCssList = function () {
  this.js = this.dependencies.getPreloadedJsList('/libs');
  this.css = this.dependencies.getPreloadedCssList('/libs');

  // Add library itself
  this.js = this.js.concat(this.mainLibrary.getPreloadedJsList('/libs'));
  this.css = this.css.concat(this.mainLibrary.getPreloadedCssList('/libs'));

  this.js.push('/assets/h5p-overrides.js');
};

H5PServer.prototype.createH5PIntegration = function (content, contentName) {
  return extend(true, {
    "baseUrl": "http://" + this.config.host + ':' + this.config.port,
    "url": "http://" + this.config.host + ':' + this.config.port + '/content/' + contentName,
    "contents": {
      "cid-1": {
        "library": this.mainLibrary.getTextualNameAndVersion(false),
        "jsonContent": JSON.stringify(content),
        "fullScreen": "0",
        "exportUrl": undefined,
        "embedCode": undefined,
        "resizeCode": "",
        "mainId": "1",
        "url": "http://localhost:8080",
        "title": this.mainLibrary.getTitle(),
        "contentUserData": [
          {
            "state": false
          }
        ],
        "disable": 6,
        "styles": this.css,
        "scripts": this.js
      }
    }
  }, h5pIntegration);
};

module.exports = H5PServer;
