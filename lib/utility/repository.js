const fs = require('fs');
const child = require('child_process');
const env = process.env;
env.GIT_SSH = __dirname + '/../bin/h5p-ssh';

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

const readJson = function (repo, file) {
  try {
    const jsonFile = fs.readFileSync(repo + file);
    return JSON.parse(jsonFile);
  }
  catch (err) {
    if (err.toString().indexOf('no such file or directory') !== -1 || err.toString().indexOf('not a directory') !== -1) {
      err = 'not a library';
    }
    return err;
  }
};

const getLibraryData = function (repo) {
  return readJson(repo, '/library.json');
};

module.exports = {
  statusRepository,
  getLibraryData
};
