/**
 * Requirements
 */
var https = require('https');
var child = require('child_process');
var fs = require('fs');
var archiver = require('archiver');

/**
 * No options specified.
 * @contant
 */
PROCESS_NIL = 0;

/**
 * Do not check if repo is git repo.
 * @contant
 */
PROCESS_SKIP_CHECK = 1;

/**
 * Used to run operations in serial when heavy I/O/network is involved.
 * @contant
 */
PROCESS_SERIAL = 2;

/**
 * Local globals
 */
var apiVersion = 1;
var registry;
var collection; // A collection is used to avoid circular dependencies
var pullushers; // A collection ready for pushing or pulling
var env = process.env;
env.GIT_SSH = __dirname + '/../bin/h5p-ssh';
// TODO: Try to start ssh-agent if env['SSH_AUTH_SOCK'] is missing?

// Allowed file pattern to test packed files again. If files do not pass they are ignored.
var allowedFilePattern = (process.env.H5P_ALLOWED_FILE_PATTERN !== undefined ? new RegExp(process.env.H5P_ALLOWED_FILE_PATTERN, process.env.H5P_ALLOWED_FILE_MODIFIERS) : /\.(json|png|jpg|jpeg|gif|bmp|tif|tiff|svg|eot|ttf|woff|woff2|otf|webm|mp4|ogg|mp3|txt|pdf|rtf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|xml|csv|diff|patch|swf|md|textile|js|css)$/);

// Use env ignore pattern or default(ignores tmp files and hidden files).
var ignorePattern = (process.env.H5P_IGNORE_PATTERN !== undefined ? new RegExp(process.env.H5P_IGNORE_PATTERN, process.env.H5P_IGNORE_MODIFIERS) : /^\.|~$/gi);

// List of repositoreies to ignore
var ignoredRepos = (process.env.H5P_IGNORE_REPOS !== undefined ? process.env.H5P_IGNORE_REPOS.split(',') : []);
var semiIgnoredRepos = (process.env.H5P_SEMI_IGNORE_REPOS !== undefined ? process.env.H5P_SEMI_IGNORE_REPOS.split(',') : []);

/**
 * Make ssh errors short and understandable.
 */
function sshError(error, url) {
  if (error.indexOf('Host key verification failed.') !== -1) error = 'Host key verification failed.' + (url ? ' Try running ssh -T ' + url.split(':', 1)[0] : '') + '\n';
  if (error.indexOf('Permission denied') !== -1) error = 'Permission denied.\nMake sure ssh-agent is running.' + (url ? ' (ssh -T ' + url.split(':', 1)[0] + ' should not ask for password/passphrase)' : '') + '\n';
  return error;
}

/**
 * Skip ssh warnings.
 * (typically comes when a host has multiple IPs, like github.com)
 */
function skipWarnings(output) {
  if (output.substr(0, 8) === 'Warning:' || output.substr(0, 12) === 'Cloning into') output = '';
  return output;
}

/**
 * Run given callback with h5p registry as params.
 */
