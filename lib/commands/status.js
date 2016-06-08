const Input = require('../utility/input');
const output = require('../utility/output');
const h5p = require('../h5p');

const status = function (...arguments) {
  const input = new Input(arguments);
  const force = input.hasFlag('-f');
  const libraries = input.getLibraries();

  h5p.status(libraries)
    .then((repositories) => {
      // Print status for chosen libraries
      repositories
        .filter(repo => repo.error || repo.changes || force)
        .forEach((repo) => {
          output.printStatus(repo);
        });
    })
    .catch((err) => {
      output.printError(err);
    });
};

module.exports = status;
