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

var noCr = (process.platform === 'win32');

/**
 * Simple class for displaying a spinner while we're working.
 */
function Spinner(prefix) {
  var interval;

  if (noCr) {
    // Platform does not support carriage return. Use lightweight spinner.

    /**
     * Stop spinning.
     *
     * @public
     * @param {String} result
     */
    this.stop = function (result) {
      clearInterval(interval);
      util.print(' ' + result);
    };

    // Start spinner
    util.print(prefix);
    interval = setInterval(function () {
      util.print('.');
    }, 500);
  }
  else {
    // Create cool spinner using carriage return.

    var parts = ['/','-','\\', '|'];
    var curPos = 0;
    var maxPos = parts.length;

    /**
    * Stop spinning.
    *
    * @public
    * @param {String} result
    */
    this.stop = function (result) {
      clearInterval(interval);
      util.print(cr + prefix + ' ' + result);
    };

    // Start spinner
    interval = setInterval(function () {
      util.print(cr + prefix + ' ' + color.emphasize + parts[curPos++] + color.default);
      if (curPos === maxPos) curPos = 0;
    }, 100);
  }
}

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
  var msg = 'Cloning into \'' + color.emphasize + name + color.default + '\'...';
  var spinner = new Spinner(msg);
}

/**
 * Recursive pulling for all repos in collection.
 */
function pull() {
  var repo = h5p.pull(function (error, result) {

    if (error) {
      result = color.red + 'FAILED' + color.default + lf + error;
    }
    else {
      result = color.green + 'OK' + color.default + (result ? ' ' + result : '') + lf;
    }

    spinner.stop(result);
    pull();
  });
  if (!repo) return; // Nothing to clone.
  var msg = 'Pulling \'' + color.emphasize + repo + color.default + '\'...';
  var spinner = new Spinner(msg);
}

/**
 * Recursive pushing for all repos in collection.
 */
function push(options) {
  var repo = h5p.push(options, function (error, result) {

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
    push(options);
  });
  if (!repo) return; // Nothing to clone.
  var msg = 'Pushing \'' + color.emphasize + repo + color.default + '\'...';
  var spinner = new Spinner(msg);
}

/**
 * Print status messages for the given repos.
 */
function status(error, repos, force) {
  if (error) return util.print(error + lf);

  var first = true;
  for (var i = 0; i < repos.length; i++) {
    var repo = repos[i];

    // Skip no outputs
    if (!repo.error && !repo.changes && (force === undefined || !force)) continue;

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
    else if (repo.changes !== undefined) {
      util.print(repo.changes.join(lf) + lf);
    }

    util.print(lf);
  }
}

/**
 * Print result after checkout or merge.
 */