function getRegistry(next) {
  if (registry) return next(null, registry.libraries);

  https.get('https://h5p.org/registry.json', function (response) {
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
  if (libraryName === '') return next();
  getRegistry(function (error, libraries) {
    if (error) return next(error);
    if (collection[libraryName]) return next(); // Already have this.

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
}

/**
 * Clone repo at given url into given dir.
 */
function cloneRepository(dir, url, next) {
  var proc = child.spawn('git', ['clone', url, dir], {env: env});
  proc.on('error', function (error) {
    next(error);
  });

  var output = '';
  proc.stderr.on('data', function (data) {
    output += skipWarnings(data.toString());
  });
  proc.stderr.on('end', function () {
    if (output.indexOf('already exists') !== -1) return next(-1);
    next(sshError(output, url));
  });
}

/**
 * Check if dir is a repo.
 */
function checkRepository(dir, next) {
  fs.stat(dir + '/.git/config', function (error, stats) {
    if (error) return next(null);
    next(dir);
  });
}

/**
 * Find all repos in the current working dir.
 */
function findRepositories(next, skipCheck) {
  fs.readdir('.', function (error, files) {
    if (error) return next(error);

    if (skipCheck) {
      next(null, files);
      return;
    }

    var repos = [];
    var processed = 0;
    for (var i = 0; i < files.length; i++) {
      checkRepository(files[i], function (repo) {
        if (repo) {
          repos.push(repo);
        }

        processed++;
        if (processed === files.length) {
          next(null, repos);
        }
      });
    }
  });
}

/**
 * Find status lines for the given repo.
 */
function statusRepository(dir, next) {
  var status = {
    name: dir
  };

  var proc = child.spawn('git', ['status', '--porcelain', '--branch'], {cwd: process.cwd() + '/' + dir, env: env});

  proc.on('error', function (error) {
    status.error = error;
    next(status);
  });

  var buffer = '';
  proc.stdout.on('data', function (data) {
    buffer += data.toString();
  });

  proc.stdout.on('end', function () {
    var lines = buffer.split('\n');
    lines.pop(); // Empty

    status.branch = lines.shift().split('## ')[1];
    if (lines.length) {
      status.changes = lines;
    }

    next(status);
  });
}

/**
 * Stage and commit all on the given repo.
 */
function commitRepository(dir, message, next) {
  var result = {
    name: dir
  };

  var procOpts = {cwd: process.cwd() + '/' + dir, env: env};

  var proc = child.spawn('git', ['add', '--all'], procOpts);

  proc.on('error', function (error) {
    result.error = error;
    next(result);
  });

  proc.on('exit', function (code) {
    if (code !== 0) {
      result.error = 'Exit code ' + code;
      return next(result);
    }

    // Everything staged. Commit!
    var proc = child.spawn('git', ['commit', '-m', message], procOpts);

    proc.on('error', function (error) {
      result.error = error;
      next(result);
    });

    var buffer = '';
    proc.stdout.on('data', function (data) {
      buffer += data.toString();
    });

    proc.stdout.on('end', function () {
      var lines = buffer.split('\n');
      lines.pop(); // Empty

      var line = lines.shift().replace(/\[|\]/g, '').split(' ', 3);
      if (line[0] !== '#') {
        result.branch = line[0];
        result.commit = line[1];
        result.changes = lines;
      }

      next(result);
    });

  });
}

/**
 * Pull the current branch for the given repo.
 */
function pullRepository(dir, next) {
  var proc = child.spawn('git', ['pull'], {cwd: process.cwd() + '/' + dir, env: env});
  proc.on('error', function (error) {
    next(error);
  });

  var output = '';
  proc.stderr.on('data', function (data) {
    output += skipWarnings(data.toString());
  });
  proc.stderr.on('end', function () {
    if (output.substr(0, 4) === 'From') return next(null, output.split('\n')[1].replace(/(^\s+|\s+$)/g, '').replace(/\s{2,}/g, ' '));
    next(sshError(output));
  });
}

/**
 * Get the diff for the given repo.
 */
function diffRepository(dir, next) {
  var proc = child.spawn('git', ['diff'], {cwd: process.cwd() + '/' + dir});
  proc.on('error', function (error) {
    next(error);
  });

  var buffer = '';
  proc.stdout.on('data', function (data) {
    buffer += data.toString();
  });
  proc.stdout.on('end', function () {
    // Update file paths.
    buffer = buffer.replace(/\n(---|\+\+\+) (a|b)\/(.+)/g, '\n$1 $2/' + dir + '/$3').replace(/(^|\n)(diff --git a\/)(.+ b\/)(.+)/g, '$1$2' + dir + '/$3' + dir + '/$4');

    next(null, buffer);
  });
}

/**
 * Cycle through given repos and run process callback.
 *
 * @private
 * @param {Array} repos
 * @param {Number} [options]
 * @param {Function} process
 * @param {Function} next
 */
function processRepos(repos, options, process, next) {
  if (typeof options !== 'number') {
    // Options not specified, shift args
    next = process;
    process = options;
    options = PROCESS_NIL;
  }

  findRepositories(function (error, validRepos) {
    if (error) return next(error);

    var all = !repos.length || (repos.length === 1 && repos[0] === '*');
    if (all) {
      // Do all repos
      repos = validRepos;
    }

    var each = function (id, value, done) {
      if (ignoredRepos.indexOf(value) !== -1 || !(options & PROCESS_SKIP_CHECK) && semiIgnoredRepos.indexOf(value) !== -1) {
        // Ignore repo
        done({
          name: value,
          skipped: true,
          msg: 'ignored'
        });
        return;
      }

      if (all) {
        // No need to check if repo is valid, just process
        process(value, done);
        return;
      }

      // Find valid repo and process
      for (var j = 0; j < validRepos.length; j++) {
        if (validRepos[j] === value) {
          process(value, done);
          return;
        }
      }

      // Specified repo wasn't found
      done({
        name: value,
        skipped: true,
        msg: 'no git repository found'
      });
    };

    if (options & PROCESS_SERIAL) {
      serial(repos, each, next);
    }
    else {
      parallel(repos, each, next);
    }

  }, options & PROCESS_SKIP_CHECK);
}

/**
 * Helps run procecss task on all items in parallel.
 * TODO: In the future support objects as well?
 *
 * @private
 * @param {Array} arr item container
 * @param {Function} process task
 * @param {Function} finished callback
 */
function parallel(arr, process, finsihed) {
  var results = [];

  /**
   * Callback for when processing is done
   *
   * @private
   * @param {Object} status
   */
  var done = function (status) {
    results.push(status);
    if (results.length === arr.length) {
      finsihed(null, results);
    }
  };

  for (var i = 0; i < arr.length; i++) {
    process(i, arr[i], done);
  }
}

/**
 * Helps process each property on the given object asynchronously in serial order.
 *
 * @private
 * @param {(Array|Object)} obj list
 * @param {Function} process
 * @param {Function} finished
 */
function serial(obj, process, finished) {
  var id, isArray = obj instanceof Array;

  // Keep track of each property that belongs to this object.
  if (!isArray) {
    var ids = [];
    for (id in obj) {
      if (obj.hasOwnProperty(id)) {
        ids.push(id);
      }
    }
  }

  // Keep track of the current property
  var i = -1;

  /**
   * Process the next property.
   * @private
   */
  var next = function () {
    id = isArray ? i : ids[i];
    process(id, obj[id], check);
  };

  /**
   * Check if we're done or have an error.
   *
   * @private
   * @param {String} err
   */
  var check = function (err) {
    // We need to use a real async function in order for the stack to clear.
    setTimeout(function () {
      i++;
      if (i === (isArray ? obj.length : ids.length) || (err !== undefined && err !== null)) {
        finished(err);
      }
      else {
        next();
      }
    }, 0);
  };

  // Start
  check();
}

/**
 * Start a git process and capture the output.
 *
 * @private
 * @param {String} dir
 * @param {Array} options
 * @param {Function} next
 */
function spawnGit(dir, options, next) {
  var proc = child.spawn('git', options, {cwd: process.cwd() + '/' + dir, env: env});

  var outBuff = '';
  proc.stdout.on('data', function (data) {
    outBuff += data.toString();
  });

  var errBuff = '';
  proc.stderr.on('data', function (data) {
    errBuff += data.toString();
  });

  proc.on('error', function (error) {
    next(error, '');
  });
  proc.on('close', function () {
    next(sshError(errBuff), outBuff);
  });
}

/**
 * Start a git process and capture the output.
 *
 * @private
 * @param {string} file
 * @param {function} next
 */
function spawn(type, options, dir, next) {
  var envVars = {cwd: process.cwd(), env: env, detached: true};
  if (dir) {
    envVars += '/' + dir;
  }
  var proc = child.spawn(type, options, envVars);

  var outBuff = '';
  proc.stdout.on('data', function (data) {
    outBuff += data.toString();
  });

  var errBuff = '';
  proc.stderr.on('data', function (data) {
    errBuff += data.toString();
  });

  proc.on('error', function (error) {
    next(error, undefined);
  });
  proc.on('close', function () {
    next(errBuff ? errBuff : undefined, outBuff ? outBuff : undefined);
  });

  return proc.stdin;
}

/**
 * Start a iconv process and capture the output.
 *
 * @private
 * @param {String} dir
 * @param {Array} options
 * @param {Function} next
 */
function toUTF8(file, next) {
  // Detect charset
  spawn('file', ['-i', file], null, function (err, result) {
    if (err) {
      return next(err);
    }
    var input = result.match(/charset=([^\n\r ]+)/);
    if (!input || !input[1]) {
      return next('unable to detect charset');
    }

    var iconv = spawn('iconv', ['-f', input[1], '-t', 'utf-8', file], null, function (err, utf8) {
      next(err, utf8);
    });
  });
}

/**
 * Change branch on the given repo.
 *
 * @private
 * @param {(Array|String)} options Branch or set of options.
 * @param {String} dir
 * @param {Function} next
 */
function checkoutRepository(options, dir, next) {
  var args = ['checkout'];
  if (options instanceof Array) {
    for (var i = 0; i < options.length; i++) {
      args.push(options[i]);
    }
  }
  else {
    args.push(options);
  }

  spawnGit(dir, args, function (error, output) {
    var status = {
      name: dir
    };

    if (error !== '' && error.substr(0, 7) !== 'Already' && error.substr(0, 8) !== 'Switched') {
      if (error.substr(7, 8) === 'pathspec' || error.substr(0, 21) === 'fatal: A branch named') {
        // Branch not found
        status.skipped = true;
      }
      else {
        // Failed
        status.failed = true;
        status.msg = error.substr(7, error.length - 8);
      }
    }
    else {
      var lines = output.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var matches = lines[i].match(/^Your branch is (.+)$/);
        if (matches && matches[1].substr(0, 10) !== 'up-to-date') {
          status.msg = matches[1];
        }
      }
    }

    next(status);
  });
}

/**
 * Change branch on the given repo.
 *
 * @private
 * @param {Array} [options] Set of options
 * @param {String} dir
 * @param {Function} next
 */
function pushRepository(options, dir, next) {
  var args = ['push'];
  if (options !== undefined) {
    for (var i = 0; i < options.length; i++) {
      args.push(options[i]);
    }
  }

  spawnGit(dir, args, function (error, output) {
    var status = {
      name: dir
    };

    var res = error.substr(0, 2);
    if (res === 'Ev') {
      status.skipped = true;
    }
    else if (res === 'To') {
      output = error.split('\n')[1].replace(/(^\s+|\s+$)/g, '').replace(/\s{2,}/g, ' ');
      if (output.substr(0, 1) === '!') {
        status.failed = true;
        status.msg = output + '\n';
      }
      else if (output.substr(0, 2) === '* ') {
        status.msg = output.substring(2, output.length);
      }
    }
    else {
      status.failed = true;
      status.msg = error;
    }

    next(status);
  });
}

/**
 * Merge in the selected branch.
 *
 * @private
 * @param {String} branch
 * @param {String} dir
 * @param {Function} next
 */
function mergeRepository(branch, dir, next) {
  spawnGit(dir, ['merge', branch, '--no-ff'], function (error, output) {
    var status = {
      name: dir
    };

    if (error !== '') {
      if (error.indexOf('not something we can merge') !== -1) {
        // Branch not found
        status.skipped = true;
      }
      else if (error.indexOf('you have unmerged files') !== -1) {
        status.failed = true;
        status.msg = 'unmerged files';
      }
      else {
        // Failed
        status.failed = true;
        status.msg = error;
      }
    }
    else {
      var lines = output.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].substr(0, 8) === 'CONFLICT') {
          status.failed = true;
          status.msg = 'conflict';
          break;
        }
      }
    }

    next(status);
  });
}

