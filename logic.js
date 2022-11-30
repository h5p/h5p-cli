const superAgent = require('superagent');
const gitClone = require('git-clone/promise');
const config = require('./config.js');
module.exports = {
  listLibraries: () => { // returns object with "machineName: repoName" structure
    return superAgent.get('https://h5p.org/registry.json')
      .then((result) => {
        const list = JSON.parse(result.text).libraries;
        const output = {};
        for (let item in list) output[list[item].machineName] = item;
        return Promise.resolve(output);
      });
  },
  computeDependencies: (library) => { // to continue
    return new Promise(async (resolve, reject) => {
      let registry = {};
      const done = {};
      const toDo = { library: 1 };
      const fetch = async (library) => {
        if (done[library]) return;
        else {
          done[library] = 1;
          const list = await superAgent.get(`https://raw.githubusercontent.com/h5p/${library}/master/library.json`);
          for (let item of list.preloadedDependencies) {
            const dep = registry[item.machineName];
            if (!done[dep]) toDo[registry[item.machineName]] = 1;
          }
          for (let item of list.editorDependencies) {
            const dep = registry[item.machineName];
            if (!done[dep]) toDo[registry[item.machineName]] = 1;
          }
          delete toDo[library];
        }
      }
      try {
        const registry = await module.exports.listLibraries();
        while (Object.keys(toDo).length) {
          for (let item in toDo) fetch(item);
        }
      }
      catch (error) {
        reject(error);
      }
    });
  },
  downloadWithDependencies: (library) => { // to-do
    return gitClone(`https://github.com/h5p/${library}`, config.folders.lib);
  }
}