function results(error, repos) {
  if (error) return util.print(error + lf);

  for (var i = 0; i < repos.length; i++) {
    var repo = repos[i];

    util.print(color.emphasize + repo.name + color.default);

    if (repo.failed) {
      util.print(' ' + color.red + 'FAILED' + color.default);
    }
    else if (repo.skipped) {
      util.print(' ' + color.yellow + 'SKIPPED' + color.default);
    }
    else {
      util.print(' ' + color.green + 'OK' + color.default);
    }

    if (repo.msg) {
      util.print(' ' + repo.msg);
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

/**
 * Extracts options from input.
 *
 * @private
 * @param {String[]} inputs
 * @param {(String|String[]|RegExp|RegExp[])} valids
 */
function filterOptions(inputs, valids) {
  var options = [];

  // Go through input
  for (var i = 0; i < inputs.length; i++) {

    // Check if input is valid option
    for (var j = 0; j < valids.length; j++) {
      if (valids[j] instanceof RegExp && valids[j].test(inputs[i]) ||
          valids[j] === inputs[i]) {
        // Keep track of option
        options.push(inputs[i]);

        // No longer input
        inputs.splice(i, 1);
        i--;
      }
    }
  }

  return options;
}

/**
 * Creates a progress callback for async tasks.
 *
 * @private
 * @param {String} action
 * @returns {Function}
 */
function progress(action) {
  var spinner;
  return function (status, nextRepo) {
    if (status) {
      if (status.failed) {
        spinner.stop(color.red + 'FAILED' + color.default + lf + status.msg);
      }
      else if (status.skipped) {
        spinner.stop(color.yellow + 'SKIPPED' + color.default + lf);
      }
      else {
        spinner.stop(color.green + 'OK' + color.default + (status.msg === undefined ? '' : ' ' + status.msg) + lf);
      }
    }

    if (nextRepo) {
      spinner = new Spinner(action + ' \'' + color.emphasize + nextRepo + color.default + '\'...');
    }
  };
}

// Register command handlers
var commands = [
  {
    name: 'help',
    syntax: '<command>',
    shortDescription: 'Displays additional information',
    description: 'What don\'t you understand about help?',
    handler: function (command) {
      if (command) {
        command = findCommand(command);
        if (command && command.description) {
          util.print(command.description + lf);
        }
        else {
          util.print('Sorry, no help available.' + lf);
        }
      }
      else {
        listCommands();
      }
    }
  },
  {
    name: 'list',
    shortDescription: 'List all H5P libraries',
    handler: function list() {
      var spinner = new Spinner('Getting library list...');
      h5p.list(function (error, libraries) {
        var result = (error ? (color.red + 'ERROR: ' + color.default + error) : (color.green + 'DONE' + color.default));
        spinner.stop(result + lf);

        for (var name in libraries) {
          util.print('  ' + color.emphasize + name + color.default + lf);
        }
      });
    }
  },
  {
    name: 'get',
    syntax: '<library>',
    shortDescription: 'Clone library and all dependencies',
    handler: function get() {
      var libraries = Array.prototype.slice.call(arguments);
      if (!libraries.length) {
        util.print('No library specified.' + lf);
        return;
      }

      var spinner = new Spinner('Looking up dependencies...');
      h5p.get(libraries, function (error) {
        var result = (error ? (color.red + 'ERROR: ' + color.default + error) : (color.green + 'DONE' + color.default));
        spinner.stop(result + lf);
        clone();
      });
    }
  },
  {
    name: 'status',
    syntax: '[-f]',
    shortDescription: 'Show the status for all your libraries',
    description: 'The -f handle can be used to display which branch each library is on.',
    handler: function status() {
      h5p.status(function (error, repos) {
        status(error, repos, arguments[0] === '-f');
      });
    }
  },
  {
    name: 'commit',
    syntax: '<message>',
    shortDescription: 'Commit to all repos with given message',
    handler: function commit(msg) {
      // TODO: Get commit message from text editor?
      if (!msg) {
        util.print('No message means no commit.' + lf);
        return;
      }

      if (msg.split(' ', 2).length < 2) {
        util.print('Commit message to short.' + lf);
        return;
      }

      h5p.commit(msg, commit);
    }
  },
  {
    name: 'pull',
    syntax: '[<library>...]',
    shortDescription: 'Pull the given or all repos',
    handler: function pull() {
      h5p.update(Array.prototype.slice.call(arguments), function (error) {
        if (error) return util.print(error + lf);
        pull();
      });
    }
  },
  {
    name: 'push',
    syntax: '[<library>...] [--tags]',
    shortDescription: 'Push the given or all repos',
    handler: function get() {
      var libraries = Array.prototype.slice.call(arguments);
      var options = filterOptions(libraries, ['--tags']);
      h5p.update(libraries, function (error) {
        if (error) return util.print(error + lf);
        push(options);
      });
    }
  },
  {
    name: 'checkout',
    syntax: '<branch> [<library>...]',
    shortDescription: 'Change branch',
    handler: function checkout() {
      var libraries = Array.prototype.slice.call(arguments);
      var branch = libraries.shift();
      if (!branch) {
        util.print('No branch today.' + lf);
        return;
      }

      h5p.checkout(branch, libraries, results);
    }
  },
  {
    name: 'new-branch',
    syntax: '<branch> [<library>...]',
    shortDescription: 'Creates a new branch(local and remote)',
    description: 'The remote is origin.',
    handler: function newBranch() {
      var libraries = Array.prototype.slice.call(arguments);
      var branch = libraries.shift();
      if (!branch || branch.substr(0, 4) === 'h5p-') {
        util.print('That is a strange name for a branch..' + lf);
        return;
      }

      h5p.newBranch(branch, libraries, progress('Branching'));
    }
  },
  {
    name: 'rm-branch',
    syntax: '<branch> [<library>...]',
    shortDescription: 'Removes branch(local and remote)',
    description: 'The remote is origin.',
    handler: function rmBranch() {
      var libraries = Array.prototype.slice.call(arguments);
      var branch = libraries.shift();
      if (!branch || branch.substr(0, 4) === 'h5p-' || branch === 'master') {
        util.print('I would think twice about doing that!' + lf);
        return;
      }

      h5p.rmBranch(branch, libraries, progress('De-branching'));
    }
  },
  {
    name: 'diff',
    shortDescription: 'Prints combined diff for alle repos',
    handler: function diff() {
      h5p.diff(function (error, diff) {
        if (error) return util.print(color.red + 'ERROR!' + color.default + lf + error);
        util.print(diff);
      });
    }
  },
  {
    name: 'merge',
    syntax: '<branch> [<library>...]',
    shortDescription: 'Merge in branch',
    handler: function merge() {
      var libraries = Array.prototype.slice.call(arguments);
      var branch = libraries.shift();
      if (!branch) {
        util.print('No branch today.' + lf);
        return;
      }

      h5p.merge(branch, libraries, results);
    }
  },
  {
    name: 'pack',
    syntax: '<library> [<library2>...] [my.h5p]',
    shortDescription: 'Packs the given libraries',
    description: 'You can change the default output package by setting:' + lf +
      'export H5P_DEFAULT_PACK="~/my-libraries.h5p"' + lf +
      lf +
      'You can override which files are ignored by default:' + lf +
      'export H5P_IGNORE_PATTERN="^\\.|~$"' + lf +
      'export H5P_IGNORE_MODIFIERS="ig"' + lf +
      lf +
      'You can also change which files are allowed in the package by overriding:' + lf +
      'export H5P_ALLOWED_FILE_PATTERN="\\.(json|png|jpg|jpeg|gif|bmp|tif|tiff|svg|eot|ttf|woff|otf|webm|mp4|ogg|mp3|txt|pdf|rtf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|xml|csv|diff|patch|swf|md|textile|js|css)$"' + lf +
      'export H5P_ALLOWED_FILE_MODIFIERS=""' + lf +
      lf +
      'Put these in your ~/.bashrc for permanent settings.',
    handler: function pack() {
      var libraries = Array.prototype.slice.call(arguments);
      var options = filterOptions(libraries, [/\.h5p$/]);
      var file = (options[0] ? options[0] : (process.env.H5P_DEFAULT_PACK === undefined ? 'libraries.h5p' : process.env.H5P_DEFAULT_PACK));

      if (!libraries.length) {
        util.print('You must specify libraries.' + lf);
      }

      util.print('Packing ' + color.emphasize + libraries.length + color.default + ' librar' + (libraries.length === 1 ? 'y' : 'ies') + ' to ' + color.emphasize + file + color.default + '...' + lf);

      h5p.pack(libraries, file, results);
    }
  },
  {
    name: 'increase-patch-version',
    syntax: '[<library>...]',
    shortDescription: 'Increases the patch version',
    handler: function increasePatchVersion() {
      var libraries = Array.prototype.slice.call(arguments);
      h5p.increasePatchVersion(libraries, results);
    }
  },
  {
    name: 'tag-version',
    syntax: '[<library>...]',
    shortDescription: 'Create tag from current version number',
    handler: function tagVersion() {
      var libraries = Array.prototype.slice.call(arguments);
      h5p.tagVersion(libraries, results);
    }
  },
  {
    name: 'create-language-file',
    syntax: '<library> <language-code>',
    shortDescription: 'Creates language file',
    handler: function createLanguageFile(library, languageCode) {
      if (!library) {
        util.print('No library selected.' + lf);
        return;
      }
      if (!languageCode) {
        util.print('No language selected.' + lf);
        return;
      }

      h5p.createLanguageFile(library, languageCode, results);
    }
  }
];

/**
 * Print all commands with a short description.
 *
 * @private
 */
function listCommands() {
  util.print('Available commands:' + lf);
  for (var i = 0; i < commands.length; i++) {
    var co = commands[i];

    if (co.name) {
      util.print('  ' + color.emphasize + co.name);
      if (co.syntax) {
        util.print(' ' + co.syntax);
      }
      util.print(color.default);
      if (co.shortDescription) {
        util.print('  ' + co.shortDescription);
      }
      util.print(lf);
    }
  }
}

/**
 * Look for command registered with given name.
 *
 * @private
 * @param {string} name
 * @returns {object}
 */
function findCommand(name) {
  for (var i = 0; i < commands.length; i++) {
    if (commands[i].name === name) {
      return commands[i];
    }
  }
}

// Shift off unused
process.argv.shift(); // node
process.argv.shift(); // script

// Get command
var command = process.argv.shift();

// List commands
if (command === undefined) {
  listCommands();
  return;
}

// Find command and call handler
var foundCommand = findCommand(command);
if (foundCommand) {
  foundCommand.handler.apply(this, process.argv);
  return;
}

// Unkown
util.print('Unknown command.' + lf);
