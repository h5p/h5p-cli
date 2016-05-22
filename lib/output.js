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

const output = {

  /**
   * Print results for repositories.
   *
   * @param {Object|Array} repos
   */
  printResults(repos) {
    // Check if object or array
    if (repos instanceof Object) {
      outputResult(repos);
    }
    else if (repos instanceof Array) {
      repos.forEach(function (repo) {
        outputResult(repo);
      });
    }
  },

  printError(error) {
    return process.stdout.write(error + lf);
  }
};

module.exports = output;