/**
 * Loads data from given JSON file in repo
 *
 * @private
 * @param {string} repo
 *    Repo directory as string, e.g. 'h5p-course-presentation'
 * @param {string} file
 *    JSON file with extension, e.g. '/library.json'
 * @param {function} next
 *    Function that handles the data from reading file,
 *    takes two arguments (error, data)
 */
function readJson(repo, file, next) {
  try {
    next(null, JSON.parse(fs.readFileSync(repo + file)));
  }
  catch (err) {
    if (err.toString().indexOf('no such file or directory') !== -1 || err.toString().indexOf('not a directory') !== -1) {
      err = 'not a library';
    }
    next(err);
  }
}

/**
 * Loads library data for given repo
 *
 * @private
 * @param {string} repo
 *    Repo directory as string, e.g. 'h5p-course-presentation'
 * @param {function} next
 *    Function that handles the data from reading file,
 *    takes two arguments (error, data)
 */
function libraryData(repo, next) {
  readJson(repo, '/library.json', next);
}

/**
 * Loads semantics data for given repo
 *
 * @private
 * @param {string} repo
 *    Repo directory as string, e.g. 'h5p-course-presentation'
 * @param {function} next
 *    Function that handles the data from reading file,
 *    takes two arguments (error, data)
 */
function readSemantics(repo, next) {
  readJson(repo, '/semantics.json', next);
}

/**
 * Recursive archiving of the given path.
 */
function archiveDir(archive, path, alias) {
  if (alias === undefined) alias = path;

  var files = fs.readdirSync(path);
  for (var i = 0; i < files.length; i++) {
    var filename = files[i];
    var file = path + '/' + filename;
    var target = alias + '/' + filename;

    // Skip hidden files and tmp files.
    if (filename.match(ignorePattern) !== null) {
      continue;
    }

    if (fs.lstatSync(file).isDirectory()) {
      archiveDir(archive, file, target);
    }
    else if (allowedFilePattern.test(filename)) {
      archive.append(fs.createReadStream(file), {name: target});
    }
  }
}

