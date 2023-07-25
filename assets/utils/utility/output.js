const lf = '\u000A';
const cr = '\u000D';
const color = {
  default: '\x1B[0m',
  emphasize: '\x1B[1m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  red: '\x1B[31m'
};

var noCr = (process.platform === 'win32');

/**
 * @typedef {Object} Repo Repository
 * @property {string} [name] Repository name
 * @property {boolean} [failed] Repository failed
 * @property {boolean} [skipped] Skipped repository
 * @property {string} [msg] Message describing status
 * @property {string} [branch] Name of repository branch
 * @property {string} [error] Error message for repository
 * @property {string[]} [changes] Array of changes made to repository
 */

function emphasizeExpressions(strings, ...expressions) {
  let emphasizedString = '';
  expressions.forEach((expression, index) => {
    emphasizedString +=
      `${strings[index]} \'${color.emphasize}${expression}${color.default}\'`
  });
  emphasizedString += strings[strings.length - 1];
  return emphasizedString;
}

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
      process.stdout.write(' ' + result);
    };

    // Start spinner
    process.stdout.write(prefix);
    interval = setInterval(function () {
      process.stdout.write('.');
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
      process.stdout.write(cr + prefix + ' ' + result);
    };

    // Start spinner
    interval = setInterval(function () {
      out(cr + prefix + ' ' + color.emphasize + parts[curPos++] + color.default);
      if (curPos === maxPos) curPos = 0;
    }, 100);
  }

  this.failed = function (error) {
    this.stop(`${getFailedMsg()} ${lf} ${error}`);
  };

  this.succeeded = function (result) {
    this.stop(`${getOkMsg()}${result ? ' ' + result : ''}${lf}`);
  };
}

/**
 * Output function for sending message
 * @param {string} message
 */
function out(message) {
  // May send to a gui at some point
  process.stdout.write(message);
}

function getFailedMsg() {
  return `${color.red}FAILED${color.default}`
}

function getSkippedMsg() {
  return `${color.yellow}SKIPPED${color.default}`
}

function getOkMsg() {
  return `${color.green}OK${color.default}`
}

/**
 * Print status message for repository
 * @param {Repo} repo Repository
 */
function outputResult(repo) {
  outputRepo(repo);

  if (repo.failed) {
    out(` ${getFailedMsg()}`);
  }
  else if (repo.skipped) {
    out(` ${getSkippedMsg()}`);
  }
  else {
    out(` ${getOkMsg()}`);
  }

  if (repo.msg) {
    out(' ' + repo.msg);
  }

  out(lf);
}

/**
 * Output repository information
 * @param {Repo} repo Repository
 */
function outputRepo(repo) {
  if (repo.name) {
    out(color.emphasize + repo.name + color.default);
  }
}

/**
 * Print results for repositories.
 *
 * @param {Repo|Array} [repositories] GitHub repositories
 */
const printResults = function (repositories) {
  repositories = repositories || {};

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
 * @param {Repo} repo
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
 * Print status of pulled GitHub repositories
 *
 * @param {Repo|Array} repo
 */
const printPulled = function (repo) {
  if (!repo) {
    return;
  }

  // Process multiple repositories
  if (Array.isArray(repo)) {
    sortLexically(repo);
    repo.forEach(singleRepo => {
      printPulled(singleRepo);
    });
    printLn('');
    printPulledSummary(repo);
    return;
  }

  outputRepo(repo);

  if (repo.error) {
    out(` ${getFailedMsg() + lf + repo.msg}`);
  }
  else {
    out(` ${getOkMsg()} ${repo.msg}`);
  }
};

/**
 * Sort repositories lexically on their names
 *
 * @param {Array} repos Repositories that will be sorted
 */
const sortLexically = (repos) => {
  // sort lexically
  repos.sort((a, b) => {
    if (a.name > b.name) {
      return -1;
    }
    else if (a.name < b.name) {
      return 1;
    }
    else {
      return 0;
    }
  });
};

/**
 * Prints summary of pulled GitHub repositories
 * @param {Array} repos
 */
const printPulledSummary = (repos) => {
  const summary = summarizeRepos(repos);

  out(`Finished processing ${summary.total} repositories${lf}`);

  if (summary.upToDate) {
    out(`${summary.upToDate} ${repoPlural(summary.upToDate)} already up to date.${lf}`);
  }

  if (summary.updated) {
    out(`${summary.updated} ${repoPlural(summary.updated)} updated.${lf}`);
  }

  if (summary.failed) {
    out(`${summary.failed} ${repoPlural(summary.failed)} failed.${lf}`);
  }
};

/**
 * Summarize repositories statuses into buckets
 *
 * @param {Array} repos
 * @return {Object} Summary of repository statuses
 */
const summarizeRepos = (repos) => {
  const summary = repos.reduce((prev, curr) => {
    if (curr.error) {
      prev.failed = prev.failed ? prev.failed + 1 : 1;
    }
    else if (curr.msg.includes('Already up-to-date')) {
      prev.upToDate = prev.upToDate ? prev.upToDate + 1 : 1;
    }
    else {
      prev.updated = prev.updated ? prev.updated + 1 : 1;
    }

    return prev;
  }, {});
  summary.total = repos.length;

  return summary;
};

/**
 * Returns proper plural form of repository, given number of repositories
 *
 * @param {number} numRepos Number of repositories
 * @return {string} Proper plural form of repository, given amount of repositories
 */
const repoPlural = (numRepos) => {
  return numRepos === 1 ? 'repository' : 'repositories';
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
 * @param {string} [text]
 */
const printLn = function (text) {
  text = text || '';
  out(text + lf);
};

module.exports = {
  color,
  printStatus,
  printPulled,
  printResults,
  printError,
  printLn,
  Spinner,
  emphasizeExpressions
};
