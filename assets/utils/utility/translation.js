const {getLibraryData, getLanguageData} = require('./repository');
const output = require('./output');
const h5p = require('../h5p');
const path = require('path');
const fs = require('fs');
const sanitizeHtml = require('sanitize-html');

function languageComparison(language, assertLanguage, errors) {
  var hasValidJson = true;
  errors = errors || [];

  if (Object.keys(language).length !== Object.keys(assertLanguage).length) {
    hasValidJson = false;
    errors.push('Not same number of fields');
  }
  else {
    for (var translation in assertLanguage) {
      if (assertLanguage.hasOwnProperty(translation) && typeof assertLanguage[translation] === 'string') {
        if (translation.indexOf('english') !== 0) {
          var isString = typeof language[translation] === 'string';
          const isSafe = isSafeTranslation(language[translation]);
          const isEmptyString = isString && language[translation].trim().length === 0;
          hasValidJson = hasValidJson && isString && isSafe && !isEmptyString;

          if (isString && language[translation].trim().length === 0) {
            errors.push("Empty field", translation);
          }

          if (!isString) {
            errors.push("Mismatch:", translation, JSON.stringify(assertLanguage, null, 2), JSON.stringify(language, null, 2));
          }

          if (!isSafe) {
            errors.push("Unsafe translation", language[translation]);
          }
        }
      }
      else {
        if (!language[translation]) {
          errors.push("Could not find field:", translation, JSON.stringify(language, null, 2), JSON.stringify(assertLanguage, null, 2));
        }
        else {
          // Check group:
          if(Object.keys(language[translation]).length !== Object.keys(assertLanguage[translation]).length) {
            hasValidJson = false;
            errors.push("Mismatch:", translation);
          }
          else {
            var validGroup = languageComparison(language[translation], assertLanguage[translation], errors);
            hasValidJson = hasValidJson && validGroup.hasValidJson;
          }
        }
      }
    }
  }

  return {
    hasValidJson,
    errors
  };
}

function validateLanguage(library, language) {
  // Get language data for comparison
  var testLang = getLanguageData(library, language);
  var defaultLangSemantics = h5p.createDefaultLanguage(library);

  // Make sure language exists and has semantics
  if (typeof testLang === 'object' && testLang.semantics) {

    // Perform the language comparison
    var validation = languageComparison(testLang.semantics, defaultLangSemantics);

    return {
      name: `${library} language ${language}`,
      failed: !validation.hasValidJson,
      errors: validation.errors
    }
  }
  else {
    // Invalid language - skip
    return {
      name: `${library} language ${language}`,
      skipped: true
    }
  }
}

function getLanguages(languages, lib) {
  // Get specified languages
  if (languages.length) {
    return Promise.resolve(
      languages.map(validateLanguage.bind(this, lib))
    );
  }
  else {
    return getAllLanguagesOfLib(lib);
  }
}


const getLanguageCode = (dir) => dir.split('.')[0];

function getAllLanguagesOfLib(lib) {
  return h5p.findDirectories(true, path.resolve(lib, 'language'))
    .then(dirs => dirs.map(getLanguageCode).map(validateLanguage.bind(this, lib)))
    .catch(() => {
      output.printResults({
        name: lib,
        skipped: true
      })
    });
}

function validateTranslation(libraries, languages) {
  var librariesMap = libraries.map(getLanguages.bind(this, languages));
  return Promise.all(librariesMap);
}

function compareEditorLanguageFile(defaults, translation) {

  if (defaults.libraryStrings === undefined || translation.libraryStrings === undefined) {
    return false;
  }

  defaults = defaults.libraryStrings;
  translation = translation.libraryStrings;

  if (Object.keys(defaults).length !== Object.keys(translation).length) {
    return false;
  }

  var valid = true;
  Object.keys(defaults).forEach(key => {
    if (translation[key] === undefined) {
      valid = false;
    }
    else if (!isSafeTranslation(translation[key])) {
      console.warn('Unsafe translation: ' + translation[key]);
      valid = false;
    }
  });

  return valid;
}

/** Check if translation is safe */
function isSafeTranslation(translation) {
  const sanitized = sanitizeHtml(translation, {
    allowedClasses: {
      table: ['h5p-table'],
    },
    allowedAttributes: {
      th: ['scope'],
      a: ['target', 'href']
    }
  });

  return translation === sanitized;
}

function getEditorLanguageDefaults(libraryDir) {
  return JSON.parse(fs.readFileSync(`${libraryDir}/language/en.json`));
}

module.exports = {
  validateLanguage,
  validateTranslation,
  compareEditorLanguageFile,
  getEditorLanguageDefaults,
  languageComparison,
  isSafeTranslation
};
