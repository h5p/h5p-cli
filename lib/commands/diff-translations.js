const h5p = require('../h5p');
const output = require('../utility/output');
const Input = require('../utility/input');
const repository = require('../utility/repository');
const path = require('path');

module.exports = function (...inputList) {
  const input = new Input(inputList);
  input.init()
    .then(() => {
      const libraries = input.getLibraries();
      const languages = input.getLanguages();

      libraries.forEach(lib => {
        // Fetch a language file
        if (languages.length) {
          languages.forEach(lang => {
            getLanguage(lang, lib);
          });
        }
        else {
          //Check all languages files that are found

          h5p.findDirectories(true, path.resolve(lib, 'language'))
            .then((dirs) => {
              var languages = dirs.map(x => {
                return x.split('.')[0];
              });
              languages.forEach(lang => {
                getLanguage(lang, lib);
              });
            })
            .catch(() => {
              output.printResults({
                name: lib,
                skipped: true
              })
            });
        }
      });
    });
};

function getLanguage(language, library) {
  // Skip assert language
  if (language === 'nb') {
    return;
  }

  var testLang = repository.getLanguageData(library, language);
  var nbLang = repository.getLanguageData(library, 'nb');

  if (typeof testLang === 'object') {
    // Only test if language exists
    if (testLang.semantics) {
      var hasValidJson = validateJson(testLang.semantics, nbLang.semantics);

      output.printResults({
        name: `${library} language ${language}`,
        failed: !hasValidJson
      });
    }
  }
  else {
    output.printResults({
      name: `${library} language ${language}`,
      skipped: true
    })
  }
}

function validateJson(language, assertLanguage) {
  var hasValidJson = true;
  for (var translation in assertLanguage) {
    if (typeof assertLanguage[translation] === 'string') {
      if (translation.indexOf('english') !== 0) {
        hasValidJson = hasValidJson && typeof language[translation] === 'string';
      }
    }
    else {
      try {
        var validGroup = validateJson(language[translation], assertLanguage[translation])
        hasValidJson = hasValidJson && validGroup;
      }
      catch (e) {
      }
    }
  }

  return hasValidJson;
}
