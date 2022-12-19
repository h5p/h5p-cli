const { execSync } = require("child_process");
const fs = require('fs');
const superAgent = require('superagent');
const admZip = require("adm-zip");
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
  computeDependencies: (library, mode, saveToCache) => {
    return new Promise(async (resolve, reject) => {
      console.log(`> ${library} deps `);
      if (!library) return reject('invalid_library');
      let level = -1;
      let registry = {};
      const toDo = {};
      const cache = {};
      const done = {};
      const weights = {};
      toDo[library] = `${library}/run`;
      const getOptionals = async (org, dep) => {
        if (cache[dep].optionals) {
          return cache[dep].optionals;
        }
        const raw = (await superAgent.get(`https://raw.githubusercontent.com/${org}/${dep}/master/semantics.json`).ok(res => [200, 404].includes(res.status))).text;
        cache[dep].optionals = {};
        if (raw != '404: Not Found') {
          const semantics = JSON.parse(raw);
          cache[dep].optionals = parseSemantics(semantics);
        }
        return cache[dep].optionals;
      }
      const handleDepListEntry = (dep, machineName, type) => {
        const entry = registry.reversed[machineName]?.repoName;
        if (!entry) {
          process.stdout.write(`${machineName} not found in registry; `);
          return false;
        }
        if (!toDo[entry]) {
          toDo[entry] = `${dep}/${type}`;
        }
        weights[entry] = weights[entry] ? weights[entry] + 1 : 1;
        return true;
      }
      const compute = async (dep, org) => {
        process.stdout.write(`>> ${dep} required by ${toDo[dep]} ... `);
        done[level][dep] = registry.regular[dep];
        let list;
        if (cache[dep]) {
          list = cache[dep];
          process.stdout.write(' (cached) ');
        }
        else {
          list = JSON.parse((await superAgent.get(`https://raw.githubusercontent.com/${org}/${dep}/master/library.json`)).text);
          cache[dep] = list;
        }
        done[level][dep].version = {
          major: list.majorVersion,
          minor: list.minorVersion
        }
        done[level][dep].preloadedJs = list.preloadedJs || [];
        done[level][dep].preloadedCss = list.preloadedCss || [];
        done[level][dep].requiredBy = toDo[dep];
        done[level][dep].level = level;
        if ((mode != 'edit' || level > 0) && list.preloadedDependencies) {
          for (let item of list.preloadedDependencies) {
            if (!handleDepListEntry(dep, item.machineName, 'run')) continue;
          }
          const optionals = await getOptionals(org, dep);
          for (let item in optionals) {
            const repoName = registry.reversed[item]?.repoName;
            if (!toDo[repoName]) {
              toDo[repoName] = `${dep}/semantics`;
              weights[repoName] = weights[repoName] ? weights[repoName] + 1 : 1;
            }
          }
        }
        if (mode == 'edit' && list.editorDependencies) {
          for (let item of list.editorDependencies) {
            if (!handleDepListEntry(dep, item.machineName, 'edit')) continue;
          }
        }
        delete toDo[dep];
        console.log('done');
      }
      try {
        registry = await module.exports.listLibraries();
        while (Object.keys(toDo).length) {
          level++;
          console.log(`>> on level ${level}`);
          done[level] = {};
          for (let item in toDo) {
            await compute(item, registry.regular[item].org);
          }
        }
        let output = {};
console.log(weights);
        for (let i = level; i >= 0; i--) {
console.log(`... level ${i} sorting`);
          const keys = Object.keys(done[i]);
          keys.sort((a, b) => {
            return weights[b] - weights[a];
          });
console.log(keys);
          for (let key of keys) {
            output[key] = done[i][key];
          }
        }
        if (saveToCache) {
          const doneFile = `${config.folders.cache}/${library}${mode == 'edit' ? '_edit' : ''}.json`;
          if (!fs.existsSync(config.folders.cache)) fs.mkdirSync(config.folders.cache);
          fs.writeFileSync(doneFile, JSON.stringify(output));
          console.log(`deps saved to ${doneFile}`);
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
        const doneFile = `${config.folders.cache}/${library}.json`;
        if (useCache && fs.existsSync(doneFile)) {
          console.log(`>> using done from ${doneFile}`);
          list = JSON.parse(fs.readFileSync(doneFile, 'utf-8'));
        }
        else {
          list = await module.exports.computeDependencies(library);
        }
        for (let item in list) {
          const folder = `${config.folders.lib}/${list[item].id}-${list[item].version.major}.${list[item].version.minor}`;
          if (fs.existsSync(folder)) {
            console.log(`>> skipping ${list[item].repoName}; it already exists.`);
            continue;
          }
          console.log(`>> installing ${list[item].repoName}`);
          const blob = (await superAgent.get(`https://github.com/${list[item].org}/${list[item].repoName}/archive/refs/heads/master.zip`))._body;
          const zipFile = `${config.folders.cache}/temp.zip`;
          fs.writeFileSync(zipFile, blob);
          new admZip(zipFile).extractAllTo(config.folders.lib);
          fs.renameSync(`${config.folders.lib}/${list[item].repoName}-master`, folder);
          const packageFile = `${folder}/package.json`;
          if (!fs.existsSync(packageFile)) continue;
          const info = JSON.parse(fs.readFileSync(packageFile));
          if (!info?.scripts?.build) continue;
          console.log('>>> npm install');
          console.log(await execSync('npm install', {cwd: folder}).toString());
          console.log('>>> npm run build');
          console.log(await execSync('npm run build', {cwd: folder}).toString());
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
