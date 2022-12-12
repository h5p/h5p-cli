const fs = require('fs');
const superAgent = require('superagent');
const gitClone = require('git-clone/promise');
const config = require('./config.js');
const parseSemantics = (entries) => {
  let toDo = [];
  let list = [];
  const output = {};
  const parseList = () => {
    toDo = [];
    for (let obj of list)
      for (let attr in obj) {
        if (attr == 'fields' && Array.isArray(obj[attr]))
          for (let item of obj[attr])
            if (item?.type == 'library' && Array.isArray(item?.options))
              for (let lib of item.options) output[lib.split(' ')[0]] = true;
        if (typeof obj[attr] == 'object' && !Array.isArray(obj[attr]))
          toDo.push(obj[attr]);
      }
    list = toDo;
  }
  list = entries;
  while (list.length) parseList();
  return output;
}
module.exports = {
  listLibraries: () => {
    return superAgent.get(config.registryUrl)
      .then((result) => {
        const list = JSON.parse(result.text);
        const output = {
          regular: {},
          reversed: {}
        }
        for (let item in list) {
          list[item].repoName = list[item].repo.url.split('/').slice(-1)[0];
          list[item].org = list[item].repo.url.split('/').slice(3, 4)[0];
          delete list[item].resume;
          delete list[item].fullscreen;
          delete list[item].runnable;
          delete list[item].xapiVerbs;
          output.reversed[list[item].id] = list[item];
          output.regular[list[item].repoName] = list[item];
        }
        return Promise.resolve(output);
      });
  },
  computeDependencies: (library, noEditor, saveToCache) => {
    return new Promise(async (resolve, reject) => {
      if (!library) return reject('invalid_library');
      let registry = {};
      const done = {};
      const toDo = {};
      toDo[library] = true;
      const fetch = async (dependency, org) => {
        delete toDo[dependency];
        if (done[dependency]) return;
        else {
          done[dependency] = registry.regular[dependency];
          process.stdout.write('.');
          const list = JSON.parse((await superAgent.get(`https://raw.githubusercontent.com/${org}/${dependency}/master/library.json`)).text);
          done[dependency].preloadedJs = list.preloadedJs || [];
          done[dependency].preloadedCss = list.preloadedCss || [];
          if (list.preloadedDependencies)
            for (let item of list.preloadedDependencies) {
              const entry = registry.reversed[item.machineName]?.repoName;
              if (!entry) {
                console.log(`> ${item.machineName} not found in registry`);
                continue;
              }
              if (!done[entry]) toDo[entry] = true;
            }
          if (!noEditor && list.editorDependencies)
            for (let item of list.editorDependencies) {
              const entry = registry.reversed[item.machineName]?.repoName;
              if (!entry) {
                console.log(`> ${item.machineName} not found in registry`);
                continue;
              }
              if (!done[entry]) toDo[entry] = true;
            }
          const raw = (await superAgent.get(`https://raw.githubusercontent.com/${org}/${dependency}/master/semantics.json`).ok(res => [200, 404].includes(res.status))).text;
          if (raw != '404: Not Found') {
            const semantics = JSON.parse(raw);
            const optionals = parseSemantics(semantics);
            for (let item in optionals) toDo[registry.reversed[item]?.repoName] = true;
          }
        }
      }
      try {
        registry = await module.exports.listLibraries();
        while (Object.keys(toDo).length) {
          for (let item in toDo) await fetch(item, registry.regular[item].org);
        }
        const main = done[library];
        delete done[library];
        done[library] = main;
        process.stdout.write('\n');
        if (saveToCache) {
          const cacheFile = `${config.folders.cache}/${library}.json`;
          if (!fs.existsSync(config.folders.cache)) fs.mkdirSync(config.folders.cache);
          fs.writeFileSync(cacheFile, JSON.stringify(done));
          console.log(`deps saved to ${cacheFile}`);
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
          const folder = `${config.folders.lib}/${list[item].id}`;
          if (fs.existsSync(folder)) console.log(`> skipping ${list[item].repoName}; it already exists.`);
          else {
            console.log(`> installing ${list[item].repoName}`);
            await gitClone(`https://github.com/h5p/${list[item].repoName}`, folder);
          }
        }
        resolve();
      }
      catch (error) {
        reject(error);
      }
    });
  }
}