/**
 * Remove untranslatable properties from semantics (recursive)
 *
 * @param {String} field A field
 * @param {String} name Name of field
 */
function removeUntranslatables(field, name) {
  if(field instanceof Array) {
    for (var i = field.length; i >= 0; i--) {
      field[i] = removeUntranslatables(field[i]);

      if (field[i] === undefined) {
        field.splice(i, 1);
      }
    }

    if (field.length === 0) {
      field = undefined;
    }
  }
  else if (typeof field === 'object') {
    for(var property in field) {
      field[property] = removeUntranslatables(field[property], property);

      if(field[property] === undefined) {
        delete field[property];
      }
    }

    if (field !== null && field.length === 0) {
      field = undefined;
    }
  }
  else if (name === undefined || itemUntranslatable(name, field)) {
    field = undefined;
  }

  return field;
}

/**
 * Check if an item is untranslatable.
 * @param {string} property An object's property.
 * @param {object} value value of the property.
 * @return {boolean} true, if item is untranslatable.
 */
function itemUntranslatable(property, value) {
  switch (property) {
    case 'label':
      return false;
      break
    case 'description':
      return false;
      break;
    case 'entity':
      return false;
      break;
    case 'placeholder':
      return false;
      break;
    case 'default':
      switch (typeof(value)) {
        case 'number':
          return true;
          break;
        case 'boolean':
          return true;
          break;
        default:
          return false;
          break;
      }
      break
    default:
      return true;
      break;
  }
}

/**
 * Read file contents.
 *
 * @param {string} path
 * @param {function} next
 */
function readFile(path, next) {
  fs.readFile(path, function (err, data) {
    if (err) {
      next(err.toString().indexOf('no such file or directory') !== -1 || err.toString().indexOf('not a directory') !== -1 ? 'not a library' : err);
    }
    else {
      next(null, data);
    }
  });
}

/**
 * Check if the library head is detached.
 *
 * @param {string} repo
 * @param {function} next
 */
function isHeadDetached(repo, next) {
  readFile(repo + '/.git/HEAD', function (err, head) {
    if (err) return next(err); // Pass errors

    next(null, head.toString().substr(0, 3) !== 'ref');
  });
}

/**
 * Status = skipped
 *
 * @param {string} name
 * @param {string} [msg]
 * @param {function} next
 */
function skipped(name, msg, next) {
  next({
    name: name,
    skipped: true,
    msg: msg
  });
}

/**
 * Status = ok
 *
 * @param {string} name
 * @param {string} [msg]
 * @param {function} next
 */
function ok(name, msg, next) {
  next({
    name: name,
    msg: msg
  });
}

/**
 * Status = failed
 *
 * @param {string} name
 * @param {string} [msg]
 * @param {function} next
 */
function failed(name, msg, next) {
  next({
    name: name,
    failed: true,
    msg: msg
  });
}

/**
 * Bump instances of machine name found in semantics to minor version.
 *
 * @param {Array} semantics Semantics as array of semantic fields
 * @param {number} minorVersion
 *    Minor version that target will be upgraded to
 * @param {string} machineName Machine name of target library as a string
 *
 * @returns {Array}
 *  Returns found semantics field with dependency to machineName
 */
function semanticBump(semantics, minorVersion, machineName) {
  var foundFields = [];

  if (!semantics) {
    return foundFields;
  }

  // Handle semantic types
  semantics.forEach(function (field) {

    // Handle library selector with options
    if (field.type === 'library') {

      // Go through options
      field.options.forEach(function (option, index) {
        if (option.split(' ')[0] === machineName) {
          var majorVersion = option.split(' ')[1].split('.')[0];

          // Update value
          field.options[index] = machineName + ' ' + majorVersion + '.' + minorVersion;
          foundFields.push(majorVersion);
        }
      });
    }
    else if (field.fields) {

      // Handle groups/similar semantics that has array sub-fields
      var foundChildren = semanticBump(field.fields, minorVersion, machineName);
      foundFields = foundFields.concat(foundChildren);
    }
    else if(field.field) {

      // Handle lists/similar semantics that has a single sub-field
      var foundChild = semanticBump([field.field], minorVersion, machineName);
      foundFields = foundFields.concat(foundChild);
    }
  });

  return foundFields;
}

/**
 * Checks if source repo has a dependency to target library
 *
 * @param {string} target Machine name of target library as string
 * @param {number} minorVersion Minor version of target
 * @param {function} next Function which handles dependency
 */
