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
// retrieves org & repoName from git url
const parseGitUrl = (gitUrl) => {
  const type = gitUrl.slice(0, 4);
  switch (type) {
    case 'git@': {
      gitUrl = gitUrl.replace('git@', '');
      gitUrl = gitUrl.replace('.git', '');
      let pieces = gitUrl.split(':');
      const host = pieces[0];
      pieces = pieces[1].split('/');
      return {
        host,
        org: pieces[0],
        repoName: pieces[1]
      }
      break;
    }
    case 'http': {
      gitUrl = gitUrl.replace('https://', '');
      gitUrl = gitUrl.replace('.git', '');
      const pieces = gitUrl.split('/');
      return {
        host: pieces[0],
        org: pieces[1],
        repoName: pieces[2]
      }
      break;
    }
  }
}
// get file from source and optionally parse it as JSON
const getFile = async (source, parseJson) => {
  const local = source.indexOf('http') !== 0 ? true : false;
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
// clone repo and retrieve file
const getRepoFile = (gitUrl, path, branch = 'master', parseJson, cleanStart) => {
  const { repoName } = parseGitUrl(gitUrl);
  const target = `${config.folders.temp}/${repoName}_${branch}`;
  const filePath = `${target}/${path}`;
  if (cleanStart) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  if (!fs.existsSync(target)) {
    execSync(`git clone ${gitUrl} ${target} --branch ${branch}`, { stdio : 'pipe' }).toString();
  }
  if (!fs.existsSync(filePath)) {
    return '';
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return parseJson ? JSON.parse(data) : data;
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
module.exports = {
  // imports content type from zip archive file in the .h5p format
  import: function (folder, archive) {
    const target = `${config.folders.temp}/${folder}`;
    new admZip(archive).extractAllTo(target);
    fs.renameSync(`${target}/content`, `content/${folder}`);
    fs.renameSync(`${target}/h5p.json`, `content/${folder}/h5p.json`);
    fs.rmSync(target, { recursive: true, force: true });
    return folder;
  },
  // creates zip archive export file in the .h5p format
  export: function (library, folder) {
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
  getRegistry: async function (ignoreCache) {
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
        if (!list[item].repoName) {
          list[item].repoName = list[item].repo.url.split('/').slice(-1)[0];
        }
        if (!list[item].org) {
          list[item].org = list[item].repo.url.split('/').slice(3, 4)[0];
        }
      }
      if (!list[item].shortName) {
        list[item].shortName = list[item].repoName;
      }
      delete list[item].resume;
      delete list[item].fullscreen;
      delete list[item].xapiVerbs;
      output.reversed[list[item].id] = list[item];
      output.regular[list[item].shortName] = list[item];
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
  computeDependencies: async function (library, mode, saveToCache, version, folder) {
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
    const getOptionals = async (dep, org, repoName, version, dir) => {
      if (cache[dep].optionals) {
        return cache[dep].optionals;
      }
      cache[dep].semantics = dir ? await getFile(`${config.folders.libraries}/${dir}/semantics.json`, true)
        : getRepoFile(fromTemplate(config.urls.library.clone, { org, repo: repoName }), 'semantics.json', version, true);
      cache[dep].optionals = parseSemanticLibraries(cache[dep].semantics);
      return cache[dep].optionals;
    }
    const latestPatch = (org, repo, version) => {
      const tags = module.exports.tags(org, repo);
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
          break;
        }
      }
      return patch > -1 ? `${version}.${patch}` : version;
    }
    // determine if dependency needs to be processed
    const handleDepListEntry = (machineName, parent, ver, dir) => {
      const lib = registry.reversed[machineName];
      const entry = lib?.shortName;
      if (!entry) {
        const optional = isOptional(cache[parent], machineName);
        if (!done[level][machineName] || done[level][machineName].optional) {
          done[level][machineName] = { optional, parent };
        }
        const parentVersion = `${done[level][parent].version.major}.${done[level][parent].version.minor}.${done[level][parent].version.patch}`
        process.stdout.write(`\n!!! ${optional ? 'optional' : 'required'} library ${machineName} ${ver} not found in registry; required by ${parent} (${parentVersion}) `);
        return;
      }
      const version = ver == 'master' ? ver : latestPatch(lib.org, entry, ver);
      if (!done[level][entry]?.id && !toDo[entry]?.parent) {
        toDo[entry] = { parent, version, folder: dir };
      }
      weights[entry] = weights[entry] ? weights[entry] + 1 : 1;
      return;
    }
    // determine if a library is a soft dependency of its parent
    const isOptional = (parent, machineName) => {
      const finder = (element) => element.machineName === machineName;
      if (parent.preloadedDependencies?.find(finder) !== undefined || parent.editorDependencies?.find(finder) !== undefined) {
        return false;
      }
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
      const { repoName } = registry.regular[dep]?.repo?.url ? parseGitUrl(registry.regular[dep].repo.url) : dep;
      if (cache[dep]) {
        list = cache[dep];
        process.stdout.write(' (cached) ');
      }
      else {
        list = toDo[dep].folder ? await getFile(`${config.folders.libraries}/${toDo[dep].folder}/library.json`, true)
          : getRepoFile(fromTemplate(config.urls.library.clone, { org, repo: repoName }), 'library.json', version, true);
        cache[dep] = list;
      }
      if (!list.title) {
        throw new Error(`missing library.json for ${toDo[dep].folder || dep}`);
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
      done[level][dep].metadataSettings = list.metadataSettings;
      if (!done[level][dep].requiredBy) {
        done[level][dep].requiredBy = [];
      }
      done[level][dep].requiredBy.push(requiredByPath);
      done[level][dep].level = level;
      let ver = version == 'master' ? version : `${done[level][dep].version.major}.${done[level][dep].version.minor}.${done[level][dep].version.patch}`;
      const optionals = await getOptionals(dep, org, repoName, ver, toDo[dep].folder);
      if (list.preloadedDependencies) {
        for (let item of list.preloadedDependencies) {
          ver = version == 'master' ? version : `${item.majorVersion}.${item.minorVersion}`;
          const dir = folder ? `${item.machineName}-${item.majorVersion}.${item.minorVersion}` : null;
          handleDepListEntry(item.machineName, dep, ver, dir);
        }
      }
      for (let item in optionals) {
        ver = version == 'master' ? version : optionals[item].version;
        const dir = folder ? `${item}-${optionals[item].version}` : null;
        handleDepListEntry(item, dep, ver, dir);
      }
      if (mode == 'edit' && list.editorDependencies) {
        for (let item of list.editorDependencies) {
          ver = version == 'master' ? version : `${item.majorVersion}.${item.minorVersion}`;
          const dir = folder ? `${item.machineName}-${item.majorVersion}.${item.minorVersion}` : null;
          handleDepListEntry(item.machineName, dep, ver, dir);
        }
      }
      delete toDo[dep];
      console.log('done');
    }
    registry = await module.exports.getRegistry();
    if (!folder && !registry.regular[library]) {
      throw new Error(`unregistered ${library} library`);
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
    let toSave = {};
    for (let i = level; i >= 0; i--) {
      const keys = Object.keys(done[i]);
      keys.sort((a, b) => {
        return weights[b] - weights[a];
      });
      for (let key of keys) {
        if (!output[key] || output[key]?.optional) {
          output[key] = done[i][key];
        }
        if (!done[i][key].id) {
          continue;
        }
        toSave[key] = done[i][key];
      }
    }
    if (saveToCache) {
      const doneFile = `${config.folders.cache}/${library}${mode == 'edit' ? '_edit' : ''}.json`;
      if (!fs.existsSync(config.folders.cache)) fs.mkdirSync(config.folders.cache);
      fs.writeFileSync(doneFile, JSON.stringify(toSave));
      console.log(`deps saved to ${doneFile}`);
    }
    process.stdout.write('\n');
    return output;
  },
  // list tags for library using git
  tags: function (org, repo, mainBranch = 'master') {
    const library = getRepoFile(fromTemplate(config.urls.library.clone, { org, repo }), 'library.json', mainBranch, true);
    const label = `${repo}_${mainBranch}`;
    const folder = `${config.folders.temp}/${label}`;
    if (!fs.existsSync(folder)) {
      module.exports.clone(org, repo, mainBranch, label);
    }
    execSync(`git checkout ${mainBranch}`, { cwd: folder, stdio : 'pipe' });
    execSync(`git pull origin ${mainBranch}`, { cwd: folder, stdio : 'pipe' });
    const tags = execSync('git tag', { cwd: folder }).toString().split('\n');
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
  download: async function (org, repo, version, target) {
    const blob = (await superAgent.get(fromTemplate(config.urls.library.zip, { org, repo, version })))._body;
    const zipFile = `${config.folders.temp}/temp.zip`;
    fs.writeFileSync(zipFile, blob);
    new admZip(zipFile).extractAllTo(config.folders.libraries);
    fs.rmSync(zipFile);
    fs.renameSync(`${config.folders.libraries}/${repo}-master`, target);
  },
  // clone repository using git
  clone: function (org, repo, branch, target) {
    return execSync(`git clone ${fromTemplate(config.urls.library.clone, {org, repo})} ${target} --branch ${branch}`, { cwd: config.folders.libraries }).toString();
  },
  /* clones/downloads dependencies to libraries folder using git and runs relevant npm commands
  mode - 'view' or 'edit' to fetch non-editor or editor libraries
  useCache - if true cached dependency list is used
  latest - if true master branch libraries are used; otherwise the versions found in the cached deps list are used
  toSkip - optional array of libraries to skip; after a library is parsed by the function it's auto-added to the array so it's skipped for efficiency */
  getWithDependencies: async function (action, library, mode, useCache, latest, toSkip = []) {
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
      if (toSkip?.indexOf(item) != -1) {
        continue;
      }
      toSkip?.push(item);
      if (!list[item].id) {
        if (list[item].optional) {
          console.log(`> skipping optional unregistered ${item} library`);
          continue;
        }
        else {
          throw new Error(`unregistered ${item} library`);
        }
      }
      const label = `${list[item].id}-${list[item].version.major}.${list[item].version.minor}`;
      const listVersion = `${list[item].version.major}.${list[item].version.minor}.${list[item].version.patch}`;
      const version = latest ? 'master' : listVersion;
      const folder = `${config.folders.libraries}/${label}`;
      if (fs.existsSync(folder)) {
        if (latest && !process.env.H5P_NO_UPDATES) {
          console.log(`>> ~ updating to ${list[item].repoName} ${listVersion}`);
          execSync(`git checkout master`, { cwd: folder, stdio : 'pipe' });
          console.log(execSync('git pull origin', { cwd: folder }).toString());
        }
        else {
          console.log(`>> ~ skipping updates for ${list[item].repoName} ${listVersion}`);
        }
        continue;
      }
      console.log(`>> + installing ${list[item].repoName} ${listVersion}`);
      if (action == 'download') {
        await module.exports.download(list[item].org, list[item].repoName, version, folder);
      }
      else {
        console.log(module.exports.clone(list[item].org, list[item].repoName, version, label));
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
    }
    return toSkip;
  },
  /* checks if dependency lists are cached and dependencies are installed for a given library;
  returns a report with boolean statuses; the overall status is reflected under the "ok" attribute;*/
  verifySetup: async function (library) {
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
  generateInfo: function (folder, library) {
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
  upgrade: function (folder, library) {
    const lib = JSON.parse(fs.readFileSync(`${config.folders.cache}/${library}.json`, 'utf-8'))[library];
    const info = JSON.parse(fs.readFileSync(`content/${folder}/h5p.json`, 'utf-8'));
    const extraAttrs = [
      'authors', 'source', 'license', 'licenseVersion', 'licenseExtras', 'yearsFrom',
      'yearsTo', 'changes', 'authorComments', 'w', 'h', 'metaKeywords', 'metaDescription'
    ];
    const extra = {};
    for (let item of extraAttrs) {
      extra[item] = info[item];
    }
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
        }, extra);
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
  machineToShort: function (machineName) {
    machineName = machineName.replace('H5PEditor', 'H5P-Editor');
    return machineName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase().replace('.', '-');
  },
  registryEntryFromRepoUrl: function (gitUrl) {
    let { host, org, repoName } = parseGitUrl(gitUrl);
    const list = getRepoFile(gitUrl, 'library.json', 'master', true);
    const shortName = this.machineToShort(list.machineName);
    const type = host.split('.')[0];
    const output = {};
    output[list.machineName] = {
      id: list.machineName,
      title: list.title,
      repo: {
        type: type,
        url: `https://${host}/${org}/${repoName}`
      },
      author: list.author,
      runnable: list.runnable,
      shortName,
      repoName,
      org
    }
    return output;
  },
  fromTemplate,
  parseGitUrl,
  getFile,
  getFileList
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
      if (obj?.type === 'library' && Array.isArray(obj?.options)) {
        for (let lib of obj.options) {
          const parts = lib.split(' ');
          output[parts[0]] = {
            name: parts[0],
            version: parts[1]
          };
        }
        continue;
      }
      for (let attr in obj) { // go through entry attributes
        if (attr === 'fields' && Array.isArray(obj[attr])) {
          for (let item of obj[attr]) {
            if (item?.type === 'library' && Array.isArray(item?.options)) {
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
        if (typeof obj[attr] === 'object' && !Array.isArray(obj[attr])) {
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

const { workerData, parentPort } = require('worker_threads');
if (parentPort && workerData) {
  console.log('<<< worker working...');
  const run = async () => {
    const result = await module.exports[workerData.function].apply(null, workerData.arguments);
    parentPort.postMessage(result);
  }
  run();
}
