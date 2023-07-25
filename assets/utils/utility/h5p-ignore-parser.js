const parser = require('gitignore-parser');
const fs = require('fs');

/**
 * Gets an accepted files filter for given directory
 * @param {string} path Path to h5pIgnore file
 * @return {Function} Function that returns true for accepted directories
 */
const getAcceptedFilter = function (path) {
  const fileReader = fs.readFileSync(path + '/.h5pignore', 'utf8');
  const h5pIgnore = parser.compile(fileReader);
  return h5pIgnore.accepts;
};

module.exports = getAcceptedFilter;
