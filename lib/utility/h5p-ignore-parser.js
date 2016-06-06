const parser = require('gitignore-parser');
const fs = require('fs');

const getAcceptedFilter = function (path) {
  const fileReader = fs.readFileSync(path + '/.h5pignore', 'utf8');
  const h5pIgnore = parser.compile(fileReader);
  return h5pIgnore.accepts;
};

module.exports = getAcceptedFilter;
