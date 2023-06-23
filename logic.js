const { execSync } = require("child_process");
const fs = require('fs');
const URL = require('url').URL;
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
    const registryFile = `${config.folders.cache}/${config.registry}`;
    let list;
    if (!ignoreCache && fs.existsSync(registryFile)) {
      list = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
    }
    else {
      list = await getFile(config.urls.registry, true);
    }
    const output = {
      regular: {},
      reversed: {}
    }
    for (let item in list) {
      if (list[item].repo) {
        list[item].repoName = list[item].repo.url.split('/').slice(-1)[0];
        list[item].org = list[item].repo.url.split('/').slice(3, 4)[0];
      }
      delete list[item].resume;
      delete list[item].fullscreen;
      delete list[item].xapiVerbs;
      output.reversed[list[item].id] = list[item];
      output.regular[list[item].repoName] = list[item];
    }
    if (ignoreCache || !fs.existsSync(registryFile)) {
      fs.writeFileSync(registryFile, JSON.stringify(list));
    }
    return output;
  },
  /* computes list of library dependencies in their correct load order
  mode - 'view' or 'edit' to compute non-editor or editor dependencies
  saveToCache - if true list is saved to cache folder
  version - optional version to compute; defaults to 'master'
  folder - optional local library folder to use instead of git repo; use "" to ignore */
  computeDependencies: async (library, mode, saveToCache, version, folder) => {
    console.log(`> ${library} deps ${mode}`);
    version = version || 'master';
    let level = -1;
    let registry = {};
    const toDo = {};
    const cache = {};
    const done = {};
    const weights = {};
    toDo[library] = {
      parent: '',
      version,
      folder
    };
    const getOptionals = async (org, dep, version, dir) => {
      if (cache[dep].optionals) {
        return cache[dep].optionals;
      }
      const source = dir ? `${config.folders.libraries}/${dir}/semantics.json` : fromTemplate(config.urls.library.semantics, { org, dep, version });
      cache[dep].semantics = await getFile(source, true);
      cache[dep].optionals = parseSemanticLibraries(cache[dep].semantics);
      return cache[dep].optionals;
    }
    const latestPatch = async (org, repo, version) => {
      const tags = await module.exports.tags(org, repo);
      let patch = -1;
      for (let item of tags) {
        if (item.indexOf(version) != 0) {
          continue;
        }
        const numbers = item.split('.');
        if (numbers.length < 3) {
          continue;
        }
        if (numbers[2] > patch) {
          patch = numbers[2];
        }
      }
      return patch > -1 ? `${version}.${patch}` : version;
    }
    const handleDepListEntry = async (machineName, parent, ver, dir) => {
      const lib = registry.reversed[machineName];
      const entry = lib?.repoName;
      if (!entry) {
        saveToCache = 0;
        done[level][machineName] = false;
        const parentVersion = `${done[level][parent].version.major}.${done[level][parent].version.minor}.${done[level][parent].version.patch}`
        process.stdout.write(`\n!!! ${machineName} ${ver} not found in registry; required by ${done[level][parent].requiredBy}/${parent} (${parentVersion}) `);
        return false;
      }
      const version = ver == 'master' ? ver : await latestPatch(lib.org, entry, ver);
      if (!done[level][entry] && !toDo[entry]?.parent) {
        toDo[entry] = { parent, version, folder: dir };
      }
      weights[entry] = weights[entry] ? weights[entry] + 1 : 1;
      return true;
    }
    const compute = async (org, dep, version) => {
      const parent = toDo[dep].parent ? `/${toDo[dep].parent}` : '';
      const lastParent = registry.regular[toDo[dep].parent]?.requiredBy[registry.regular[toDo[dep].parent]?.requiredBy.length - 1] || '';
      const requiredByPath = lastParent + parent;
      if (pathHasDuplicates(requiredByPath)) {
        delete toDo[dep];
        return;
      }
      if (registry.regular[dep].requiredBy && registry.regular[dep].requiredBy.includes(requiredByPath)) {
        delete toDo[dep];
        return;
      }
      process.stdout.write(`>> ${dep} required by ${toDo[dep].parent} ... `);
      done[level][dep] = registry.regular[dep];
      let list;
      if (cache[dep]) {
        list = cache[dep];
        process.stdout.write(' (cached) ');
      }
      else {
        const source = toDo[dep].folder ? `${config.folders.libraries}/${toDo[dep].folder}/library.json` : fromTemplate(config.urls.library.list, { org, dep, version });
        list = await getFile(source, true);
        cache[dep] = list;
      }
      if (!list.title) {
        throw `unregistered ${toDo[dep].folder || dep} library`;
      }
      done[level][dep].title = list.title;
      done[level][dep].version = {
        major: list.majorVersion,
        minor: list.minorVersion,
        patch: list.patchVersion
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
      let ver = version == 'master' ? version : `${done[level][dep].version.major}.${done[level][dep].version.minor}.${done[level][dep].version.patch}`;
      const optionals = await getOptionals(org, dep, ver, toDo[dep].folder);
      if (mode != 'edit' || level > 0) {
        if (list.preloadedDependencies) {
          for (let item of list.preloadedDependencies) {
            ver = version == 'master' ? version : `${item.majorVersion}.${item.minorVersion}`;
            const dir = folder ? `${item.machineName}-${item.majorVersion}.${item.minorVersion}` : null;
            await handleDepListEntry(item.machineName, dep, ver, dir);
          }
        }
        for (let item in optionals) {
          ver = version == 'master' ? version : optionals[item].version;
          const dir = folder ? `${item}-${optionals[item].version}` : null;
          await handleDepListEntry(item, dep, ver, dir);
        }
      }
      if (mode == 'edit' && list.editorDependencies) {
        for (let item of list.editorDependencies) {
          ver = version == 'master' ? version : `${item.majorVersion}.${item.minorVersion}`;
          const dir = folder ? `${item.machineName}-${item.majorVersion}.${item.minorVersion}` : null;
          await handleDepListEntry(item.machineName, dep, ver, dir);
        }
      }
      delete toDo[dep];
      console.log('done');
    }
    registry = await module.exports.getRegistry();
    if (!folder && !registry.regular[library]) {
      throw 'library_not_found';
    }
    while (Object.keys(toDo).length) {
      level++;
      console.log(`>> on level ${level}`);
      done[level] = {};
      for (let item in toDo) {
        await compute(registry.regular[item].org, item, toDo[item].version);
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
  // list tags for library using git
  tags: async (org, repo, mainBranch = 'master') => {
    const library = await getFile(fromTemplate(config.urls.library.list, { org, dep: repo, version: mainBranch }), true);
    const label = `${library.machineName}-${library.majorVersion}.${library.minorVersion}`;
    const folder = `${config.folders.libraries}/${label}`;
    if (!fs.existsSync(folder)) {
      await module.exports.clone(org, repo, mainBranch, label);
    }
    execSync('git pull origin', {cwd: folder});
    const tags = execSync('git tag', {cwd: folder}).toString().split('\n');
    const output = [];
    for (let item of tags) {
      if (!item) {
        continue;
      }
      output.push(item);
    }
    output.sort((a, b) => {
      a = a.split('.');
      b = b.split('.');
      return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
    });
    return output;
  },
  // download & unzip repository
  download: async (org, repo, version, target) => {
    const blob = (await superAgent.get(fromTemplate(config.urls.library.zip, { org, repo, version })))._body;
    const zipFile = `${config.folders.temp}/temp.zip`;
    fs.writeFileSync(zipFile, blob);
    new admZip(zipFile).extractAllTo(config.folders.libraries);
    fs.rmSync(zipFile);
    fs.renameSync(`${config.folders.libraries}/${repo}-master`, target);
  },
  // clone repository using git
  clone: async (org, repo, branch, target) => {
    return execSync(`git clone ${fromTemplate(config.urls.library.clone, {org, repo})} ${target} --branch ${branch}`, {cwd: config.folders.libraries}).toString();
  },
  /* clones/downloads dependencies to libraries folder using git and runs relevant npm commands
  mode - 'view' or 'edit' to fetch non-editor or editor libraries
  useCache - if true cached dependency list is used
  latest - if true master branch libraries are used; otherwise the versions found in the cached deps list are used
  toSkip - optional array of libraries to skip; after a library is parsed by the function it's auto-added to the array so it's skipped for efficiency */
  getWithDependencies: async (action, library, mode, useCache, latest, toSkip = []) => {
    let list;
    const doneFile = `${config.folders.cache}/${library}${mode == 'edit' ? '_edit' : ''}.json`;
    if (useCache && fs.existsSync(doneFile)) {
      console.log(`>> using cache from ${doneFile}`);
      list = JSON.parse(fs.readFileSync(doneFile, 'utf-8'));
    }
    else {
      list = await module.exports.computeDependencies(library, mode, 1);
    }
    for (let item in list) {
      if (toSkip.indexOf(item) != -1) {
        console.log(`> skipping ${item}; already installed.`);
        continue;
      }
      toSkip.push(item);
      if (!list[item]) {
        throw `unregistered ${item} library`;
      }
      const label = `${list[item].id}-${list[item].version.major}.${list[item].version.minor}`;
      const listVersion = `${list[item].version.major}.${list[item].version.minor}.${list[item].version.patch}`;
      const version = latest ? 'master' : listVersion;
      const folder = `${config.folders.libraries}/${label}`;
      if (fs.existsSync(folder)) {
        if (latest) {
          console.log(`>> ~ updating to ${list[item].repoName} ${listVersion}`);
          console.log(execSync('git pull origin', {cwd: folder}).toString());
        }
        else {
          console.log(`>> ~ skipping ${list[item].repoName} ${listVersion}; it already exists.`);
        }
        continue;
      }
      console.log(`>> + installing ${list[item].repoName} ${listVersion}`);
      if (action == 'download') {
        await module.exports.download(list[item].org, list[item].repoName, version, folder);
      }
      else {
        console.log(await module.exports.clone(list[item].org, list[item].repoName, version, label));
      }
      const packageFile = `${folder}/package.json`;
      if (!fs.existsSync(packageFile)) {
        continue;
      }
      const info = JSON.parse(fs.readFileSync(packageFile));
      if (!info?.scripts?.build) {
        continue;
      }
      console.log('>>> npm install');
      console.log(execSync('npm install', {cwd: folder}).toString());
      console.log('>>> npm run build');
      console.log(execSync('npm run build', {cwd: folder}).toString());
      fs.rmSync(`${folder}/node_modules`, { recursive: true, force: true });
      toSkip.push(item);
    }
    return toSkip;
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
      if (!list[item]) {
        output.libraries[item] = false;
        output.ok = false;
        continue;
      }
      const label = `${list[item].id}-${list[item].version.major}.${list[item].version.minor}`;
      output.libraries[label] = fs.existsSync(`${config.folders.libraries}/${label}`);
      if (!output.libraries[label]) {
        output.ok = false;
      }
    }
    return output;
  },
  // generates h5p.json file with info describing the library in the specified folder
  generateInfo: (folder, library) => {
    const target = `content/${folder}`;
    const lib = JSON.parse(fs.readFileSync(`${config.folders.cache}/${library}.json`, 'utf-8'))[library];
    const viewDepsFile = `${config.folders.cache}/${library}.json`;
    const editDepsFile = `${config.folders.cache}/${library}_edit.json`;
    let libs = JSON.parse(fs.readFileSync(viewDepsFile, 'utf-8'));
    const editLibs = JSON.parse(fs.readFileSync(editDepsFile, 'utf-8'));
    libs = {...libs, ...editLibs};
    const map = {};
    const preloadedDependencies = [];
    for (let item in libs) {
      for (let predep of libs[item].preloadedDependencies) {
        if (map[predep.machineName]) {
          continue;
        }
        map[predep.machineName] = true;
        preloadedDependencies.push(predep);
      }
    }
    preloadedDependencies.push({
      machineName: libs[library].id,
      minorVersion: libs[library].version.minor,
      majorVersion: libs[library].version.major,
    });
    const info = {
      title: folder,
      language: 'en',
      mainLibrary: lib.id,
      license: 'U',
      defaultLanguage: 'en',
      embedTypes: ['div'],
      preloadedDependencies
    };
    fs.writeFileSync(`${target}/h5p.json`, JSON.stringify(info));
  },
  // upgrades content via current main library upgrades.js scripts
  upgrade: (folder, library) => {
    const lib = JSON.parse(fs.readFileSync(`${config.folders.cache}/${library}.json`, 'utf-8'))[library];
    const info = JSON.parse(fs.readFileSync(`content/${folder}/h5p.json`, 'utf-8'));
    let mainLib = {};
    for (let item of info.preloadedDependencies) {
      if (item.machineName == lib.id) {
        mainLib = item;
        break;
      }
    }
    mainLib.majorVersion = parseInt(mainLib.majorVersion);
    mainLib.minorVersion = parseInt(mainLib.minorVersion);
    lib.version.major = parseInt(lib.version.major);
    lib.version.minor = parseInt(lib.version.minor);
    if (lib.version.major <= mainLib.majorVersion && lib.version.minor <= mainLib.minorVersion) {
      return;
    }
    const upgradesFile = `${config.folders.libraries}/${lib.id}-${lib.version.major}.${lib.version.minor}/upgrades.js`;
    if (!fs.existsSync(upgradesFile)) {
      return;
    }
    const contentFile = `content/${folder}/content.json`;
    let content = fs.readFileSync(contentFile, 'utf-8');
    const backupContent = content;
    content = JSON.parse(content);
    eval(fs.readFileSync(upgradesFile, 'utf-8'));
    let upgraded = false;
    for (let major in H5PUpgrades[lib.id]) {
      major = parseInt(major);
      if (mainLib.majorVersion > major) {
        continue;
      }
      for (let minor in H5PUpgrades[lib.id][major]) {
        minor = parseInt(minor);
        if (mainLib.majorVersion == major && mainLib.minorVersion >= minor) {
          continue;
        }
        upgraded = true;
        console.log(`>>> running content upgrade script for ${library} version ${major}.${minor}`);
        H5PUpgrades[lib.id][major][minor](content, (error, result) => {
          content = result;
        });
      }
    }
    if (!upgraded) {
      return;
    }
    const label = `${mainLib.majorVersion}.${mainLib.minorVersion}`;
    fs.writeFileSync(`content/${folder}/${label}_content.json`, backupContent);
    fs.writeFileSync(`content/${folder}/${label}_h5p.json`, JSON.stringify(info));
    fs.writeFileSync(contentFile, JSON.stringify(content));
    module.exports.generateInfo(folder, library);
  },
  machineToShort: (machineName) => {
    return machineName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase().replace('.', '-');
  },
  registryEntryFromRepoUrl: async function (repoUrl) {
    const url = new URL(repoUrl);
    const pieces = url.pathname.split('/').filter(n=>n);
    const org = pieces[pieces.length - 2];
    repoName = pieces[pieces.length - 1];
    const list = await getFile(fromTemplate(config.urls.library.list, { org, dep: repoName, version: 'master' }), true);
    repoName = this.machineToShort(list.machineName);
    const output = {};
    output[list.machineName] = {
      "id": list.machineName,
      "title": list.title,
      "repo": {
        "type": url.host,
        "url": repoUrl
      },
      "author": list.author,
      "runnable": list.runnable,
      "repoName": repoName,
      "org": org
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
                const parts = lib.split(' ');
                output[parts[0]] = {
                  name: parts[0],
                  version: parts[1]
                };
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
// get file from source and optionally parse it as JSON
const getFile = async (source, parseJson) => {
  let local = false;
  try {
    new URL(source);
  }
  catch {
    local = true;
  }
  let output;
  if (local) {
    if (!fs.existsSync(source)) {
      return '';
    }
    output = fs.readFileSync(source, 'utf-8');
  }
  else {
    output = (await superAgent.get(source).set('User-Agent', 'h5p-cli').ok(res => [200, 404].includes(res.status))).text;
  }
  if (output == '404: Not Found') {
    return '';
  }
  if (parseJson) {
    output = JSON.parse(output);
  }
  return output;
}
