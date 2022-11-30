const logic = require('./logic.js');
const handleError = (error) => {
  console.log('> error');
  console.log(error);
}
const cli = {
  list: () => {
    console.log('> fetching h5p library list');
    logic.listLibraries()
      .then((result) => {
        for (let item in result) console.log(result[item]);
      })
      .catch(handleError);
  },
  deps: (library) => {
    console.log('> fetching h5p library dependency list');
    logic.computeDependencies(library)
      .then((result) => {
        console.log(result);
      })
      .catch(handleError);
  },
  install: (library) => {
    console.log('> cloning h5p library and dependencies');
    logic.downloadWithDependencies(library)
      .then((result) => {
        console.log(result);
      })
      .catch(handleError);
  }
}
if (typeof cli[process.argv[2]] =='function') cli[process.argv[2]].apply(null, process.argv.slice(3));
else console.log(`> "${process.argv[2]}" is not a valid command`);
