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
  const input = new Input(inputList);
  const diff = input.hasFlag('-diff');
  input.init()
    .then(() => {
      const libraries = input.getLibraries();
      const languages = input.getLanguages();
      validateTranslations(libraries, languages, diff);
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
  if (diff) {
    comparison.errors.forEach(err => {
      output.printError(err);
    })
  }
};

/**
 * Compare all languages
 *
 * @param {boolean} diff Outputs diff if true
 * @param {Object} languageComparison Output of language comparison
 */
const getLanguageComparison = (diff, languageComparison) => {
  languageComparison.forEach(outputComparison.bind(this, diff));
};

/**
 * Get all language comparisons from libraries
 *
 * @param diff
 * @param {Array} libraries
 */
function getLanguages(diff, libraries) {
  libraries.forEach(getLanguageComparison.bind(this, diff));
}

/**
 *
 *
 * @param libraries
 * @param languages
 * @param diff
 */
function validateTranslations(libraries, languages, diff) {
  translation.validateTranslation(libraries, languages)
    .then(getLanguages.bind(this, diff));
}
