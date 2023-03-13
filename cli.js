const fs = require('fs');
const logic = require('./logic.js');
const config = require('./config.js');
const utils = require('./assets/utils/cli.js');
const cli = {
  // exports content type as .h5p zipped file
  export: (library, folder) => {
    try {
      const file = logic.export(library, folder);
      console.log(file);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // lists h5p libraries
  list: async (reversed, ignoreCache) => {
    try {
      console.log('> fetching h5p library registry');
      const result = await logic.getRegistry(parseInt(ignoreCache));
      for (let item in result.regular) {
        console.log(`${parseInt(reversed) ? result.regular[item].id : item} (${result.regular[item].org})`);
      }
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // list tags for library
  tags: async (org, library) => {
    try {
      console.log('> fetching h5p library tags');
      const result = await logic.tags(org, library);
      console.log(result);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // computes dependencies for h5p library
  deps: async (library, mode, saveToCache, version, folder) => {
    try {
      const result = await logic.computeDependencies(library, mode, parseInt(saveToCache), version, folder);
      for (let item in result) {
        console.log(item);
      }
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // installs dependencies for h5p library
  install: async (library, mode, useCache) => {
    try {
      console.log(`> downloading ${library} library and dependencies into "${config.folders.libraries}" folder`);
      await logic.getWithDependencies('download', library, mode, parseInt(useCache));
      console.log(`> done installing ${library}`);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // clones dependencies for h5p library based on cache entries
  clone: async (library, mode, useCache) => {
    try {
      console.log(`> cloning ${library} library and dependencies into "${config.folders.libraries}" folder`);
      await logic.getWithDependencies('clone', library, mode, parseInt(useCache));
      console.log(`> done installing ${library}`);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // installs core h5p libraries
  core: async () => {
    try {
      for (let item of config.core.clone) {
        const folder = `${config.folders.libraries}/${item}`;
        if (fs.existsSync(folder)) {
          console.log(`>> ~ skipping ${item}; it already exists.`);
          continue;
        }
        console.log(`>> + installing ${item}`);
        await logic.clone('h5p', item, 'master', item);
      }
      for (let item of config.core.setup) {
        await cli.setup(item);
      }
      console.log('> done setting up core libraries');
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // computes & installs dependencies for h5p library
  setup: async (library, version, download) => {
    try {
      const action = parseInt(download) ? 'download' : 'clone';
      const latest = version ? false : true;
      let result = await logic.computeDependencies(library, 'view', 1, version);
      for (let item in result) {
        console.log(item);
      }
      result = await logic.computeDependencies(library, 'edit', 1, version);
      for (let item in result) {
        console.log(item);
      }
      console.log(`> ${action} ${library} library "view" dependencies into "${config.folders.libraries}" folder`);
      await logic.getWithDependencies(action, library, 'view', 1, latest);
      console.log(`> ${action} ${library} library "edit" dependencies into "${config.folders.libraries}" folder`);
      await logic.getWithDependencies(action, library, 'edit', 1, latest);
      console.log(`> done setting up ${library}`);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // updates local library registry entry
  register: async (file) => {
    try {
      let registry = await logic.getRegistry();
      const entry = JSON.parse(fs.readFileSync(file, 'utf-8'));
      registry.reversed = {...registry.reversed, ...entry};
      fs.writeFileSync(`${config.folders.cache}/${config.registry}`, JSON.stringify(registry.reversed));
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // generates cache file for library based on local files; does not use git repos
  use: async (library, folder) => {
    try {
      let result = await logic.computeDependencies(library, 'view', 1, null, folder);
      for (let item in result) {
        console.log(item);
      }
      result = await logic.computeDependencies(library, 'edit', 1, null, folder);
      for (let item in result) {
        console.log(item);
      }
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // generates report that verifies if an h5p library and its dependencies have been correctly computed & installed
  verify: async (library) => {
    try {
      let result = await logic.verifySetup(library);
      console.log(result);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // run the dev server
  server: () => {
    require('./server.js');
  },
  // various utility commands
  utils: function() {
    if (typeof utils[arguments[0]] != 'function') {
      console.log(`> "${process.argv[3]}" is not a valid utils command`);
      return;
    }
    utils[arguments[0]].apply(null, Array.prototype.slice.call(arguments).slice(1));
  }
}
if (typeof cli[process.argv[2]] == 'function') {
  cli[process.argv[2]].apply(null, process.argv.slice(3));
}
else {
  console.log(`> "${process.argv[2]}" is not a valid command`);
}
