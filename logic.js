const { execSync } = require("child_process");
const fs = require('fs');
const superAgent = require('superagent');
const admZip = require("adm-zip");
const config = require('./config.js');
// builds content from template and input
const fromTemplate = (template, input) => {
  for (let item in input) {
    template = template.replaceAll(`{${item}}`, input[item]);
  }
  return template;
}
module.exports = {
  // imports content type from zip archive file in the .h5p format
  import: (folder, archive) => {
    const target = `${config.folders.temp}/${folder}`;
    new admZip(archive).extractAllTo(target);
    fs.renameSync(`${target}/content`, `content/${folder}`);
    fs.renameSync(`${target}/h5p.json`, `content/${folder}/h5p.json`);
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(archive);
    return folder;
  },
  // creates zip archive export file in the .h5p format
  export: (library, folder) => {
    const libsFile = `${config.folders.cache}/${library}.json`;
    const editLibsFile = `${config.folders.cache}/${library}_edit.json`;
    const target = `${config.folders.temp}/${folder}`;
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target);
    fs.cpSync(`content/${folder}`, `${target}/content`, { recursive: true });
    fs.renameSync(`${target}/content/h5p.json`, `${target}/h5p.json`);
    fs.rmSync(`${target}/content/sessions`, { recursive: true, force: true });
    let libs = JSON.parse(fs.readFileSync(libsFile, 'utf-8'));
    const editLibs = JSON.parse(fs.readFileSync(editLibsFile, 'utf-8'));
    libs = {...libs, ...editLibs};
    for (let item in libs) {
      const label = `${libs[item].id}-${libs[item].version.major}.${libs[item].version.minor}`;
      fs.cpSync(`${config.folders.libraries}/${label}`, `${target}/${label}`, { recursive: true });
    }
    const files = getFileList(target);
    const zip = new admZip();
    for (let item of files) {
      const file = item;
      item = item.replace(target, '');
      let path = item.split('/');
      const name = path.pop();
      if (config.files.patterns.ignored.test(name) || !config.files.patterns.allowed.test(name)) {
        continue;
      }
      path = path.join('/');
      zip.addLocalFile(file, path);
    }
    const zipped = `${target}.h5p`;
    zip.writeZip(zipped);
    fs.rmSync(target, { recursive: true, force: true });
    return zipped;
  },
  /* retrieves list of h5p librarie
  ignoreCache - if true cache file is overwritten with online data */
  getRegistry: async (ignoreCache) => {
    const registryFile = `${config.folders.cache}/libraryRegistry.json`;
    let list;
    if (!ignoreCache && fs.existsSync(registryFile)) {
      list = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
    }
    else {
      list = await getFile(config.urls.registry, true);
      fs.writeFileSync(registryFile, JSON.stringify(list));
    }
    const output = {
      regular: {},
      reversed: {}
    }
    for (let item in list) {
      list[item].repoName = list[item].repo.url.split('/').slice(-1)[0];
      list[item].org = list[item].repo.url.split('/').slice(3, 4)[0];
      delete list[item].resume;
      delete list[item].fullscreen;
      delete list[item].xapiVerbs;
      output.reversed[list[item].id] = list[item];
      output.regular[list[item].repoName] = list[item];
    }
    return output;
  },
  /* computes list of library dependencies in their correct load order
  mode - 'view' or 'edit' to compute non-editor or editor dependencies
  saveToCache - if true list is saved to cache folder */
  computeDependencies: async (library, mode, saveToCache) => {
    console.log(`> ${library} deps ${mode}`);
    let level = -1;
    let registry = {};
    const toDo = {};
    const cache = {};
    const done = {};
    const weights = {};
    toDo[library] = '';
    const getOptionals = async (org, dep) => {
      if (cache[dep].optionals) {
        return cache[dep].optionals;
      }
      const translations = await getFile(fromTemplate(config.urls.library.language, { org, dep }), true);
      if (typeof translations == 'object') {
        cache[dep].translations = translations;
      }
      cache[dep].semantics = await getFile(fromTemplate(config.urls.library.semantics, { org, dep }), true);
      cache[dep].optionals = parseSemanticLibraries(cache[dep].semantics);
      return cache[dep].optionals;
    }
    const handleDepListEntry = (machineName, parent) => {
      const entry = registry.reversed[machineName]?.repoName;
      if (!entry) {
        process.stdout.write(`${machineName} not found in registry; `);
        return false;
      }
      if (!done[level][entry] && !toDo[entry]) {
        toDo[entry] = parent;
      }
      weights[entry] = weights[entry] ? weights[entry] + 1 : 1;
      return true;
    }
    const compute = async (dep, org) => {
      const requiredByPath = (registry.regular[toDo[dep]]?.requiredBy[registry.regular[toDo[dep]]?.requiredBy.length - 1] || '') + (toDo[dep] ? `/${toDo[dep]}` : '');
      if (pathHasDuplicates(requiredByPath)) {
        delete toDo[dep];
        return;
      }
      if (registry.regular[dep].requiredBy && registry.regular[dep].requiredBy.includes(requiredByPath)) {
        delete toDo[dep];
        return;
      }
      process.stdout.write(`>> ${dep} required by ${toDo[dep]} ... `);
      done[level][dep] = registry.regular[dep];
      let list;
      if (cache[dep]) {
        list = cache[dep];
        process.stdout.write(' (cached) ');
      }
      else {
        list = await getFile(fromTemplate(config.urls.library.list, { org, dep }), true);
        cache[dep] = list;
      }
      done[level][dep].title = list.title;
      done[level][dep].version = {
        major: list.majorVersion,
        minor: list.minorVersion
      }
      done[level][dep].runnable = list.runnable;
      done[level][dep].preloadedJs = list.preloadedJs || [];
      done[level][dep].preloadedCss = list.preloadedCss || [];
      done[level][dep].preloadedDependencies = list.preloadedDependencies || [];
      done[level][dep].editorDependencies = list.editorDependencies || [];
      if (!done[level][dep].requiredBy) {
        done[level][dep].requiredBy = [];
      }
      done[level][dep].requiredBy.push(requiredByPath);
      done[level][dep].level = level;
      const optionals = await getOptionals(org, dep);
      if ((mode != 'edit' || level > 0) && list.preloadedDependencies) {
        for (let item of list.preloadedDependencies) {
          if (!handleDepListEntry(item.machineName, dep)) continue;
        }
        for (let item in optionals) {
          handleDepListEntry(item, dep);
        }
      }
      if (mode == 'edit' && list.editorDependencies) {
        for (let item of list.editorDependencies) {
          if (!handleDepListEntry(item.machineName, dep)) continue;
        }
      }
      done[level][dep].semantics = list.semantics;
      done[level][dep].translations = list.translations;
      delete toDo[dep];
      console.log('done');
    }
    registry = await module.exports.getRegistry();
    if (!registry.regular[library]) {
      throw 'library_not_found';
      return;
    }
    while (Object.keys(toDo).length) {
      level++;
      console.log(`>> on level ${level}`);
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
    return output;
  },
  // download & unzip repository
  download: async (org, repo, target) => {
    const blob = (await superAgent.get(fromTemplate(config.urls.library.zip, { org, repo })))._body;
    const zipFile = `${config.folders.temp}/temp.zip`;
    fs.writeFileSync(zipFile, blob);
    new admZip(zipFile).extractAllTo(config.folders.libraries);
    fs.rmSync(zipFile);
    fs.renameSync(`${config.folders.libraries}/${repo}-master`, target);
  },
  /* downloads dependencies to libraries folder and runs relevant npm commands
  mode - 'view' or 'edit' to download non-editor or editor libraries
  saveToCache - if true cached dependency list is used */
  downloadWithDependencies: async (library, mode, useCache) => {
    let list;
    const doneFile = `${config.folders.cache}/${library}${mode == 'edit' ? '_edit' : ''}.json`;
    if (useCache && fs.existsSync(doneFile)) {
      console.log(`>> using cache from ${doneFile}`);
      list = JSON.parse(fs.readFileSync(doneFile, 'utf-8'));
    }
    else {
      list = await module.exports.computeDependencies(library, mode);
    }
    for (let item in list) {
      const folder = `${config.folders.libraries}/${list[item].id}-${list[item].version.major}.${list[item].version.minor}`;
      if (fs.existsSync(folder)) {
        console.log(`>> ~ skipping ${list[item].repoName}; it already exists.`);
        continue;
      }
      console.log(`>> + installing ${list[item].repoName}`);
      await module.exports.download(list[item].org, list[item].repoName, folder);
      const packageFile = `${folder}/package.json`;
      if (!fs.existsSync(packageFile)) {
        continue;
      }
      const info = JSON.parse(fs.readFileSync(packageFile));
      if (!info?.scripts?.build) {
        continue;
      }
      console.log('>>> npm install');
      console.log(await execSync('npm install', {cwd: folder}).toString());
      console.log('>>> npm run build');
      console.log(await execSync('npm run build', {cwd: folder}).toString());
      fs.rmSync(`${folder}/node_modules`, { recursive: true, force: true });
    }
  },
  /* checks if dependency lists are cached and dependencies are installed for a given library;
  returns a report with boolean statuses; the overall status is reflected under the "ok" attribute;*/
  verifySetup: async (library) => {
    const registry = await module.exports.getRegistry();
    const viewList = `${config.folders.cache}/${library}.json`;
    const editList = `${config.folders.cache}/${library}_edit.json`;
    const output = {
      registry: registry.regular[library] ? true : false,
      lists: {
        view: fs.existsSync(viewList),
        edit: fs.existsSync(editList)
      },
      libraries: {},
      ok: true
    }
    if (!output.registry || !output.lists.view || !output.lists.edit) {
      output.ok = false;
      return output;
    }
    let list = JSON.parse(fs.readFileSync(viewList, 'utf-8'));
    list = {...list, ...JSON.parse(fs.readFileSync(editList, 'utf-8'))};
    for (let item in list) {
      const label = `${list[item].id}-${list[item].version.major}.${list[item].version.minor}`;
      output.libraries[label] = fs.existsSync(`${config.folders.libraries}/${label}`);
      if (!output.libraries[label]) {
        output.ok = false;
      }
    }
    return output;
  },
  fromTemplate
}
// generates list of files and their relative paths in a folder tree
const getFileList = (folder) => {
  const output = [];
  let toDo = [folder];
  let list = [];
  const compute = () => {
    for (let item of list) {
      const dirs = fs.readdirSync(item);
      for (let entry of dirs) {
        const file = `${item}/${entry}`;
        if (fs.lstatSync(file).isDirectory()) {
          toDo.push(file);
        }
        else {
          output.push(file);
        }
      }
    }
  }
  while (toDo.length) {
    list = toDo;
    toDo = [];
    compute();
  }
  return output;
}
// determines if provided path has duplicate entries; entries are separated by '/';
const pathHasDuplicates = (path) => {
  const ledger = {};
  const list = path.split('/');
  for (let item of list) {
    if (ledger[item]) {
      return true;
    }
    else {
      ledger[item] = true;
    }
  }
  return false;
}
// parses semantics array of objects for entries of library type
const parseSemanticLibraries = (entries) => {
  if (!Array.isArray(entries)) {
    return {};
  }
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
// download file from url and optionally parses it as JSON
const getFile = async (url, parseJson) => {
  let output = (await superAgent.get(url).ok(res => [200, 404].includes(res.status))).text;
  if (output == '404: Not Found') {
    return '';
  }
  if (parseJson) {
    output = JSON.parse(output);
  }
  return output;
}
