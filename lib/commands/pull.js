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
  var repo = h5p.pull(function (error, result) {

    if (error) {
      spinner.failed(error);
    }
    else {
      spinner.succeeded(result);
    }
    pull();
  });

  if (!repo) {
    // Nothing to clone.
    return;
  }

  const msg = output.emphasizeExpressions`Pulling ${repo}...`;
  const spinner = new output.Spinner(msg);
}
