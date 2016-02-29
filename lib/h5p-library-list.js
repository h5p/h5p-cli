var fs = require('fs');
var path = require('path');

var H5PLibrary = require('./h5p-library.js');

function H5PLibraryList () {
  var self = this;
  self.lookup = {};
  self.libraries = [];
}

H5PLibraryList.prototype.push = function (library) {
  if (library !== undefined) {
    this.libraries.push(library);
    this.lookup[library.getMachineName()] = library;
  }
};

H5PLibraryList.prototype.get = function (machineName) {
  return this.lookup[machineName];
};

H5PLibraryList.prototype.has = function (machineName) {
  return this.lookup[machineName] !== undefined;
};

H5PLibraryList.prototype.concat = function (libraryList) {
  var self = this;
  libraryList.getList().forEach(function (library) {
    self.push(library);
  });
};

H5PLibraryList.prototype.getList = function () {
  return this.libraries;
};

H5PLibraryList.prototype.getPreloadedJsList = function (prefix) {
  var list = [];
  this.libraries.forEach(function (library) {
    list = list.concat(library.getPreloadedJsList(prefix));
  });
  return list;
};

H5PLibraryList.prototype.getPreloadedCssList = function (prefix) {
  var list = [];
  this.libraries.forEach(function (library) {
    list = list.concat(library.getPreloadedCssList(prefix));
  });
  return list;
};

H5PLibraryList.fromDirectory = function (searchDirectory) {
  libraryList = new H5PLibraryList();

  // Search through all directories:
  fs.readdirSync(searchDirectory).forEach(function (dir) {
    var libraryJsonPath = path.join(searchDirectory, dir, 'library.json');

    // Check if library.json exists. If not, ignore directory
    try {
      if (fs.statSync(libraryJsonPath).isFile()) {
        var library = H5PLibrary.fromFile(libraryJsonPath);
        library.setParentFolderName(dir);
        libraryList.push(library);
      }
    }
    catch (er) {
      // Intentionally do nothing  
    }
  });

  return libraryList;
};

module.exports = H5PLibraryList;
