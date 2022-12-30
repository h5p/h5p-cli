const util = require('util');
const logic = require('./logic.js');
const config = require('./config.js');
const handleError = (error) => {
  console.log('> error');
  console.log(error);
}
const cli = {
  list: (reversed, ignoreCache) => {
    console.log('> fetching h5p library registry');
    logic.getRegistry(parseInt(ignoreCache))
      .then((result) => {
        for (let item in result.regular) {
          console.log(reversed ? result.regular[item].id : item);
        }
      })
      .catch(handleError);
  },
  deps: (library, mode, saveToCache) => {
    logic.computeDependencies(library, mode, parseInt(saveToCache))
      .then((result) => {
        for (let item in result) {
          console.log(item);
        }
      })
      .catch(handleError);
  },
  install: (library, mode, useCache) => {
    console.log(`> cloning h5p library and dependencies into "${config.folders.lib}" folder`);
    logic.downloadWithDependencies(library, mode, parseInt(useCache))
      .then((result) => {
        console.log('> all done');
      })
      .catch(handleError);
  }
}
if (typeof cli[process.argv[2]] =='function') cli[process.argv[2]].apply(null, process.argv.slice(3));
else console.log(`> "${process.argv[2]}" is not a valid command`);
