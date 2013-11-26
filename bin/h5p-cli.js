#!/usr/bin/env node

/**
 * Load requirements.
 */
var util = require('util');
var h5p = require('../lib/h5p.js');

var lf = '\u000A';
var cr = '\u000D';
var color = {
  default: '\x1B[0m',
  emphasize: '\x1B[1m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  red: '\x1B[31m'
};

/**
 * Simple class for displaying a spinner while we're working.
 */
function Spinner(prefix) {
  var interval;
  var parts = ['/','-','\\', '|'];
  var curPos = 0;
  var maxPos = parts.length;

  this.stop = function (result) {
    util.print(cr + prefix + result);
    clearInterval(interval);
  }
  
  interval = setInterval(function () {
    util.print(cr + prefix + color.emphasize + parts[curPos++] + color.default);
    if (curPos === maxPos) curPos = 0;
  }, 100);
};

// Test spinner
//var spinner = new Spinner('Testing... ');
//setTimeout(function () { spinner.stop('DONE' + lf); },2000);

/**
 * Recursive cloning of all libraries in the collection.
 * Will print out status messages along the way.
 */
function clone() {
  var name = h5p.clone(function (error) {
    var result;
    if (error === -1) {
      result = color.yellow + 'SKIPPED' + color.default + lf;
    }
    else if (error) {
      result = color.red + 'FAILED' + color.default + ': ' + error;
    }
    else {
      result = color.green + 'OK' + color.default + lf;
    }

    spinner.stop(result);
    clone();
  });
  if (!name) return; // Nothing to clone.
  var msg = 'Cloning into \'' + color.emphasize + name + color.default + '\'... ';
  var spinner = new Spinner(msg);
}


process.argv.shift(); // node
process.argv.shift(); // script

// Command routing
var command = process.argv.shift();
switch (command) {
  case 'get':
    var library = process.argv.shift();
    if (!library) {
      util.print('No library specified.' + lf);
      break;
    }
    
    var spinner = new Spinner('Loading dependencies for \'' + color.emphasize + library + color.default + '\'... ');
    h5p.get(library, function (error) {
      var result = (error ? (color.red + 'ERROR: ' + color.default + error) : (color.green + 'DONE' + color.default));
      spinner.stop(result + lf);
      clone();
    });
    
    break;
    
  case 'status':
    h5p.status(function (error, repos) {
      for (var i = 0; i < repos.length; i++) {
        var repo = repos[i];
        
        if (!repo.error && repo.changes.length === 0) {
          continue;
        }
        
        util.print(color.emphasize + repo.name + color.default);
        if (repo.branch) {
          util.print(' (' + repo.branch + ')');
        }
        util.print(lf);
        
        if (repo.error) {
          util.print(error + lf);
        }
        else {
          util.print(repo.changes.join(lf) + lf);
        }
      }
    });
    break;
    
  case undefined:
    util.print('Available commands:' + lf);
    util.print('  ' + color.emphasize + 'get' + color.default + ' <library>' + lf);
    util.print('  ' + color.emphasize + 'status' + color.default + lf);
    break;
    
  default:
    util.print('Unknown command.' + lf);
    break;  
}
