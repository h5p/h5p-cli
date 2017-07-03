const Input = require('../utility/input');
const output = require('../utility/output');
const path = require('path');
const spawn = require('cross-spawn');
const fs = require('fs');

/**
 * Available flags
 *
 * @type {Object}
 */
const FLAGS = {
  ONLY_TEST: ['-t', '-test']
};

/**
 * Exports function for building libraries
 *
 * @param inputList
 */
module.exports = function (...inputList) {
  const input = new Input(inputList);
  const testLibraries = input.hasFlag(FLAGS.ONLY_TEST);
  input.init().then(() => {
      const libraries = input.getLibraries();
      libraries.forEach(processPackage.bind(this, testLibraries));
    });
};

/**
 * Build libraries and test them
 *
 * @param {boolean} testLibraries If true the libraries will also be tested
 * @param {string} library Libraries that should be processed
 */
function processPackage(testLibraries, library) {
  hasPackage({testLibraries, library: library.toString()})
    .then(installDependencies)
    .then(buildPackage)
    .then(testPackage)
    .then(({library}) => {
      output.printResults({name: library, msg: 'Build complete'})
    })
    .catch(repo => output.printResults(repo));
}

/**
 * Checks if libraries has package.json
 *
 * @param {boolean} testLibraries Also test libraries
 * @param {string} library Libraries that will be checked
 * @return {Promise} Resolves if package.json exists for library, else rejects with library
 */
function hasPackage({testLibraries, library}) {
  return new Promise((resolve, reject) => {
    fs.access(path.resolve(process.cwd(), library, 'package.json'), err => {
      if (err) {
        reject({
          name: library,
          skipped: true
        });
      }
      resolve({testLibraries, library});
    });
  })
}

/**
 * Runs automated tests - 'npm test' for library
 *
 * @param {string} testLibraries If true will test libraries
 * @param {string} library Name of library
 * @return {Promise} Resolves with the status of the automated test when it has been run
 */
function testPackage({testLibraries, library}) {
  if (!testLibraries) {
    return Promise.resolve({testLibraries, library});
  }

  let failed = false;
  const spawnProcess = spawn('npm', ['test'], {
    cwd: path.resolve(process.cwd(), library)
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
 * @param {boolean} testLibraries
 * @param {string} library Name of library
 * @return {Promise} Resolves when build processes of package has been completed or skipped
 */
function buildPackage({testLibraries, library}) {
  const spawnProcess = spawn('npm', ['run', 'build'], {
    cwd: path.resolve(process.cwd(), library)
  });

  return new Promise(resolve => {
    spawnProcess.on('close', () => {
      resolve({testLibraries, library});
    });
  })
}

/**
 * Install dependencies found in package.json
 *
 * @param {boolean} testLibraries
 * @param {string} library Name of library
 * @return {Promise} Resolves when dependencies has been installed or skipped
 */
function installDependencies({testLibraries, library}) {
  const spawnProcess = spawn('npm', ['install'], {
    cwd: path.resolve(process.cwd(), library)
  });

  return new Promise(resolve => {
    spawnProcess.on('close', () => {
      resolve({testLibraries, library});
    });
  })
}
