const lf = '\u000A';
const color = {
  default: '\x1B[0m',
  emphasize: '\x1B[1m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  red: '\x1B[31m'
};

/**
 * Output function for sending message
 * @param {string} message
 */
function out(message) {
  // May send to a gui at some point
  process.stdout.write(message);
}

/**
 * Print status message for repository
 * @param {Object} repo
 */
function outputResult(repo) {
  outputRepo(repo);

  if (repo.failed) {
    out(' ' + color.red + 'FAILED' + color.default);
  }
  else if (repo.skipped) {
    out(' ' + color.yellow + 'SKIPPED' + color.default);
  }
  else {
    out(' ' + color.green + 'OK' + color.default);
  }

  if (repo.msg) {
    out(' ' + repo.msg);
  }

  out(lf);
}

function outputRepo(repo) {
  out(color.emphasize + repo.name + color.default);
}

/**
 * Print results for repositories.
 *
 * @param {Object|Array} repositories GitHub repositories
 */
const printResults = function (repositories) {
  // Check if array
  if (repositories instanceof Array) {
    repositories.forEach(function (repo) {
      outputResult(repo);
    });
  }
  else if (repositories instanceof Object) {
    outputResult(repositories);
  }
};

/**
 * Print status of github repositories with changes
 *
 * @param {Object} repo
 * @param {string} repo.branch
 * @param {string} repo.error
 * @param {Array|undefined} repo.changes
 */
const printStatus = function (repo) {
  outputRepo(repo);
  if (repo.branch) {
    out(' (' + repo.branch + ')');
  }
  out(lf);

  if (repo.error) {
    out(repo.error + lf);
  }
  else if (repo.changes !== undefined) {
    out(repo.changes.join(lf) + lf);
  }
};

/**
 * Print error message
 *
 * @param {string} error
 */
const printError = function (error) {
  out(error + lf);
};

/**
 * Print line
 *
 * @param {string} text
 */
const printLn = function (text) {
  out(text + lf);
};

module.exports = {
  color,
  printStatus,
  printResults,
  printError,
  printLn
};
