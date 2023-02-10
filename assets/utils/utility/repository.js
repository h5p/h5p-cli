const fs = require('fs');
const child = require('child_process');
const env = process.env;
//env.GIT_SSH = __dirname + '../../bin/h5p-ssh';

/**
 * Find status lines for the given repo.
 * @param {string} repo Repository name
 */
const statusRepository = function (repo) {
  const status = {
    name: repo
  };

  return new Promise((resolve, reject) => {
    var proc =
      child.spawn('git', ['status', '--porcelain', '--branch'],
        {
          cwd: process.cwd() + '/' + repo,
          env: env
        });

    proc.on('error', function (error) {
      status.error = error;
      reject(status);
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

      resolve(status);
    });
  });
};

/**
 * Read json file and parse it
 * @param {string} repo Directory of file
 * @param {string} fileName Name of file
 * @return {*} Parsed JSON file
 */
const readJson = function (repo, fileName) {
  try {
    // TODO: Make this async
    const jsonFile = fs.readFileSync(repo + fileName);
    return JSON.parse(jsonFile);
  }
  catch (err) {
    var errorMessage = err;
    if (err.toString().indexOf('no such file or directory') !== -1 || err.toString().indexOf('not a directory') !== -1) {
      errorMessage = 'not a library';
    }
    return errorMessage;
  }
};

/**
 * Get library data from library.json file in H5P library
 * @param {string} repo Directory of library.json
 * @return {*} Parsed JSON data
 */
const getLibraryData = function (repo) {
  return readJson(repo, '/library.json');
};

/**
 * Get translation object of given language
 *
 * @param {string} repo Directory of library
 * @param {string} languageCode Language code of translation
 * @return {Object} Parsed JSON data
 */
const getLanguageData = function (repo, languageCode) {
  return readJson(repo, `/language/${languageCode}.json`);
};

const isEditorLibrary = function (libraryJson) {
  const machineName = libraryJson.machineName;
  return (machineName.startsWith('H5PEditor') || machineName === 'H5P.DragNBar') &&
         libraryJson.runnable === 0;
};

module.exports = {
  statusRepository,
  getLibraryData,
  getLanguageData,
  isEditorLibrary
};
