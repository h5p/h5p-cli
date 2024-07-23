const output = require('../utility/output');
const Input = require('../utility/input');
const translation = require('../utility/translation');

/**
 * Exports function for checking translations of libraries against standard language.
 * May supply flag for showing diff.
 *
 * @param {Array} inputList
 */
module.exports = function (...inputList) {
  return new Promise ((resolve, reject) => {
    const input = new Input(inputList);
    const diff = input.hasFlag('-diff');
    input.init()
      .then(() => {
        let ok = true;
        const libraries = input.getLibraries();
        const languages = input.getLanguages();
        translation.validateTranslation(libraries, languages)
          .then((result) => {
            for (let lib of result) {
              for (let comp of lib) {
                outputComparison(diff, comp);
                if (comp.failed) {
                  ok = false;
                }
              }
            }
            if (ok) {
              resolve();
            }
            else {
              reject();
            }
          });
      });
  });
};

/**
 * Output result of comparison
 *
 * @param {boolean} diff If true it will output diffs
 * @param {Object} comparison Comparison of languages
 */
const outputComparison = (diff, comparison) => {
  output.printResults(comparison);
  if (diff && Array.isArray(comparison.errors)) {
    comparison.errors.forEach(err => {
      output.printError(err);
    })
  }
};
