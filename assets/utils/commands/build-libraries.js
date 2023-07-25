const Input = require('../utility/input');
const output = require('../utility/output');
const path = require('path');
const fs = require('fs');
const child = require('child_process');

/**
 * Available flags
 *
 * @type {Object}
 */
const FLAGS = {
  ONLY_TEST: ['-t', '-test'],
  INSTALL: ['-i', '-install']
};

/**
 * Exports function for building libraries
 *
 * @param inputList
 */
module.exports = function (...inputList) {
  const input = new Input(inputList);
  const testLibraries = input.hasFlag(FLAGS.ONLY_TEST);
  const installLibraries = input.hasFlag(FLAGS.INSTALL);
  const options = {
    testLibraries,
    installLibraries
  };
  input.init().then(() => {
    const libraries = input.getLibraries();
    libraries.forEach(processPackage.bind(this, options));
  });
};

/**
 * Build libraries and test them
 *
 * @param {Object} options Options
 * @param {string} library Libraries that should be processed
 */
function processPackage(options, library) {
  hasPackage({ options, library: library.toString() })
    .then(installDependencies)
    .then(buildPackage)
    .then(testPackage)
    .then(({ library }) => {
      output.printResults({ name: library, msg: 'Build complete' })
    })
    .catch(repo => output.printResults(repo));
}

/**
 * Checks if libraries has package.json
 *
 * @param {Object} options Options
 * @param {string} library Libraries that will be checked
 * @return {Promise} Resolves if package.json exists for library, else rejects with library
 */
function hasPackage({ options, library }) {
  return new Promise((resolve, reject) => {
    fs.access(path.resolve(process.cwd(), library, 'package.json'), err => {
      if (err) {
        reject({
          name: library,
          skipped: true
        });
      }
      resolve({ options, library });
    });
  })
}

/**
 * Runs automated tests - 'npm test' for library
 *
 * @param {Object} options Options
 * @param {string} library Name of library
 * @return {Promise} Resolves with the status of the automated test when it has been run
 */
function testPackage({ options, library }) {
  if (!options.testLibraries) {
    return Promise.resolve({ options, library });
  }

  let failed = false;
  const spawnProcess = child.spawn('npm', ['test'], {
    cwd: path.resolve(process.cwd(), library),
    shell: true
  });

  spawnProcess.stderr.on('data', () => {
    failed = true;
  });

  return new Promise(resolve => {
    spawnProcess.on('close', () => {
      resolve({
        name: library,
        failed
      });
    });
  })
}

/**
 * Build/transpile package
 *
 * @param {Object} options
 * @param {string} library Name of library
 * @return {Promise} Resolves when build processes of package has been completed or skipped
 */
function buildPackage({ options, library }) {
  const spawnProcess = child.spawn('npm', ['run', 'build', '--if-present'], {
    cwd: path.resolve(process.cwd(), library),
    shell: false,
  });

  return new Promise((resolve, reject) => {
    // Not successful if no output
    let success = false;
    spawnProcess.stdout.on('data', data => {
      success = true;
    });

    spawnProcess.on('close', code => {
      // Check for error codes
      if (code > 0) {
        reject({
          name: library,
          failed: true,
        });
      }

      // Most likely no build script found
      if (!success) {
        reject({
          name: library,
          skipped: true,
        });
      }

      resolve({ options, library });
    });
  })
}

/**
 * Install dependencies found in package.json
 *
 * @param {Object} options
 * @param {string} library Name of library
 * @return {Promise} Resolves when dependencies has been installed or skipped
 */
function installDependencies({ options, library }) {
  if (!options.installLibraries) {
    return Promise.resolve({ options, library });
  }

  const spawnProcess = child.spawn('npm', ['install'], {
    cwd: path.resolve(process.cwd(), library),
    shell: true
  });

  return new Promise(resolve => {
    spawnProcess.on('close', () => {
      resolve({ options, library });
    });
  })
}
