const fs = require('fs');
const path = require('path');
const readline = require('readline');

const libraryJson = {
  "title": "ChangeMe",
  "description": "description",
  "majorVersion": 1,
  "minorVersion": 0,
  "patchVersion": 0,
  "runnable": 1,
  "author": "",
  "license": "MIT",
  "machineName": "H5P.ChangeMe",
  "preloadedJs": [
    {"path": "index.js"}
  ]
};

const semantics = [
  {
    "name": "title",
    "label": "title",
    "type": "text"
  }
];

const h5pignore = `node_modules
.idea
.h5pignore
package.json
README.md`;

const createLibraryJson = function(answers) {
  let extendedLibrary =
    Object.assign({}, libraryJson, {
      title: answers.title,
      description: answers.description,
      author: answers.author,
      license: answers.license,
      machineName: "H5P." + answers.name,
      preloadedJs: [
        { path: answers.entryPoint }
      ]
    });

  fs.writeFileSync(
    path.resolve(answers.name, 'library.json'),
    JSON.stringify(extendedLibrary, null, 2)
  );
};

const createSemanticsJson = function(dir) {
  fs.writeFileSync(
    path.resolve(dir, 'semantics.json'),
    JSON.stringify(semantics, null, 2)
  );
};

const createH5PIgnore = function(dir) {
  fs.writeFileSync(
    path.resolve(dir, '.h5pignore'),
    h5pignore
  );
};

const createDir = function(dir) {
  let dirExists = false;
  try {
    dirExists = fs.statSync(dir).isDirectory();
  }
  catch (e) {
    dirExists = false;
  }
  if (!dirExists) {
    fs.mkdirSync(dir);
  }
};

const askQuestion = function(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer);
    });
  });
};

/**
 * Initialize H5P library in given directory
 */
function init() {

  const answers = {};

  askQuestion(commandPrompts.introduction)
    .then(response => {
      process.stdout.write(`
      ${response}`);
      answers.name = response;
      return askQuestion(commandPrompts.title)
    })
    .then(response => {
      answers.title = response || libraryJson.title;
      process.stdout.write('\u000A');
      return askQuestion(commandPrompts.description)
    })
    .then(response => {
      answers.description = response || libraryJson.description;
      process.stdout.write('\u000A');
      return askQuestion(commandPrompts.entryPoint)
    })
    .then(response => {
      response = response || libraryJson.preloadedJs[0].path;
      if (!response.substr(response.length - 3, response.length)) {
        response = `${response}.js`;
      }
      answers.entryPoint = response;
      process.stdout.write('\u000A');
      return askQuestion(commandPrompts.author)
    })
    .then(author => {
      answers.author = author;
      process.stdout.write('\u000A');
      return askQuestion(commandPrompts.license)
    })
    .then(license => {
      if (license === '') {
        license = 'MIT';
      }

      answers.license = license;
      process.stdout.write('\u000A');
      return askQuestion(commandPrompts.confirm)
    })
    .then(response => {
      const isValidInit =
        response === '' ||
        response === 'yes' ||
        response === 'y';
      const isValidName = answers.name.length;

      if (isValidInit && isValidName) {
        createDir(answers.name);
        createLibraryJson(answers);
        createSemanticsJson(answers.name);
        createH5PIgnore(answers.name);
      }

      process.exit(0);
    });
}

const commandPrompts = {
  introduction: `This utility will walk you through creating an H5P library skeleton.
  It only covers the most common items, and tries to guess sensible defaults.
  
  name: `,
  title: `
  version: (1.0.0)
  title: `,
  description: `
  description: `,
  entryPoint: `
  entry point: (index.js) `,
  author: `
  author: `,
  license: `
  license: (MIT) `,
  confirm: `
  About to write to ${path}.
  
  Is this ok? (yes)`
};

module.exports = init;
