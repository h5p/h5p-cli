const h5p = require('../h5p');
const output = require('../utility/output');
const Input = require('../utility/input');

module.exports = function (...inputList) {
  const input = new Input(inputList);
  return input.init()
    .then(() => {
      const libraries = input.getLibraries();
      h5p.update(libraries, function (error) {
        if (error) {
          return process.stdout.write(error);
        }
        pull(libraries);
      });
    });
};

/**
 * Recursive pulling for all repos in collection.
 */
function pull(libraries) {
  const repos = libraries.length === 1 ? 'repository' : 'repositories';
  const repoAmount = libraries.length ? libraries.length : 'all';
  const pullAnimation = new output.Spinner(`Pulling ${repoAmount} ${repos}`);
  h5p.pull().then(res => {
    pullAnimation.succeeded('Finished pulling repositories');
    output.printPulled(res);
  });
}