function recursiveBump(target, minorVersion, next) {

  // Check through all repos
  processRepos(['*'], function (repo, done) {
    libraryData(repo, function (error, library) {
      if (error) {
        return skipped(repo, error, done);
      }


      var preloadedDependencies = library.preloadedDependencies || [];

      preloadedDependencies.forEach(function (dependency) {

        if (dependency.machineName === target) {
          dependency.minorVersion = minorVersion;
          process.stdout.write('Preloaded dependency ' +
              '\x1B[1m' + dependency.machineName + '\x1B[0m' +
              ' updated in ' +
              '\x1B[1m' + repo + '\x1B[0m' +
              '\x1B[32m' + ' OK ' + '\x1B[0m' +
              dependency.majorVersion + '.' + minorVersion + '\u000A');
          fs.writeFileSync(repo + '/library.json', JSON.stringify(library, null, 2));

          // Update minor version of library unless already done
          if (collection.indexOf(repo) < 0) {
            collection.push(repo);
            h5p.recursiveMinorBump([repo], next);
          }
        }
      });

      var editorDependencies = library.editorDependencies || [];
      editorDependencies.forEach(function (dep) {
        if (dep.machineName === target) {
          dep.minorVersion = minorVersion;
          process.stdout.write('Editor dependency ' +
              '\x1B[1m' + dep.machineName + '\x1B[0m' +
              ' updated in ' +
              '\x1B[1m' + repo + '\x1B[0m' +
              '\x1B[32m' + ' OK ' + '\x1B[0m' +
              dep.majorVersion + '.' + minorVersion + '\u000A');
          fs.writeFileSync(repo + '/library.json', JSON.stringify(library, null, 2));

          // Update minor version of library unless already done
          if (collection.indexOf(repo) < 0) {
            collection.push(repo);
            h5p.recursiveMinorBump([repo], next);
          }
        }
      });

    });

    readSemantics(repo, function (error, semantics) {
      var foundFields = semanticBump(semantics, minorVersion, target);
      if (foundFields.length) {
        for (var i = 0; i < foundFields.length; i++) {
          process.stdout.write('Semantics dependency ' +
              '\x1B[1m' + target + '\x1B[0m' +
              ' updated in ' +
              '\x1B[1m' + repo + '\x1B[0m' +
              '\x1B[32m' + ' OK ' + '\x1B[0m' +
              foundFields[i] + '.' + minorVersion + '\u000A');
        }

        // Here we have to write to JSON semantics
        fs.writeFileSync(repo + '/semantics.json', JSON.stringify(semantics, null, 2));

        // Update minor version of library unless already done
        if (collection.indexOf(repo) < 0) {
          collection.push(repo);
          h5p.recursiveMinorBump([repo], next);
        }
      }
    });
  }, next);
}

/**
 * Will find lastest version number offset by given versions and then run the
 * given process for each repo not in a detached HEAD state.
 *
 * @param {number} versions Offset
 * @param {Array} repos List of libraries to process.
 * @param {function} process Callback for processing each repo.
 * @param {function} next Callback for when processing is done (displays results).
 */
function getVersions(versions, repos, process, next) {
  processRepos(repos, function (repo, done) {
    isHeadDetached(repo, function (error, yes) {
      if (error) {
        return failed(repo, error, done);
      }
      if (yes) {
        return skipped(repo, 'detached HEAD', done);
      }

      // Find tagged versions
      spawnGit(repo, ['tag', '-l', '--sort=version:refname'], function (error, output) {
        if (error) {
          return failed(repo, error, done);
        }

        var toDiff;
        var tags = output.split('\n');
        var numValidVersions = 0;
        // Newest version is at the end
        for (var i = tags.length - 1; i >= 0; i--) {
          if (tags[i].match(/(\d+)\.(\d+)\.(\d+)/ig)) {
            numValidVersions += 1; // Found a valid version

            // Skip as many versions as specified
            if (numValidVersions === versions) {
              toDiff = tags[i];
              break;
            }
          }
        }
        if (toDiff) {
          process(repo, toDiff, false, done);
        }
        else {
          spawnGit(repo, ['rev-list', '--max-parents=0', 'HEAD'], function (error, output) {
            var firstCommit = output.split('\n')[0];
            process(repo, firstCommit, true, done);
          });
        }
      });
    });
  }, next, true);
}

/**
 * Export our api.
 */
var h5p = module.exports = {};

/**
 * Return list of libraries.
 */
h5p.list = function (next) {
  getRegistry(function (error, libraries) {
    next(error, libraries);
  });
};

/**
 * Creates a new collection and fills it up with the given library and its dependencies.
 */
h5p.get = function (libraries, next) {
  collection = {}; // Start a new collection

  var loop = function (i) {
    getLibrary(libraries[i], function (error) {
      i += 1;
      if (i === libraries.length) return next(error);
      loop(i);
    });
  };
  loop(0);
};

/**
 * Clone the next library in the collection.
 */
h5p.clone = function (next) {
  for (var lib in collection) {
    cloneRepository(lib, collection[lib].repository, next);
    delete collection[lib];
    return lib;
  }
  return false;
};

/**
 * Display status of all checkout libraries.
 */
h5p.status = function (next) {
  findRepositories(function (error, repos) {
    if (error) return next(error);

    var results = [];
    for (var i = 0; i < repos.length; i++) {
      statusRepository(repos[i], function (status) {
        results.push(status);
        if (results.length === repos.length) {
          next(null, results);
        }
      });
    }
  });
};

/**
 * Commit all changes to all libraries.
 */
h5p.commit = function (message, next) {
  findRepositories(function (error, repos) {
    if (error) return next(error);

    var results = [];
    for (var i = 0; i < repos.length; i++) {
      commitRepository(repos[i], message, function (result) {
        results.push(result);
        if (results.length === repos.length) {
          next(null, results);
        }
      });
    }
  });
};

/**
 * Will prepare a collection of repos for pushing/pulling.
 */
h5p.update = function (repos, next) {
  pullushers = []; // Start a new collection

  processRepos(repos, function (repo, done) {
    pullushers.push(repo);
    done();
  }, next);
};

/**
 * Pull the next library in the collection.
 */
h5p.pull = function (next) {
  var repo = pullushers.shift();
  if (!repo) return false;

  pullRepository(repo, next);
  return repo;
};

/**
 * Push the next library in the collection.
 */
h5p.push = function (options, next) {
  // TODO: Use pushRepository and progress

  var repo = pullushers.shift();
  if (!repo) return false;

  var args = ['push'];
  if (options !== undefined) {
    for (var i = 0; i < options.length; i++) {
      args.push(options[i]);
    }
  }
  spawnGit(repo, args, function (error, output) {
    var res = error.substr(0, 2);
    if (res === 'Ev') {
      return next(-1);
    }
    if (res === 'To') {
      output = error.split('\n')[1].replace(/(^\s+|\s+$)/g, '').replace(/\s{2,}/g, ' ');
      if (output.substr(0, 1) === '!') {
        return next(output + '\n');
      }
      if (output.substr(0, 2) === '* ') {
        output = output.substring(2, output.length);
      }
      return next(null, output);
    }

    next(error, output);
  });

  return repo;
};

/**
 * Push the next library in the collection.
 */
