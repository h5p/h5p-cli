const output = require('../utility/output');
const Input = require('../utility/input');
const translation = require('../utility/translation');

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

const outputComparison = (diff, comparison) => {
  output.printResults(comparison);
  if (diff) {
    comparison.errors.forEach(err => {
      output.printError(err);
    })
  }
};

const getLanguageComparison = (diff, languageComparison) => {
  languageComparison.forEach(outputComparison.bind(this, diff));
};

function getLanguages(diff, libraries) {
  libraries.forEach(getLanguageComparison.bind(this, diff));
}

function validateTranslations(libraries, languages, diff) {
  translation.validateTranslation(libraries, languages)
    .then(getLanguages.bind(this, diff));
}
