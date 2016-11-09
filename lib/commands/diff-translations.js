const output = require('../utility/output');
const Input = require('../utility/input');
const translation = require('../utility/translation');

module.exports = function (...inputList) {
  const input = new Input(inputList);
  input.init()
    .then(() => {
      const libraries = input.getLibraries();
      const languages = input.getLanguages();

      translation.validateTranslation(libraries, languages)
        .then((librariesComparisons) => {
          if (librariesComparisons) {
            librariesComparisons.forEach(langComparison => {
              if (langComparison) {
                langComparison.forEach(lc => {
                  if (lc) {
                    output.printResults(lc);
                    lc.errors.forEach(err => {
                      output.printError(err);
                    })
                  }
                })
              }
            })
          }
        });
    });
};
