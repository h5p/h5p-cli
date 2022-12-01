const superAgent = require('superagent');
const gitClone = require('git-clone/promise');
const config = require('./config.js');
module.exports = {
  listLibraries: () => {
    return superAgent.get('https://h5p.org/registry.json')
      .then((result) => {
        const list = JSON.parse(result.text).libraries;
        const output = {
          regular: {},
          reversed: {}
        }
        for (let item in list) {
          list[item].repoName = item;
          output.reversed[list[item].machineName] = list[item];
          output.regular[item] = list[item];
        }
        return Promise.resolve(output);
      });
  },
  computeDependencies: (library) => {
    return new Promise(async (resolve, reject) => {
      if (!library) return reject('invalid_library');
      let registry = {};
      const done = {};
      const toDo = {};
      toDo[library] = 1;
      const fetch = async (dependency) => {
        delete toDo[dependency];
        if (done[dependency]) return;
        else {
          done[dependency] = registry.regular[dependency];
          const list = JSON.parse((await superAgent.get(`https://raw.githubusercontent.com/h5p/${dependency}/master/library.json`)).text);
          if (list.preloadedDependencies)
            for (let item of list.preloadedDependencies) {
              const entry = registry.reversed[item.machineName]?.repoName;
              if (!entry) {
                console.log(`> ${item.machineName} not found in registry`);
                continue;
              }
              if (!done[entry]) toDo[entry] = 1;
            }
          if (list.editorDependencies)
            for (let item of list.editorDependencies) {
              const entry = registry.reversed[item.machineName]?.repoName;
              if (!entry) {
                console.log(`> ${item.machineName} not found in registry`);
                continue;
              }
              if (!done[entry]) toDo[entry] = 1;
            }
        }
      }
      try {
        registry = await module.exports.listLibraries();
        while (Object.keys(toDo).length) {
          for (let item in toDo) await fetch(item);
        }
        resolve(done);
      }
      catch (error) {
        reject(error);
      }
    });
  },
  downloadWithDependencies: (library) => {
    return new Promise(async (resolve, reject) => {
      try {
        const list = await module.exports.computeDependencies(library);
        for (let item in list) {
          console.log(`> installing ${list[item].repoName}`);
          await gitClone(`https://github.com/h5p/${list[item].repoName}`, `${config.folders.lib}/${list[item].machineName}-${list[item].version.major}.${list[item].version.minor}`);
        }
        resolve();
      }
      catch (error) {
        reject(error);
      }
    });
    //return gitClone(`https://github.com/h5p/${library}`, config.folders.lib);
  }
}
