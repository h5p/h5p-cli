const fs = require('fs');
const logic = require('./logic.js');
const config = require('./config.js');
const cli = {
  list: async (reversed, ignoreCache) => {
    try {
      console.log('> fetching h5p library registry');
      const result = await logic.getRegistry(parseInt(ignoreCache));
      for (let item in result.regular) {
        console.log(reversed ? result.regular[item].id : item);
      }
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  deps: async (library, mode, saveToCache) => {
    try {
      const result = await logic.computeDependencies(library, mode, parseInt(saveToCache));
      for (let item in result) {
        console.log(item);
      }
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  install: async (library, mode, useCache) => {
    try {
      console.log(`> cloning ${library} library and dependencies into "${config.folders.libraries}" folder`);
      await logic.downloadWithDependencies(library, mode, parseInt(useCache));
      console.log('> all done');
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  core: async () => {
    try {
      for (let item of config.core.libraries) {
        const folder = `${config.folders.libraries}/${item}`;
        if (fs.existsSync(folder)) {
          console.log(`>> ~ skipping ${item}; it already exists.`);
          continue;
        }
        console.log(`>> + installing ${item}`);
        await logic.download('h5p', item, folder);
      }
      console.log('> all done');
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  setup: async (library) => {
    try {
      let result = await logic.computeDependencies(library, 'view', 1);
      for (let item in result) {
        console.log(item);
      }
      result = await logic.computeDependencies(library, 'edit', 1);
      for (let item in result) {
        console.log(item);
      }
      console.log(`> cloning ${library} library "view" dependencies into "${config.folders.libraries}" folder`);
      await logic.downloadWithDependencies(library, 'view', 1);
      console.log(`> cloning ${library} library "edit" dependencies into "${config.folders.libraries}" folder`);
      await logic.downloadWithDependencies(library, 'edit', 1);
      console.log('> all done');
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  }
}
if (typeof cli[process.argv[2]] == 'function') {
  cli[process.argv[2]].apply(null, process.argv.slice(3));
}
else {
  console.log(`> "${process.argv[2]}" is not a valid command`);
}
