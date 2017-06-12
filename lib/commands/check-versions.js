const Input = require('../utility/input');
const Output = require('../utility/output');
const Repository = require('../utility/repository');
const AdmZip = require('adm-zip');
const h5p = require('../h5p');

function checkVersions(file) {
  const zip = new AdmZip(file);
  const zipEntries = zip.getEntries();

  h5p.findDirectories()
    .then((dirs) => {
      const dirLibData = dirs.map(x => getLibData(x));
      zipEntries
        .filter(entry => entry.entryName.substr(-12) === 'library.json')
        .forEach(entry => {
          const library = JSON.parse(zip.readAsText(entry));
          const dir = dirLibData.find(x => x.machineName === library.machineName);
          if (dir) {
            if (isSameVersion(library, dir)) {
              Output.printResults({
                name: library.machineName
              })
            }
            else {
              const libVer = `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`;
              const dirVer = `${dir.majorVersion}.${dir.minorVersion}.${dir.patchVersion}`;
              Output.printResults({
                name: library.machineName,
                failed: true,
                msg: `Mismatch: ${libVer} - ${dirVer}`
              })
            }
          }
          else {
            // Did not find library in dir
            Output.printResults({
              name: library.machineName,
              failed: true,
              msg: 'Not in directory'
            })
          }
        })
    });
}

function isSameVersion(lib, otherLib) {
  return lib.majorVersion === otherLib.majorVersion &&
    lib.minorVersion === otherLib.minorVersion &&
    lib.patchVersion === otherLib.patchVersion;
}

function getLibData(dir) {
  return Repository.getLibraryData(dir);
}

module.exports = function (...inputList) {
  const input = new Input(inputList);
  const inputFile = input.getFileName();
  checkVersions(inputFile);
};
