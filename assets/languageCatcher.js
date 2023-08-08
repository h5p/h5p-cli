const config = require(`${require.main.path}/config.js`);
// scaffolding for h5peditor.js
global.window = {
  parent: {
    H5PEditor: {}
  }
};
global.H5P = {
  jQuery: {
    extend: () => {
      return {};
    }
  }
};
global.ns = {};
global.navigator = {
  userAgent: {
    match: () => {}
  }
}
require(`${process.cwd()}/${config.folders.libraries}/h5p-editor-php-library/scripts/h5peditor.js`);
module.exports = ns.supportedLanguages;
// remove scaffolding
delete global.window;
delete global.H5P;
delete global.ns;
delete global.navigator;
