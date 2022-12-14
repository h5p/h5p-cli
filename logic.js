const { execSync } = require("child_process");
const fs = require('fs');
const superAgent = require('superagent');
const simpleGit = require('simple-git');
const config = require('./config.js');
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
      console.log(`> ${library} deps `);
      if (!library) return reject('invalid_library');
      let level = -1;
      let registry = {};
      let done = {};
      const toDo = {};
      const weights = {};
      toDo[library] = `${library}/run`;
      const handleDepListEntry = (dep, machineName, type) => {
        const entry = registry.reversed[machineName]?.repoName;
        if (!entry) {
          process.stdout.write(`> ${machineName} not found in registry`);
          return false;
        }
        if (!done[level][entry] && !toDo[entry]) {
          toDo[entry] = `${dep}/${type}`;
        }
        weights[entry] = weights[entry] ? weights[entry] + 1 : 1;
        return true;
      }
      const compute = async (dep, org) => {
        process.stdout.write(`>> ${dep} required by ${toDo[dep]} ... `);
        done[level][dep] = registry.regular[dep];
        const list = JSON.parse((await superAgent.get(`https://raw.githubusercontent.com/${org}/${dep}/master/library.json`)).text);
        done[level][dep].version = {
          major: list.majorVersion,
          minor: list.minorVersion
        }
        done[level][dep].preloadedJs = list.preloadedJs || [];
        done[level][dep].preloadedCss = list.preloadedCss || [];
        done[level][dep].requiredBy = toDo[dep];
        done[level][dep].level = level;
        if (list.preloadedDependencies) {
          for (let item of list.preloadedDependencies) {
            if (!handleDepListEntry(dep, item.machineName, 'run')) continue;
          }
        }
        if (!noEditor && list.editorDependencies) {
          for (let item of list.editorDependencies) {
            if (!handleDepListEntry(dep, item.machineName, 'edit')) continue;
          }
        }
        const raw = (await superAgent.get(`https://raw.githubusercontent.com/${org}/${dep}/master/semantics.json`).ok(res => [200, 404].includes(res.status))).text;
        if (raw != '404: Not Found') {
          const semantics = JSON.parse(raw);
          const optionals = parseSemantics(semantics);
          for (let item in optionals) {
            const repoName = registry.reversed[item]?.repoName;
            toDo[repoName] = `${dep}/semantics`;
            weights[repoName] = weights[repoName] ? weights[repoName] + 1 : 1;
          }
        }
        delete toDo[dep];
        console.log('done');
      }
      try {
        registry = await module.exports.listLibraries();
        while (Object.keys(toDo).length) {
          level++;
          done[level] = {};
          for (let item in toDo) {
            await compute(item, registry.regular[item].org);
          }
        }
        let output = {};
        for (let i = level; i >= 0; i--) {
          const keys = Object.keys(done[i]);
          keys.sort((a, b) => {
            return weights[b] - weights[a];
          });
          for (let key of keys) output[key] = done[i][key];
        }
        if (saveToCache) {
          const cacheFile = `${config.folders.cache}/${library}.json`;
          if (!fs.existsSync(config.folders.cache)) fs.mkdirSync(config.folders.cache);
          fs.writeFileSync(cacheFile, JSON.stringify(output));
          console.log(`deps saved to ${cacheFile}`);
        }
        process.stdout.write('\n');
        resolve(output);
      }
      catch (error) {
        reject(error);
      }
    });
  },
  downloadWithDependencies: (library, useCache) => {
    return new Promise(async (resolve, reject) => {
      try {
        let list;
        const cacheFile = `${config.folders.cache}/${library}.json`;
        if (useCache && fs.existsSync(cacheFile)) {
          console.log(`>> using cache from ${cacheFile}`);
          list = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        }
        else {
          list = await module.exports.computeDependencies(library);
        }
        for (let item in list) {
          const folder = `${config.folders.lib}/${list[item].id}-${list[item].version.major}.${list[item].version.minor}`;
          if (fs.existsSync(folder)) {
            console.log(`> skipping ${list[item].repoName}; it already exists.`);
          }
          else {
            console.log(`> installing ${list[item].repoName}`);
            await simpleGit().clone(`https://github.com/h5p/${list[item].repoName}`, folder);
            if (fs.existsSync(`${folder}/package.json`)) {
              console.log('>>> npm install');
              console.log(await execSync('npm install', {cwd: folder}).toString());
              console.log('>>> npm run build');
              console.log(await execSync('npm run build', {cwd: folder}).toString());
            }
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
/*
 * finds optional dependencies in semantics.json
 * entries - semantics.json array
 */
const parseSemantics = (entries) => {
  let toDo = [];
  let list = [];
  const output = {};
  const parseList = () => {
    toDo = [];
    for (let obj of list) { // go through semantics array entries
      for (let attr in obj) { // go through entry attributes
        if (attr == 'fields' && Array.isArray(obj[attr])) {
          for (let item of obj[attr]) {
            if (item?.type == 'library' && Array.isArray(item?.options)) {
              for (let lib of item.options) {
                output[lib.split(' ')[0]] = true;
              }
            }
            else {
              toDo.push(item);
            }
          }
        }
        if (typeof obj[attr] == 'object' && !Array.isArray(obj[attr])) {
          toDo.push(obj[attr]);
        }
      }
    }
    list = toDo;
  }
  list = entries;
  while (list.length) {
    parseList();
  }
  return output;
}
