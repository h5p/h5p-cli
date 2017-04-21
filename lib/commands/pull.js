const h5p = require('../h5p');
const output = require('../utility/output');
const Input = require('../utility/input');

module.exports = function (...inputList) {
  const input = new Input(inputList);
  input.init()
    .then(() => {
      var libraries = input.getLibraries();
      h5p.update(libraries, function (error) {
        if (error) {
          return process.stdout.write(error);
        }
        pull();
      });
    });
};

/**
 * Recursive pulling for all repos in collection.
 */
function pull() {
  output.printLn('Pulling all libraries at the same time, stand by!');
  h5p.pull(function (repo, error) {
    output.printPulled({
      name: repo,
      error: error
    });
  });
}
