/**
 * TODO:
 * - Fetches h5p-hello-world-template from github including content
 * - Renames and replaces names according to input
 */

var extend = require('node.extend');
var request = require('request');
var fs = require('fs');
var zlib = require('zlib');
var path = require('path');
var tar = require('tar-fs');
var util = require('util');

var Transform = require('stream').Transform;

var H5PLibrary = require('./h5p-library.js');

var TEMPLATE_TAG='0.0.1';
var TEMPLATE_URL='https://github.com/h5p/h5p-hello-developer-template/archive/' + TEMPLATE_TAG + '.tar.gz';
//var TEMPLATE_URL='http://localhost/h5p-hello-developer-template.tar.gz';

function H5PCreator(options) {
  var self = this;
  var cwd = process.cwd();

  self.options = extend(true, {
    title: 'Hello world',
    description: 'A simple hello world H5P template',
    machineName: 'H5P.MyNewContent',
    author: 'Unknown'
  }, options);

  self.options.nameWithoutPrefix = self.options.machineName.split('.')[1];
  self.options.nameInKebabCase = H5PLibrary.machineNameToKebabCase(self.options.machineName);

  var devDirectory = path.join(cwd, 'libs', self.options.nameInKebabCase);

  var contentTransforms = {
    'H5P.HelloDeveloper': self.options.machineName,
    'h5p-hello-developer': self.options.nameInKebabCase,
    '@author': self.options.author,
    '@title': self.options.title,
    '@description': self.options.description,
    '@developer-directory': devDirectory,
    '@semantics-file': path.join(devDirectory, 'semantics.json'),
    '@js-file': path.join(devDirectory, 'scripts', self.options.nameInKebabCase + '.js'),
    '@css-file': path.join(devDirectory, 'styles', self.options.nameInKebabCase + '.css'),
    '@content-file': path.join(cwd, 'content')
  };

  var filesToTransform = [
    'libs/' + self.options.nameInKebabCase + '/library.json',
    'content/1-hello-developer/content.json',
    'content/2-about-this-tool/content.json',
    'libs/' + self.options.nameInKebabCase + '/scripts/' + self.options.nameInKebabCase +'.js',
    'libs/' + self.options.nameInKebabCase + '/styles/' + self.options.nameInKebabCase + '.css',
    'h5p-server.json'
  ];

  var renameFile = function (fileName) {
    return fileName.replace('h5p-hello-developer-template-' + TEMPLATE_TAG + '/', '').replace(/(h5p-hello-developer)/g, self.options.nameInKebabCase);
  };

  this.fetchFromGithub = function (done) {
    // Fetch from github
    console.log('Fetching H5P template from github...');
    request(TEMPLATE_URL)
      .pipe(zlib.createGunzip())
      .pipe(tar.extract(cwd, {
        // Rename files
        map: function (header) {
          header.name = renameFile(header.name);
          return header;
        },
        // Change content
        mapStream: function(fileStream, header) {
          if (header.type === 'file' && filesToTransform.indexOf(header.name) !== -1) {
            return fileStream.pipe(new H5PTransformer(contentTransforms, {objectMode: true}));
          }
          return fileStream;
        }
      })).on('finish', function () {
        done();
      }
    );
  };
}

function H5PTransformer (contentTransforms, options) {
  this.contentTransforms = contentTransforms;
  Transform.call(this, options);
}
util.inherits(H5PTransformer, Transform);
H5PTransformer.prototype._transform = function(data, encoding, done) {
  var self = this;
  var json = data.toString();

  for (var key in self.contentTransforms) {
    if (self.contentTransforms.hasOwnProperty(key)) {
      json = json.replace(new RegExp('(' + key + ')', 'g'), self.contentTransforms[key]);
    }
  }
  this.push(json);
  done();
};

H5PCreator.prototype.create = function (done) {
  var self = this;

  self.fetchFromGithub(function () {
    done();
  });
};

module.exports = H5PCreator;