h5p.checkout = function (branch, repos, next) {
  processRepos(repos, function (repo, done) {
    checkoutRepository(branch, repo, done);
  }, next);
};



/**
 * Create and push a new branch upstream.
 *
 * @param {String} branch name
 * @param {Array} [repos] list
 * @param {Function} progress callback
 */
h5p.newBranch = function (branch, repos, progress) {
  // Keeps track of previous result
  var result;

  processRepos(repos, PROCESS_SERIAL, function (repo, done) {
    // Progress update
    progress(result, repo);

    // Checkout repo
    checkoutRepository(['-b', branch], repo, function (status) {
      if (status.failed || status.skipped) {
        // Failed or skipped
        result = status;

        // Go to next
        done();
        return;
      }

      // Push our new branch to origin
      pushRepository(['-u', 'origin', branch], repo, function (status) {
        result = status;
        if (!result.skipped && !result.failed) {
          delete result.msg;
        }
        done();
      });
    });
  }, function () {
    // Final progress update
    progress(result);
  });
};

/**
 * Delete branch both locally and upstream.
 *
 * @param {String} branch name
 * @param {Array} [repos] list
 * @param {Function} progress callback
 */
h5p.rmBranch = function (branch, repos, progress) {
  // Keeps track of previous result
  var result;

  processRepos(repos, PROCESS_SERIAL, function (repo, done) {
    // Progress update
    progress(result, repo);

    // Delete locally
    spawnGit(repo, ['branch', '-D', branch], function (error, output) {
      result = {
        name: repo
      };

      if (error) {
        if (error.indexOf('not found.') !== -1) {
          result.skipped = true;
        }
        else {
          result.failed = true;
          result.msg = error;
        }
        done();
        return;
      }

      // Go remote
      pushRepository(['origin', ':' + branch], repo, function (status) {
        result = status;
        done();
      });
    });

  }, function () {
    // Final progress update
    progress(result);
  });
};

/**
 * Get diffs for all repos.
 */
h5p.diff = function (next) {
  findRepositories(function (error, repos) {
    if (error) return next(error);

    var diffs = '', done = 0;
    for (var i = 0; i < repos.length; i++) {
      diffRepository(repos[i], function (error, diff) {
        if (error) return next(error);

        diffs += diff;

        if (done++ === repos.length - 1) next(null, diffs);
      });
    }
  });
};

/**
 * Merge in given branch for given repos.
 *
 * @public
 * @namespace h5p
 */
h5p.merge = function (branch, repos, next) {
  processRepos(repos, function (repo, done) {
    mergeRepository(branch, repo, done);
  }, next);
};

/**
 * Create language file for a given repo
 *
 * @public
 * @namespace h5p
 */
h5p.createLanguageFile = function (repo, languageCode, next) {
  readSemantics(repo, function (error, semantics) {
    var languageFile = repo + '/language/' + languageCode + '.json';
    fs.writeFileSync(languageFile, JSON.stringify({
      semantics: removeUntranslatables(semantics)
    }, null, 2));

    next(languageFile + ' created');
  });
};

/**
 * Pack the given libraries in a .h5p file
 */
h5p.pack = function (repos, file, next) {
  createPack(file, repos, next, function (archive, repo, done) {
    libraryData(repo, function (error, library) {
      var status = {
        name: repo
      };

      if (error) {
        status.skipped = true;
        status.msg = error;
        done(status);
        return;
      }
      var target = library.machineName + '-' + library.majorVersion + '.' + library.minorVersion;
      archiveDir(archive, repo, target);
      status.msg = library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion;
      done(status);
    });
  });
};

/**
 * Recursively bump minor version of repos
 *
 * @param {Array} repos Repositories minor version will be bumped for
 * @param {function} next
 *    Handles the found repos where minor versions has been bumped.
 *    Accepts two arguments (error, repos)
 */
h5p.recursiveMinorBump = function (repos, next) {
  collection = collection || [];

  // Increase minor version of library
  processRepos(repos, function (repo, done) {
    libraryData(repo, function (error, library) {
      if (error) {
        return skipped(repo, error, done);
      }

      var upVersion = function () {
        library.minorVersion++;
        library.patchVersion = 0;
        fs.writeFileSync(repo + '/library.json', JSON.stringify(library, null, 2));
        ok(repo, library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion, done);
      };

      upVersion();

      // Increase minor version of all libraries that has dependency to this library
      recursiveBump(library.machineName, library.minorVersion, next);
    });
  }, next, true);
};

/**
 * Increase patch version on the given libraries, but only if there are changes
 * since their last tag. Use force to override and update anyway.
 *
 * @param {boolean} force
 * @param {Array} repos
 * @param {function} next
 */
h5p.increasePatchVersion = function (force, repos, next) {
  processRepos(repos, function (repo, done) {
    libraryData(repo, function (error, library) {
      if (error) {
        return skipped(repo, error, done);
      }

      isHeadDetached(repo, function (err, yes) {
        if (err) {
          return skipped(repo, err, done);
        }
        if (yes) {
          return skipped(repo, 'detached HEAD', done);
        }

        var upVersion = function () {
          library.patchVersion++;
          fs.writeFileSync(repo + '/library.json', JSON.stringify(library, null, 2));
          ok(repo, library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion, done);
        };

        if (force) {
          return upVersion();
        }

        // Diff current version agains head to check for changes
        spawnGit(repo, ['diff', library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion + '..HEAD'], function (error, output) {
          if (error) {
            if (error.indexOf('fatal: ambiguous argument') !== -1) {
              // Increase patch version if last version wasn't tagged
              output = true;
            }
            else {
              return failed(repo, error, done);
            }
          }
          if (!output) {
            // No diff, no changes
            return skipped(repo, undefined, done);
          }

          upVersion();
        });
      });
    });
  }, next, true);
};

/**
 * Add tag with library version number.
 *
 * @public
 * @param {Array} repos
 * @param {Function} next
 */
