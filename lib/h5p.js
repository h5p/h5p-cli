/**
 * Requirements
 */
var http = require('http');
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
env['GIT_SSH'] = __dirname + '/../bin/h5p-ssh';
// TODO: Try to start ssh-agent if env['SSH_AUTH_SOCK'] is missing?

// Allowed file pattern to test packed files again. If files do not pass they are ignored.
var allowedFilePattern = (process.env.H5P_ALLOWED_FILE_PATTERN !== undefined ? new RegExp(process.env.H5P_ALLOWED_FILE_PATTERN, process.env.H5P_ALLOWED_FILE_MODIFIERS) : /\.(json|png|jpg|jpeg|gif|bmp|tif|tiff|svg|eot|ttf|woff|otf|webm|mp4|ogg|mp3|txt|pdf|rtf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|xml|csv|diff|patch|swf|md|textile|js|css)$/);

// Use env ignore pattern or default(ignores tmp files and hidden files).
var ignorePattern = (process.env.H5P_IGNORE_PATTERN !== undefined ? new RegExp(process.env.H5P_IGNORE_PATTERN, process.env.H5P_IGNORE_MODIFIERS) : /^\.|~$/gi);

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
      if (all) {
        // No need to check if repo is valid, just process
        process(value, done);
        return;
      }

      // Find valid repo and process
      for (var i = 0; i < validRepos.length; i++) {
        if (validRepos[i] === value) {
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
 * Loads library data for given repo
 *
 * @private
 * @param {String} repo
 * @param {Function} next
 */
function libraryData(repo, next) {
  try {
    next(null, JSON.parse(fs.readFileSync(repo + '/library.json')));
  }
  catch (err) {
    if (err.toString().indexOf('no such file or directory') !== -1 || err.toString().indexOf('not a directory') !== -1) {
      err = 'not a library';
    }
    next(err);
  }
}

/**
 * Loads semantics data for given repo
 *
 * @private
 * @param {String} repo
 * @param {Function} next
 */
function readSemantics(repo, next) {
  try {
    next(null, JSON.parse(fs.readFileSync(repo + '/semantics.json')));
  }
  catch (err) {
    if (err.toString().indexOf('no such file or directory') !== -1 || err.toString().indexOf('not a directory') !== -1) {
      err = 'not a library';
    }
    next(err);
  }
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

    if (field.length === 0) {
      field = undefined;
    }
  }
  else if (name === undefined || (name !== 'label' && name !== 'description' && name !== 'entity')) {
    field = undefined;
  }

  return field;
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
  for (lib in collection) {
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
    checkoutRepository(['-b', branch], repo, function (status) {
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
  }, function (err, res) {
    error = err;
    results = res;
    archive.finalize();
  });
};

/**
 * Pack the given libraries in a .h5p file
 */
h5p.increasePatchVersion = function (repos, next) {
  processRepos(repos, function (repo, done) {
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

      library.patchVersion++;
      fs.writeFileSync(repo + '/library.json', JSON.stringify(library, null, 2));
      status.msg = library.majorVersion + '.' + library.minorVersion + '.' + library.patchVersion;
      done(status);
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

// TODO: Add pre-commit hook?
var preCommit = '#!/bin/sh\
\
h5p=$(which h5p)\
if [ ! -f "$h5p" ]; then\
  echo "Missing h5p command. Patch version not increased."\
else\
  lib=${PWD##*/}\
  cd .. && "$h5p" increase-patch-version "$lib"\
  cd "$lib" && git add .\
fi'
