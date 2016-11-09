const Input = require('../utility/input');
const output = require('../utility/output');
const path = require('path');
const spawn = require('cross-spawn');
const fs = require('fs');

const FLAGS = {
  ONLY_TEST: '-t'
};

module.exports = function (...inputList) {
  const input = new Input(inputList);
  const onlyTest = input.hasFlag(FLAGS.ONLY_TEST);
  input.init().then(() => {
      const libraries = input.getLibraries();
      libraries.forEach(processPackage.bind(this, onlyTest));
    });
};

function processPackage(onlyTest, library) {
  hasPackage({onlyTest, library: library.toString()})
    .then(installDependencies)
    .then(buildPackage)
    .then(testPackage)
    .then(output.printResults)
    .catch(output.printResults);
}

function hasPackage({onlyTest, library}) {
  return new Promise((resolve, reject) => {
    fs.access(path.resolve(process.cwd(), library, 'package.json'), err => {
      if (err) {
        reject({
          name: library,
          skipped: true
        });
      }
      resolve({onlyTest, library});
    });
  })
}

function testPackage({library}) {
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

function buildPackage({onlyTest, library}) {
  if (onlyTest) {
    return Promise.resolve({onlyTest, library});
  }

  const spawnProcess = spawn('npm', ['run', 'build'], {
    cwd: path.resolve(process.cwd(), library)
  });

  return new Promise(resolve => {
    spawnProcess.on('close', () => {
      resolve({onlyTest, library});
    });
  })
}

function installDependencies({onlyTest, library}) {
  if (onlyTest) {
    return Promise.resolve({onlyTest, library});
  }

  const spawnProcess = spawn('npm', ['install'], {
    cwd: path.resolve(process.cwd(), library)
  });

  return new Promise(resolve => {
    spawnProcess.on('close', () => {
      resolve({onlyTest, library});
    });
  })
}