h5p.tagVersion = function (repos, next) {
  processRepos(repos, function (repo, done) {
    libraryData(repo, function (error, library) {
      var status = {
        name: repo
      };

      if (error) {
        status.failed = true;
        status.msg = error;
        done(status);
        return;
      }

      var version = library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion;
      spawnGit(repo, ['tag', version], function (error, output) {
        if (error !== '') {
          if (error.indexOf('already exists') !== -1) {
            status.skipped = true;
          }
          else {
            status.failed = true;
            status.msg = error;
          }
        }
        else {
          status.msg = version;
        }

        done(status);
      });

    });
  }, next);
};

/**
 * Will find file changes for the given number of last versions.
 *
 * @param {number} versions Offset
 * @param {Array} repos List of libraries to process.
 * @param {function} next Callback for when processing is done (displays results).
 */
h5p.changesSince = function (versions, repos, next) {
  getVersions(versions, repos, function (repo, version, initialCommit, done) {
    spawnGit(repo, ['diff', '--stat', version + '..HEAD'], function (error, output) {
      if (error) {
        return failed(repo, error, done);
      }

      ok(repo, {version: (initialCommit ? 'Initial Commit' : version), changes: output}, done);
    });
  }, next);
};

/**
 * Will find commits for the given number of last versions.
 *
 * @param {number} versions Offset
 * @param {Array} repos List of libraries to process.
 * @param {function} next Callback for when processing is done (displays results).
 */
h5p.commitsSince = function (versions, repos, next) {
  getVersions(versions, repos, function (repo, version, initialCommit, done) {
    spawnGit(repo, ['log', '--oneline', version + '..HEAD'], function (error, output) {
      if (error) {
        return failed(repo, error, done);
      }

      ok(repo, {version: (initialCommit ? 'Initial Commit' : version), changes: output}, done);
    });
  }, next);
};

h5p.importLanguageFiles = function (dir, next) {
  // Check if dir exists.
  fs.readdir(dir, function (error, repos) {
    if (error) return next(error);

    // Get libraries with dir sub folders
    processRepos(repos, function (repo, done) {
      var status = {
        name: repo
      };

      // Look for language files
      var langDir = dir + '/' + repo + '/language';
      fs.readdir(langDir, function (error, languageFiles) {
        if (error) {
          if (error.errno === 34) {
            status.skipped = true;
            status.msg = 'no language folder found';
          }
          else {
            status.failed = true;
            error = error;
          }

          return done(status);
        }

        // Process language files
        parallel(languageFiles, function (index, file, nextFile) {
          var lang = file.match(/^([a-z]{2}).json$/);
          if (!lang) {
            // Not correct file format, skip
            return nextFile(null);
          }

          var fileStatus = {
            lang: lang[1].toUpperCase()
          };

          // Copy file
          toUTF8(langDir + '/' + file, function (err, json) {
            if (err) {
              fileStatus.failed = true;
              fileStatus.msg = err;
              return nextFile(fileStatus);
            }

            try {
              var translation = JSON.parse(json);
              fs.writeFileSync(repo + '/language/' + file, JSON.stringify(translation, null, 2), {flag: 'w'});
            }
            catch (error) {
              // Failed to add / invalid format
              fileStatus.failed = true;
              fileStatus.msg = error;
            }
            // TODO: Should we count translations / missing ?

            nextFile(fileStatus);
          });
        }, function (err, results) {

          // Process results
          var added = [];
          var failed = [];

          for (var i = 0; i < results.length; i++) {
            if (!results[i]) {
              continue;
            }

            if (results[i].failed) {
              failed.push(results[i].lang);
            }
            else {
              added.push(results[i].lang);
            }
          }

          if (added.length) {
            status.msg = 'added ' + added.join(', ');
          }
          if (failed.length) {
            status.failed = true;
            if (!status.msg) {
              status.msg = '';
            }
            status.msg = (status.msg ? status.msg + ', ' : '') + 'failed to add ' + failed.join(', ');
          }
          done(status);
        });
      });
    }, next);
  });
};

/**
 * Will populate language files with the original texts.
 *
 * @param {string} languageCode
 * @param {string[]} repos
 * @param {function} next
 */
h5p.addOriginalTexts = function (languageCode, repos, next) {
  processRepos(repos, function (repo, done) {
    // Keep track of the status for the current repo
    var status = {
      name: repo
    };

    // Define the files we need
    var fileNames = {
      semantics: repo + '/semantics.json',
      translation: repo + '/language/' + languageCode + '.json'
    };

    readJSONFiles(fileNames, function (files) {
      // Error handling
      if (files.semantics.error) {
        status.msg = files.semantics.error;
      }
      else if (files.translation.error && files.translation.error !== 'not a library') {
        status.msg = files.translation.error;
      }
      if (status.msg) {
        status.failed = true;
        return done(status);
      }

      // Update translation
      var translation = files.translation.content || {};
      translation.semantics = updateTranslationFields(files.semantics.content, translation.semantics, function (field, attr, source, target) {
        if (attr === 'label' || attr === 'description' || attr === 'entity' || (attr === 'default' && field.type === 'text')) {
          target['english' + attr[0].toUpperCase() + attr.substr(1)] = field[attr];
          target[attr] = (source !== undefined && source[attr] !== undefined ? source[attr] : 'TODO');
          return true;
        }
      });

      // Write changes
      writeJSONFile(fileNames.translation, translation, function (err) {
        if (err) {
          status.failed = true;
          status.msg = err;
        }
        done(status);
      });
    });
  }, next);
};

/**
 * Will use on translation to create another.
 *
 * @param {string} from Language Code
 * @param {string} to Language Code
 * @param {string[]} repos
 * @param {function} next
 */
