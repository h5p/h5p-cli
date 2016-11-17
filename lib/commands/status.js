const Input = require('../utility/input');
const output = require('../utility/output');
const h5p = require('../h5p');
const repository = require('../utility/repository');

/**
 * Returns repository status for given libraries
 *
 * @param {Array} repositories Repositories that will be checked
 * @param {Array|undefined} [libraries] If specified given libraries will
 *    be checked. Otherwise checks all repositories.
 *
 * @return {Promise<Array|Error>}
 */
const getRepositoriesStatus = function (repositories, libraries) {
  return Promise.all(
    repositories
      .filter(repo => libraries.length > 0 ? libraries.indexOf(repo) >= 0 : true)
      .map(repo => repository.statusRepository(repo))
  );
};

/**
 * Output repositories status
 * @param {Array} repositories
 * @param {boolean} force Force output of repo, even if it hasn't changed
 */
const outputRepositoriesStatus = function (repositories, force) {
  repositories
    .filter(repo => repo.error || repo.changes || force)
    .forEach(repo => output.printStatus(repo));
};

/**
 * Display status of given libraries or all libraries in directory
 * @param args
 */
module.exports = function (...args) {
  const input = new Input(args);
  const force = input.hasFlag('-f');

  input.init()
    .then(() => {
      const libraries = input.getLibraries();

      h5p.findDirectories()
        .then(repositories => getRepositoriesStatus(repositories, libraries))
        .then(repositories => outputRepositoriesStatus(repositories, force))
        .catch(err => output.printError);
    })
};;
