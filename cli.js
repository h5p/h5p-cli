const util = require('util');
const logic = require('./logic.js');
const config = require('./config.js');
const handleError = (error) => {
  console.log('> error');
  console.log(error);
}
const cli = {
  list: (reversed) => {
    console.log('> fetching h5p library list');
    logic.listLibraries()
      .then((result) => {
        for (let item in result.regular) console.log(reversed ? result.regular[item].id : item);
      })
      .catch(handleError);
  },
  deps: (library) => {
    console.log('> fetching h5p library dependency list');
    logic.computeDependencies(library)
      .then((result) => {
        console.log(util.inspect(result, false, null, true));
      })
      .catch(handleError);
  },
  install: (library) => {
    console.log(`> cloning h5p library and dependencies into "${config.folders.lib}" folder`);
    logic.downloadWithDependencies(library)
      .then((result) => {
        console.log('> all done');
      })
      .catch(handleError);
  }
}
if (typeof cli[process.argv[2]] =='function') cli[process.argv[2]].apply(null, process.argv.slice(3));
else console.log(`> "${process.argv[2]}" is not a valid command`);