h5p.copyTranslation = function (from, to, repos, next) {
  processRepos(repos, function (repo, done) {
    // Keep track of the status for the current repo
    var status = {
      name: repo
    };

    // The file we need
    var fileNames = {
      source: repo + '/language/' + from + '.json'
    };
    readJSONFiles(fileNames, function (files) {
      // Handle errors reading file
      if (files.source.error) {
        status.msg = files.source.error;
        status.failed = true;
        return done(status);
      }

      // Get last commit for source
      spawnGit(repo, ['log', '-n 1', '--format=%h %at ', 'language/' + from + '.json'], function (error, output) {
        if (error) {
          status.msg = error;
          status.failed = true;
          return done(status);
        }

        // Add last commit id and date to translation
        var target = {};
        if (output) {
          output = output.split(' ');
          target.commit = output[0];
          target.date = output[1];
        }

        // Create target
        target.semantics = updateTranslationFields(files.source.content.semantics, undefined, function (field, attr, source, target) {
          if (attr.substr(0, 7) === 'english') {
            // Keep original values
            target[attr] = field[attr];
            return true;
          }
          if (attr === 'label' || attr === 'description' || attr === 'entity' || attr === 'default') {
            target[attr] = 'TODO';
            return true;
          }
        });

        // Write changes
        writeJSONFile(repo + '/language/' + to + '.json', target, function (err) {
          if (err) {
            status.failed = true;
            status.msg = err;
          }
          done(status);
        });
      });
    });
  }, next);
};

/**
 * Will use on translation to create another.
 *
 * @param {string} from Language Code
 * @param {string} to Language Code
 * @param {string[]} repos
 * @param {string} file
 * @param {function} next
 */
h5p.packTranslation = function (lang, repos, file, next) {
  createPack(file, repos, next, function (archive, repo, done) {
    var file = repo + '/language/' + lang + '.json';
    readFile(file, function (error, content) {
      var added = false;
      if (!error && content) {
        archive.append(content, {name: file});
        added = true;
      }
      done(added);
    });
  });
};

/**
 * Makes it easier to create a package based on a list of repos
 *
 * @private
 * @param {string} file
 * @param {string[]} repos
 * @param {function} next
 * @param {function} process
 */
var createPack = function (file, repos, next, process) {
  var output = fs.createWriteStream(file);
  var archive = archiver('zip');
  var error, results;
  output.on('close', function () {
    next(error, results);
  });
  archive.on('error', function (err) {
    next(err);
  });
  archive.pipe(output);
  processRepos(repos, PROCESS_SKIP_CHECK, function (repo, done) {
    process(archive, repo, done);
  }, function (err, res) {
    error = err;
    results = res;
    archive.finalize();
  });
};

/**
 * Will read multiple JSON files simultaneously.
 *
 * @private
 * @param {object} fileNames
 * @param {function} next
 */
var readJSONFiles = function (fileNames, next) {
  // Must use array, object not supported
  var filesToRead = [];
  for (var name in fileNames) {
    filesToRead.push(fileNames[name]);
  }

  // Read files in parallel
  parallel(filesToRead, function (index, file, fileRead) {
    readFile(file, function (error, content) {
      // File has been read, try to parse JSON
      if (!error) {
        try {
          content = JSON.parse(content);
        }
        catch (err) {
          error = err;
        }
      }
      // Return a status object
      fileRead({
        file: file,
        error: error,
        content: content
      });
    });
  }, function (error, fileStatus) {
    // All files have been read. Make it easy to map up content.
    var fileResults = {};
    for (var i = 0; i < fileStatus.length; i++) {
      var file = fileStatus[i];

      // Find key
      for (var fileKey in fileNames) {
        if (fileNames[fileKey] === file.file) {
          break;
        }
      }
      fileResults[fileKey] = file;
    }
    next(fileResults);
  });
};

/**
 * Will write the given content to a single JSON file.
 *
 * @private
 * @param {string} file
 * @param {*} content
 * @param {function} next
 */
var writeJSONFile = function (file, content, next) {
  var json;
  try {
    json = JSON.stringify(content, null, 2);
  }
  catch (error) {
    return next(error);
  }

  fs.writeFile(file, json, function (err) {
    next(err);
  });
};

/**
 * @private
 * @param {Array} semantics
 * @param {Array} [translation]
 * @returns {Array}
 */
var updateTranslationFields = function (semantics, translation, handler) {
  var updated = false;
  if (translation === undefined) {
    translation = [];
  }
  for (var i = 0; i < semantics.length; i++) {
    translation[i] = updateTranslationField(semantics[i], translation[i], handler);
    if (translation[i] !== undefined) {
      updated = true;
    }
    else {
      translation[i] = {};
    }
  }
  return updated ? translation : undefined;
};

/**
 * @private
 * @param {object} field
 * @param {object} [oldTranslation]
 * @returns {object}
 */
var updateTranslationField = function (field, oldTranslation, handler) {
  var updatedTranslation = {};
  var updated = false;
  for (var attr in field) {
    if (attr === 'field') {
      // Process single sub-field
      updatedTranslation.field = updateTranslationField(field.field, oldTranslation !== undefined ? oldTranslation.field : undefined, handler);
      if (updatedTranslation.field !== undefined) {
        updated = true;
      }
    }
    else if (attr === 'fields' || attr === 'widgets' || attr === 'options') {
      // Process multiple sub-fields
      updatedTranslation[attr] = updateTranslationFields(field[attr], oldTranslation !== undefined ? oldTranslation[attr] : undefined, handler);
      if (updatedTranslation[attr] !== undefined) {
        updated = true;
      }
    }
    else {
      var status = handler(field, attr, oldTranslation, updatedTranslation);
      if (!updated && status) {
        updated = true;
      }
    }
  }

  return updated ? updatedTranslation : undefined;
};

// TODO: Add pre-commit hook?
//var preCommit = '#!/bin/sh\
//\
//h5p=$(which h5p)\
//if [ ! -f "$h5p" ]; then\
//  echo "Missing h5p command. Patch version not increased."\
//else\
//  lib=${PWD##*/}\
//  cd .. && "$h5p" increase-patch-version "$lib"\
//  cd "$lib" && git add .\
//fi'
