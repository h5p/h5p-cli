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
      result = color.red + 'FAILED' + color.default + lf + error;
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

/**
 * Recursive pulling for all repos in collection.
 */
function pull() {
  var repo = h5p.pull(function (error) {
    var result;
    if (error) {
      result = color.red + 'FAILED' + color.default + lf + error;
    }
    else {
      result = color.green + 'OK' + color.default + lf;
    }

    spinner.stop(result);
    pull();
  });
  if (!repo) return; // Nothing to clone.
  var msg = 'Pulling \'' + color.emphasize + repo + color.default + '\'... ';
  var spinner = new Spinner(msg);
}

/**
 * Recursive pushing for all repos in collection.
 */
function push() {
  var repo = h5p.push(function (error, result) {
    var result;
    if (error === -1) {
      result = color.yellow + 'SKIPPED' + color.default + lf;
    }
    else if (error) {
      result = color.red + 'FAILED' + color.default + lf + error;
    }
    else {
      result = color.green + 'OK' + color.default + ' ' + result + lf;
    }

    spinner.stop(result);
    push();
  });
  if (!repo) return; // Nothing to clone.
  var msg = 'Pushing \'' + color.emphasize + repo + color.default + '\'... ';
  var spinner = new Spinner(msg);
}

/**
 * Print status messages for the given repos.
 */
function status(error, repos) {
  if (error) return util.print(error + lf);
  
  var first = true;
  for (var i = 0; i < repos.length; i++) {
    var repo = repos[i];
    
    // Skip no outputs
    if (!repo.error && !repo.changes) continue;
    
    if (first) { 
      // Extra line feed on the first.
      util.print(lf);
      first = false;
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
    
    util.print(lf);
  }
}

/**
 * Print results after commiting.
 */
function commit(error, results) {
  if (error) return util.print(error + lf);
  
  var first = true;
  for (var i = 0; i < results.length; i++) {
    var result = results[i];
    
    // Skip no outputs
    if (!result.error && !result.changes) continue;
    
    if (first) {
      // Extra line feed on the first.
      util.print(lf);
      first = false;
    }
    
    util.print(color.emphasize + result.name + color.default);
    if (result.branch && result.commit) {
      util.print(' (' + result.branch + ' ' + result.commit + ')');
    }
    util.print(lf);
    
    if (result.error) {
      util.print(error + lf);
    }
    else {
      util.print(result.changes.join(lf) + lf);
    }
    util.print(lf);
  }
}

process.argv.shift(); // node
process.argv.shift(); // script

// Command routing
var command = process.argv.shift();
switch (command) {
  case 'list':
    var spinner = new Spinner('Getting library list... ');
    h5p.list(function (error, libraries) {
      var result = (error ? (color.red + 'ERROR: ' + color.default + error) : (color.green + 'DONE' + color.default));
      spinner.stop(result + lf);
      
      for (var name in libraries) {
        util.print('  ' + color.emphasize + name + color.default + lf);  
      }
    });
    
    break;
  
  case 'get':
    var library = process.argv.shift();
    if (!library) {
      util.print('No library specified.' + lf);
      break;
    }
    
    var spinner = new Spinner('Looking up dependencies for \'' + color.emphasize + library + color.default + '\'... ');
    h5p.get(library, function (error) {
      var result = (error ? (color.red + 'ERROR: ' + color.default + error) : (color.green + 'DONE' + color.default));
      spinner.stop(result + lf);
      clone();
    });
    
    break;
    
  case 'status':
    h5p.status(status);
    break;
    
  case 'commit':
    // TODO: Get message from editor?
    var msg = process.argv.shift();
    if (!msg) {
      util.print('No message means no commit.' + lf);
      break;
    }
    
    if (msg.split(' ', 2).length < 2) {
      util.print('Commit message to short.' + lf);
      break;
    }
    
    h5p.commit(msg, commit);
    break;
    
  case 'pull':
    h5p.update(function (error) {
      if (error) return util.print(error + lf);
      pull();
    });
    break;
    
  case 'push':
    h5p.update(function (error) {
      if (error) return util.print(error + lf);
      push();
    });
    break;
    
  case 'diff':
    h5p.diff(function (error, diff) {
      if (error) return util.print(color.red + 'ERROR!' + color.default + lf + error);
      util.print(diff);
    });
    break;
    
  case 'pack':
    if (!process.argv.length) {
      util.print('You must specify libraries.' + lf);
      break;
    }
  
    var spinner = new Spinner('Packing ' + color.emphasize + process.argv.length + color.default + ' librar' + (process.argv.length === 1 ? 'y' : 'ies') + '... ');
    h5p.pack(process.argv, function (error) {
      var result = (error ? (color.red + 'ERROR: ' + color.default + error) : (color.green + 'DONE' + color.default));
      spinner.stop(result + lf);
    });
    break;
  
  case 'increase-patch-version':
    if (!process.argv.length) {
      util.print('You must specify libraries.' + lf);
      break;
    }
  
    var spinner = new Spinner('Increasing patch version for ' + color.emphasize + process.argv.length + color.default + ' librar' + (process.argv.length === 1 ? 'y' : 'ies') + '... ');
    h5p.increasePatchVersion(process.argv, function (error) {
      var result = (error ? (color.red + 'ERROR: ' + color.default + error) : (color.green + 'DONE' + color.default));
      spinner.stop(result + lf);
    });
    break;
    
  case undefined:
    util.print('Available commands:' + lf);
    util.print('  ' + color.emphasize + 'list' + color.default + ' - List all libraries.' + lf);
    util.print('  ' + color.emphasize + 'get <library>' + color.default + ' - Find all dependencies and clone them.' + lf);
    util.print('  ' + color.emphasize + 'status' + color.default + ' - Status for all repos.' + lf);
    util.print('  ' + color.emphasize + 'commit <message>' + color.default + ' - Commit to all repos with given message.' + lf);
    util.print('  ' + color.emphasize + 'pull' + color.default + ' - Pull all repos.' + lf);
    util.print('  ' + color.emphasize + 'push' + color.default + ' - Push all repos.' + lf);
    util.print('  ' + color.emphasize + 'diff' + color.default + ' - Prints combined diff for alle repos.' + lf);
    util.print('  ' + color.emphasize + 'pack <library> [<library2>...]' + color.default + ' - Packs given libraries in libraries.h5p. (Use H5P_IGNORE_PATTERN and H5P_IGNORE_MODIFIERS to override file ignore.)' + lf);
    util.print('  ' + color.emphasize + 'increase-patch-version <library> [<library2>...]' + color.default + ' - Increase libraries patch version.' + lf);
    break;
    
  default:
    util.print('Unknown command.' + lf);
    break;  
}
