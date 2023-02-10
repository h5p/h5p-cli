const h5p = require('../h5p');
const repository = require('../utility/repository');
const output = require('../utility/output');
const Input = require('../utility/input');
const c = output.color;

/**
 * @typedef {Object} DirectoryData
 * @property {string} dirName Directory name
 * @property {Object} libData Library data for directory
 * @property {Array<LibraryVersion>|undefined} libData.preloadedDependencies
 *    View dependencies of library
 * @property {Array<LibraryVersion>|undefined} libData.editorDependencies
 *    Editor dependencies of library
 */

/**
 * @typedef {Object} LibraryVersion
 *    Library name and version of it
 * @property {string} machineName Unique name of library
 * @property {number} majorVersion Major version of library
 * @property {number} minorVersion Minor version of library
 */

/**
 * Print amount of dependencies to libraries that will be packed
 * @param {number} totalDependencies Amount of dependencies
 */
function printDependencies(totalDependencies) {
  if (totalDependencies > 0) {
    output.printLn(`Adding ${c.emphasize + totalDependencies + c.default} ` +
      (totalDependencies === 1 ? 'dependency' : 'dependencies') +
      ` to ${c.emphasize}file${c.default}...`);
  }
}

/**
 * Print amount of libraries that will be packed
 * @param {Array} libs Libraries array
 */
function printLibsPacked(libs) {
  output.printLn(`Packing ${c.emphasize + libs.length + c.default} ` +
    (libs.length === 1 ? 'library' : 'libraries') +
    ` to ${c.emphasize}file${c.default}...`);
}

/**
 * Recursively get repositories with dependencies
 *
 * @param {Array} libraries Directory name of libraries that will be packed
 * @return {Promise} Resolves with all dependencies of libraries
 */
function recursivelyGetDependencies(libraries) {
  return h5p.findDirectories()
    .then(getLibraryData)
    .then(dirData => getLibraryDependencies(dirData, libraries));
}

/**
 * Get dependencies in directory
 *
 * @param {Array<DirectoryData>} directoryData
 * @param libraries
 * @return {Array}
 */
function getLibraryDependencies(directoryData, libraries) {
  let repoCollection = [];
  libraries
    .forEach(lib => {
      const dirData = directoryData.find(dir => dir.dirName === lib);
      if (dirData && repoCollection.indexOf(dirData.dirName) < 0) {
        recursivelyAddToCollection(repoCollection, dirData, directoryData);
      }
      else if (!dirData || repoCollection.indexOf(dirData.dirName) < 0) {
        // Add error messages for invalid entries
        repoCollection.push(lib);
      }
    });
  return repoCollection;
}

/**
 * Dependencies of library
 *
 * @param {DirectoryData} library
 * @return {Array<LibraryVersion>}
 */
function getLibraryDependency(library) {
  const preloadedDeps = library.libData.preloadedDependencies || [];
  const editorDeps = library.libData.editorDependencies || [];
  return preloadedDeps.concat(editorDeps);
}

/**
 * Get library data from directories
 *
 * @param {Array<string>} dirs Directories that will be scanned for library data
 * @return {Array<DirectoryData>} Array of directory data for all directories
 *    processed
 */
function getLibraryData(dirs) {
  return dirs
    .map(lib => {
      return {
        dirName: lib,
        libData: repository.getLibraryData(lib)
      }
    });
}

/**
 * Recursively add libraries to a collection
 * @param {Array} repoCollection Final collection of libraries with dependencies
 * @param {DirectoryData} dirData Directories that should be added to collection
 * @param {Array<DirectoryData>} directories Current directory data
 */
function recursivelyAddToCollection(repoCollection, dirData, directories) {
  repoCollection.push(dirData.dirName);

  getLibraryDependency(dirData)
    .forEach(dep => {
      const dir = findLibraryInDirectory(dep, directories);
      if (dir && repoCollection.indexOf(dir.dirName) < 0) {
        recursivelyAddToCollection(repoCollection, dir, directories)
      }
    });
}

/**
 * Find library matching data in directories
 *
 * @param {LibraryVersion} libVersion Library version
 * @param {Array<DirectoryData>} directories
 *    Directories data
 * @returns {DirectoryData|undefined} Directory data
 */
function findLibraryInDirectory(libVersion, directories) {
  return directories.find(dir =>
      dir.libData.machineName === libVersion.machineName &&
      dir.libData.majorVersion === libVersion.majorVersion &&
      dir.libData.minorVersion === libVersion.minorVersion
  );
}

/**
 * Pack given libraries
 * @param {...string} inputList Inputs for pack
 * @return {Promise} Resolves when done packing
 */
function pack(...inputList) {
  const input = new Input(inputList);
  const file = input.getFileName();
  return input.init(true)
    .then(() => {
      const libraries = input.getLibraries();

      if (!libraries.length) {
        output.printLn('You must specify libraries');
        return;
      }

      printLibsPacked(libraries);

      if (input.hasFlag('-r')) {
        return recursivelyGetDependencies(libraries)
          .then(libsToPack => {
            printDependencies(libsToPack.length - libraries.length);
            return h5p.pack(libsToPack, file)
          });
      }
      else {
        return h5p.pack(libraries, file);
      }
    });
}

module.exports = pack;
