/**
 * Requirements
 */
var http = require('http');
var child = require('child_process');

/**
 * Local globals
 */
var apiVersion = 1;
var registry;
var collection; // A collection is used to avoid circular dependencies

/**
 * Run given callback with h5p registry as params.
 */
function getRegistry(next) {
  if (registry) return next(null, registry.libraries);
  
  http.get('http://h5p.org/registry.json', function (response) {
    if (response.statusCode !== 200) {
      return next('Server responded with HTTP ' + response.statusCode + '.');
    }
    
    var jsonBuffer = '';
    response.on('data', function (chunk) {
      jsonBuffer += chunk;
    });
    
    response.on('end', function () {
      try {
        registry = JSON.parse(jsonBuffer);
      }
      catch (error) {
        return next('Cannot parse registry information: ' + error.message);
      }
      
      if (registry.apiVersion !== apiVersion) return next('API Version mismatch.\nMake sure this tool is up to date.');
      
      next(null, registry.libraries);
    });
  }).on('error', function (error) {
    return next('Cannot connect to server: ' + error.message);
  });
}

/**
 * Recursive function that adds the given library + its dependencies to the collection.
 */
function getLibrary(libraryName, next) {
  getRegistry(function (error, libraries) {
    if (error) return next(error);
    
    var library = libraries[libraryName];
    if (!library) return next('No such library.');

    collection[libraryName] = library;
    
    if (library.dependencies) {
      // Find dependencies
      var errors = '';
      var loaded = 0;
      
      for (var i = 0; i < library.dependencies.length; i++) {
        dependency = library.dependencies[i];
        getLibrary(dependency, function (error) {
          if (error) errors += '\n' + dependency + ': ' + error;
          loaded++;
              
          if (loaded === library.dependencies.length) {
            next(errors === '' ? null : errors);
          }
        });
      } 
    }
    else {
      next();
    }
  });
};

/**
 * Clone repo at given url into given dir.
 */
function cloneRepository(dir, url, next) {
  var proc = child.spawn('git', ['clone', url, dir]);
  
  /*proc.stdout.on('data', function (data) {
    console.log('out:' + data.toString());
  });*/

  proc.stderr.on('data', function (data) {
    if (!next) return;
    
    var error = data.toString();
    if (error.indexOf('already exists') !== -1) return next(-1);
    
    next(error);
    next = null; // Prevent additional errors.
  });
        
  proc.on('exit', function (code) {
    // Note that sometimes stderr gets called after exit.
    if (code === 0) next();
  });
}

/**
 * Export our api.
 */
var h5p = module.exports = {};

/**
 * Creates a new collection and fills it up with the given library and its dependencies.
 */
h5p.get = function (libraryName, next) {
  collection = {}; // Starty a new collection
  getLibrary(libraryName, function (error) {
    next(error);
  });
}

/**
 * Clone the next library in the collection.
 */
h5p.clone = function (next) {
  for (lib in collection) {
    cloneRepository(lib, collection[lib].repository, next); 
    delete collection[lib];
    return lib;
  }
  return false;
}
