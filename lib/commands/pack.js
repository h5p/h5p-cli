const h5p = require('../h5p');
const output = require('../utility/output');
const Input = require('../utility/input');
const c = output.color;

function printDependencies(totalDependencies) {
  if (totalDependencies > 0) {
    output.printLn(`Adding ${c.emphasize + totalDependencies + c.default} ` +
      (totalDependencies === 1 ? 'dependency' : 'dependencies') +
      ` to ${c.emphasize}file${c.default}...`);
  }
}

function printLibsPacked(libs) {
  output.printLn(`Packing ${c.emphasize + libs.length + c.default} ` +
    (libs.length === 1 ? 'library' : 'libraries') +
    ` to ${c.emphasize}file${c.default}...`);
}

module.exports = function (...inputList) {
  const input = new Input(inputList);
  const file = input.getFileName();
  const libraries = input.getLibraries();

  if (!libraries.length) {
    output.printLn('You must specify libraries');
    return;
  }

  printLibsPacked(libraries);

  if (input.hasFlag('-r')) {
    h5p.getRecursivePackRepos(libraries)
      .then((totalRepositories) => {
        const totalDependencies = totalRepositories.length - libraries.length;
        printDependencies(totalDependencies);
        h5p.pack(totalRepositories, file);
      });
  }
  else {
    h5p.pack(libraries, file);
  }
};
