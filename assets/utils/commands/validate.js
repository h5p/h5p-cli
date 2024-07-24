const fs = require('fs');
const process = require('process');
const {getLibraryData, isEditorLibrary} = require('../utility/repository');
const {compareEditorLanguageFile, getEditorLanguageDefaults, languageComparison} = require('../utility/translation');
const output = require('../utility/output');
const Input = require('../utility/input');
const parallel = require('../utility/parallel');
const h5p = require('../h5p');
const path = require('path');

const ERROR = 'error';
const WARNING = 'warning';
const OK = 'ok';

//const translation = require('../utility/translation');

/**
 * Exports function for checking translations of libraries against standard language.
 * May supply flag for showing diff.
 *
 * @param {Array} inputList
 * @returns {Promise} Validation results.
 */
module.exports = function (...inputList) {
  return new Promise((resolve, reject) => {
    const input = new Input(inputList);
    var results = [];
    input.init().then(() => {
      const libraries = input.getLibraries();

      parallel(libraries, (index, library, done) => {
        validateLibrary(library, done);
      }, (error, results) => {
        // Finished with all libraries
        outputReport(results);
        resolve(results);
      });
    });
  });
};

const outputReport = (results) => {

  results = results.filter(library => library.status !== OK);

  results.forEach((library, index) => {
    Object.keys(library.language).forEach((key) => {
      if (library.language[key].status === OK) {
        delete library.language[key];
      }
    });
  });

  if (results.length > 0) {
    console.log(JSON.stringify(results, null, 2));
  }
}

const validateLibrary = (library, done) => {
  var libraryDir = process.cwd() + '/' + library;

  // Read library.json
  var libraryJson = getLibraryData(libraryDir);

  var results = {
    'library': library
  };

  validateLanguageFiles(libraryDir, libraryJson, function (langResults) {
    results.status = getHighestSeverity(langResults);
    results.language = langResults;
    done(results);
  });
};

const getHighestSeverity = (list) => {
  var highest = OK;
  var elements = Object.values(list);

  for (var i = 0; i < elements.length; i++) {
    if (elements[i].status === ERROR) {
      return ERROR;
    }

    if (elements[i].status === WARNING) {
      highest = WARNING;
    }
  }

  return highest;
};


const validateLanguageFiles = (libraryDir, libraryJson, done) => {
  // Read all JSON files from language dir
  var results = {};
  var fileNames = [];
  var languageDir = libraryDir + '/language/';

  // Does language directory exist?
  if (!fs.existsSync(languageDir)) {
    return done(results);
  }
  
  const isEditorLib = isEditorLibrary(libraryJson);

  var languageFiles = fs.readdirSync(languageDir);

  for (var i = 0; i < languageFiles.length; i++) {
    var file = languageFiles[i];

    const languageCode = path.basename(file, '.json').trim();

    // RULE: lowercase language file names
    if (languageCode !== languageCode.toLowerCase()) {
      results[file] = {
        status: ERROR,
        message: 'Language file name must be lowercase: ' + file
      };
      continue;
    }
    // RULE: Legal language file name
    if (languageCode.length < 2 || languageCode.length > 7) {
      results[file] = {
        status: ERROR,
        message: 'Invalid language file name (must be between 2 and 7 characters): ' + file
      };
      continue;
    }
    // RULE: No en.json present
    if (!isEditorLib && file === 'en.json') {
      results[file] = {
        status: ERROR,
        message: 'en.json is not allowed'
      };
      continue;
    }
    else {
      fileNames[file] = languageDir + file;
    }
  }

  if (Object.keys(fileNames).length === 0) {
    return done(results);
  }

  if (isEditorLib) {
    var editorDefaults = getEditorLanguageDefaults(libraryDir);

    h5p.readJSONFiles(fileNames, function (files) {
      Object.keys(files).forEach(function (fileName) {
        if(!compareEditorLanguageFile(editorDefaults, files[fileName].content)) {
          results[fileName] = {
            status: ERROR,
            message: 'Language file does not match editor defaults'
          };
        }
        else {
          results[fileName] = {
            status: OK
          };
        }
      });
      done(results);
    });
  }
  else {
    // Add Semantics.json
    //fileNames['semantics.json'] = libraryDir + '/semantics.json';
    //
    h5p.readJSONFiles(fileNames, function (files) {
      // Need semantics.json
      //if(files['semantics.json']);

      var defaultLangSemantics = h5p.createDefaultLanguage(libraryDir);

      Object.keys(files).forEach(filename => {
        testLang = files[filename].content;
        // Make sure language exists and has semantics
        if (typeof testLang === 'object' && testLang.semantics) {
          // Perform the language comparison
          var validation = languageComparison(testLang.semantics, defaultLangSemantics);

          results[filename] = {
            status: validation.hasValidJson ? OK : ERROR,
            message: validation.hasValidJson ? undefined : validation.errors /*'Language file differs from default.json'*/
          };
        }
        else {
          results[filename] = {
            status: ERROR,
            message: 'Empty/invalid language file'
          };
        }
      });
      done(results);
    });
  }
};

/**
 * Output result of comparison
 *
 * @param {boolean} diff If true it will output diffs
 * @param {Object} comparison Comparison of languages
 */
/*const outputComparison = (diff, comparison) => {
  output.printResults(comparison);
  if (diff) {
    comparison.errors.forEach(err => {
      output.printError(err);
    })
  }
};*/
