var path = require('path');

function H5PLibrary(json, libraryDirectoryPath) {
  this.data = json;
  this.libraryDirectoryPath = libraryDirectoryPath;
  this.setParentFolderName( this.data.machineName + '-' + this.data.majorVersion + '.' + this.data.minorVersion);

  // Try loading semantics
  try {
    this.semantics = require(path.join(this.libraryDirectoryPath, 'semantics.json'));
  } catch (err) {
    // Do nothing
  }
}

H5PLibrary.prototype.setParentFolderName = function (dir) {
  this.parentFolderName = dir;
};

H5PLibrary.prototype.getParentFolderName = function () {
  return this.parentFolderName;
};

H5PLibrary.prototype.getData = function () {
  return this.data;
};

H5PLibrary.prototype.getSemantics = function () {
  return this.semantics;
};

H5PLibrary.prototype.fullscreen = function () {
  return this.data.fullscreen;
};

H5PLibrary.prototype.getMachineName = function () {
  return this.data.machineName;
};

H5PLibrary.prototype.getAuthor = function () {
  return this.data.author;
};

H5PLibrary.prototype.getTitle = function () {
  return this.data.title;
};

H5PLibrary.prototype.displayUsingIframe = function () {
  var embedTypes = this.data.embedTtypes;
  return embedTypes !== undefined && embedTypes[0] === 'iframe';
};

H5PLibrary.prototype.getPreloadedJsList = function (prefix) {
  var self = this;
  var js = [];

  if (this.data.preloadedJs) {
    this.data.preloadedJs.forEach(function (item) {
      js.push(path.join(prefix, self.getParentFolderName(), item.path));
    });
  }

  return js;
};

H5PLibrary.prototype.getPreloadedCssList = function (prefix) {
  var self = this;
  var css = [];

  if (this.data.preloadedCss) {
    this.data.preloadedCss.forEach(function (item) {
      css.push(path.join(prefix, self.getParentFolderName(), item.path));
    });
  }
  return css;
};

H5PLibrary.prototype.getTextualNameAndVersion = function (includePatchVersion) {
  includePatchVersion = includePatchVersion || true;
  return this.data.machineName + ' ' + this.data.majorVersion + '.' + this.data.minorVersion + (includePatchVersion ? ('.' + this.data.patchVersion) : '');
};

H5PLibrary.prototype.getDependencies = function (availableLibraries, librariesNeeded) {
  if (this.data.preloadedDependencies) {
    this.data.preloadedDependencies.forEach(function (library) {
      if (!librariesNeeded.has(library.machineName)) {
        var neededLibrary = availableLibraries.get(library.machineName);
        if (neededLibrary !== undefined) {
          neededLibrary.getDependencies(availableLibraries, librariesNeeded);
          librariesNeeded.push(neededLibrary);
        }
        else {
          console.error('Missing library: ' + library.machineName);
        }
      }
    });
  }
};

H5PLibrary.prototype.findDependenciesInSemantics = function (field) {
  var self = this;
  var dependencies = [];

  for (var key in field) {
    if (field.hasOwnProperty(key)) {
      if (key === 'type' && field[key] === 'library') {
        return field.options;
      }
      if (typeof field[key] == "object") {
        dependencies = dependencies.concat(self.findDependenciesInSemantics(field[key]));
      }
    }
  }

  return dependencies;
};

H5PLibrary.prototype.getDependenciesFromSemantics = function (availableLibraries, libraries) {
  var dependencies = this.findDependenciesInSemantics(this.semantics);

  dependencies.forEach(function (dependency) {
    // Parse dependency:
    var machineName = H5PLibrary.getMachineNameFromSemanticsSyntax(dependency);

    // Do we have it?
    if (availableLibraries.has(machineName)) {
      var library = availableLibraries.get(machineName);

      // Get dependencies for this one!
      library.getDependencies(availableLibraries, libraries);

      libraries.push(library);
    }
    else {
      console.error('Missing library: ' + machineName);
    }
  });
};

H5PLibrary.fromFile = function (libraryJsonPath) {
  return new H5PLibrary(require(libraryJsonPath), path.dirname(libraryJsonPath));
};

H5PLibrary.getMachineNameFromSemanticsSyntax = function (libraryName) {
  // e.g: H5P.MultiChoice 1.4
  return libraryName.split(' ')[0];
};

H5PLibrary.machineNameToKebabCase = function (machineName) {
  // From CamelCase to kebab-case
  return machineName.replace('H5P.', 'h5p').replace(/[A-Z]/g, '-$&').toLowerCase();
};

module.exports = H5PLibrary;
