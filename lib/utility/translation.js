const repository = require('./repository');
const output = require('./output');
const h5p = require('../h5p');
const path = require('path');

function validateJson(language, assertLanguage, errors) {
  var hasValidJson = true;
  errors = errors || [];
  for (var translation in assertLanguage) {
    if (assertLanguage.hasOwnProperty(translation) && typeof assertLanguage[translation] === 'string') {
      if (translation.indexOf('english') !== 0) {
        var isString = typeof language[translation] === 'string';
        hasValidJson = hasValidJson && isString;
        if (!isString) {
          errors.push("Mismatch:", translation, JSON.stringify(assertLanguage, null, 2), JSON.stringify(language, null, 2));
        }
      }
    }
    else {
      if (!language[translation]) {
        errors.push("Could not find field:", translation, JSON.stringify(language, null, 2), JSON.stringify(assertLanguage, null, 2));
      }
      else {
        var validGroup = validateJson(language[translation], assertLanguage[translation], errors);
        hasValidJson = hasValidJson && validGroup.hasValidJson;
      }
    }
  }

  return {
    hasValidJson,
    errors
  };
}

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
      var validation = validateJson(testLang.semantics, nbLang.semantics);

      return {
        name: `${library} language ${language}`,
        failed: !validation.hasValidJson,
        errors: validation.errors
      }
    }
  }
  else {
    return {
      name: `${library} language ${language}`,
      skipped: true
    }
  }
}

function validateTranslation(libraries, languages) {
  var librariesMap = libraries.map(lib => {
    // Fetch a language file
    if (languages.length) {
      return Promise.resolve(languages.map(lang => {
        return getLanguage(lang, lib);
      }));
    }
    else {
      //Check all languages files that are found

      return h5p.findDirectories(true, path.resolve(lib, 'language'))
        .then((dirs) => {
          var languages = dirs.map(x => {
            return x.split('.')[0];
          });
          return languages.map(lang => {
            return getLanguage(lang, lib);
          });
          // if (languageComparison) {
          //   output.printResults(languageComparison);
          //   languageComparison.errors.forEach(err => {
          //     output.printError(err);
          //   });
          // }
        })
        .catch(() => {
          output.printResults({
            name: lib,
            skipped: true
          })
        });
    }
  });

  return Promise.all(librariesMap);
}

module.exports = {
  getLanguage,
  validateTranslation
};
