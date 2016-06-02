const h5p = require('../h5p');
const output = require('../utility/output');
const Input = require('../utility/input');

module.exports = function (...inputList) {
  const c = output.color;
  const input = new Input(inputList);
  const file = input.getFileOutputName();
  const libraries = input.getLibraries();

  if (!libraries.length) {
    output.printLn('You must specify libraries');
  }

  output.printLn(`Packing ${c.emphasize + libraries.length + c.default} ` +
    (libraries.length === 1 ? 'library' : 'libraries') +
    ` to ${c.emphasize}file${c.default}...`);

  if (input.hasFlag('-r')) {
    // TODO: Flatten promises
    h5p.getDependencies(libraries).then((totalRepos) => {

      // Print found dependencies
      const dependencies = totalRepos.length - libraries.length;
      output.printLn(`Adding ${c.emphasize + dependencies + c.default} ` +
        (dependencies === 1 ? 'dependency' : 'dependencies') +
        ` to ${c.emphasize}file${c.default}...`);

      // Pack libraries and dependencies, then print results
      h5p.packPromise(totalRepos, file);
    });
  }
  else {
    // TODO: Refactor to always use packPromise
    h5p.pack(libraries, file, output.printResults);
  }
};
