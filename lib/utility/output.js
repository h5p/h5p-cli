const lf = '\u000A';
const color = {
  default: '\x1B[0m',
  emphasize: '\x1B[1m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  red: '\x1B[31m'
};

/**
 * Print status message for repository
 * @param {Object} repo
 */
function outputResult(repo) {
  process.stdout.write(color.emphasize + repo.name + color.default);

  if (repo.failed) {
    process.stdout.write(' ' + color.red + 'FAILED' + color.default);
  }
  else if (repo.skipped) {
    process.stdout.write(' ' + color.yellow + 'SKIPPED' + color.default);
  }
  else {
    process.stdout.write(' ' + color.green + 'OK' + color.default);
  }

  if (repo.msg) {
    process.stdout.write(' ' + repo.msg);
  }

  process.stdout.write(lf);
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
 * Print error message
 *
 * @param {string} error
 */
const printError = function (error) {
  process.stdout.write(error + lf);
};

/**
 * Print line
 *
 * @param {string} text
 */
const printLn = function (text) {
  process.stdout.write(text + lf);
};

module.exports = {
  color,
  printResults,
  printError,
  printLn
};
