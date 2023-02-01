const fs = require('fs');
const he = require('he');
const imageSize = require('image-size');
const logic = require('./logic.js');
const config = require('./config.js');
const l10n = require('./assets/l10n.json');
let cache = {
  registry: null,
  view: {},
  edit: {}
};
module.exports = {
  // renders dashboard
  dashboard: (request, response, next) => {
    try {
      const html = fs.readFileSync('./assets/templates/dashboard.html', 'utf-8');
      const input = {
        host: `${request.protocol}://${request.get('host')}`
      }
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // lists runnable libraries
  contentTypes: async (request, response, next) => {
    try {
      if (!cache.registry) {
        cache.registry = await logic.getRegistry();
      }
      if (!cache.registry.runnable) {
        cache.registry.runnable = {};
        for (let item in cache.registry.regular) {
          if (cache.registry.regular[item].runnable) {
            cache.registry.runnable[item] = cache.registry.regular[item];
          }
        }
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(cache.registry.runnable));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // import zipped archive of content type
  import: (request, response, next) => {
    try {
      const path = logic.import(request.params.folder, request.file.path);
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({path}));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // download zipped archive of content type
  export: (request, response, next) => {
    try {
      const file = logic.export(request.params.library, request.params.folder);
      response.download(file);
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // create empty content type
  create: async (request, response, next) => {
    try {
      const target = `content/${request.params.folder}`;
      const libraryFile = `${config.folders.cache}/${request.params.type}.json`;
      if (!fs.existsSync(libraryFile)) {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({
          error: `"${request.params.type}" library not cached; please run setup for library.`
        }));
        return;
      }
      if (fs.existsSync(target)) {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({
          error: `"${target}" folder already exists`
        }));
        return;
      }
      if (!cache.registry) {
        cache.registry = await logic.getRegistry();
      }
      const library = JSON.parse(fs.readFileSync(libraryFile, 'utf-8'));
      fs.mkdirSync(target);
      let libs = JSON.parse(fs.readFileSync(`${config.folders.cache}/${request.params.type}.json`, 'utf-8'));
      const editLibs = JSON.parse(fs.readFileSync(`${config.folders.cache}/${request.params.type}_edit.json`, 'utf-8'));
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
        machineName: libs[request.params.type].id,
        minorVersion: libs[request.params.type].version.minor,
        majorVersion: libs[request.params.type].version.major,
      });
      const info = {
        title: request.params.folder,
        language: 'en',
        mainLibrary: cache.registry.regular[request.params.type].id,
        license: 'U',
        defaultLanguage: 'en',
        embedTypes: ['div'],
        preloadedDependencies
      };
      fs.writeFileSync(`${target}/h5p.json`, JSON.stringify(info));
      fs.writeFileSync(`${target}/content.json`, JSON.stringify({}));
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({
        result: `created in "${target}"`
      }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // deletes a content folder
  remove: (request, response, next) => {
    try {
      fs.rmSync(`content/${request.params.folder}`, { recursive: true, force: true });
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({result: `removed "content/${request.params.folder}"`}));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // lists content folders
  projects: async (request, response, next) => {
    try {
      if (!cache.registry) {
        cache.registry = await logic.getRegistry();
      }
      const limit = parseInt(request.query.limit) || 10;
      const page = parseInt(request.query.page) || 0;
      const start = page * limit;
      const end = start + limit;
      const output = {
        list: [],
        total: 0
      }
      const dirs = fs.readdirSync('content');
      const list = [];
      for (let item of dirs) {
        if (!fs.existsSync(`content/${item}/h5p.json`)) {
          continue;
        }
        list.push(item);
      }
      output.total = list.length;
      for (let i = start; i < Math.min(end, list.length); i++) {
        const info = JSON.parse(fs.readFileSync(`content/${list[i]}/h5p.json`, 'utf-8'));
        output.list.push({
          title: he.encode(info.title),
          library: cache.registry.reversed?.[info?.mainLibrary]?.repoName,
          folder: list[i]
        });
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(output));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // renders view & edit modes on the same page
  splitView: (request, response, next) => {
    try {
      const splitView_html = fs.readFileSync('./assets/templates/splitView.html', 'utf-8');
      const input = {
        viewFrameSRC: `/view/${request.params.library}/${request.params.folder}?simple=1`,
        editFrameSRC: `/edit/${request.params.library}/${request.params.folder}?simple=1`
      }
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(splitView_html, input));
    }
    catch (error) {
     handleError(error, response); 
    }
  },
  // editor file upload
  uploadFile: (request, response, next) => {
    try {
      const form = JSON.parse(request.body.field);
      const targetFolder = `content/${request.params.folder}/${form.type}s`;
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
      }
      const ext = request.file.originalname.split('.')?.[1] || '';
      const path = `${form.type}s/${request.file.filename}.${ext}`;
      const targetFile = `${targetFolder}/${request.file.filename}.${ext}`;
      fs.renameSync(`${request.file.path}`, targetFile);
      const output = {
        mime: request.file.mimetype,
        path
      }
      if (form.type == 'image') {
        const info = imageSize(targetFile);
        if (info.width && info.height) {
          output.width = info.width;
          output.height = info.height;
        }
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(output));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // updates content.json file with data from content type editor form
  saveContent: (request, response, next) => {
    try {
      const input = JSON.parse(request.body.parameters);
      fs.writeFileSync(`content/${request.params.folder}/content.json`, JSON.stringify(input.params));
      const infoFile = `content/${request.params.folder}/h5p.json`;
      let info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
      info = {...info, ...input.metadata};
      if (info.authors && !info.authors.length) {
        delete info.authors;
      }
      if (info.changes && !info.changes.length) {
        delete info.changes;
      }
      fs.writeFileSync(infoFile, JSON.stringify(info));
      const contentFiles = parseContentFiles([input.params]);
      const list = [];
      for (let item in contentFiles) {
        list.push(item.split('/')[1]);
      }
      for (let type of config.mediaTypes) {// delete unused media files
        const targetFolder = `content/${request.params.folder}/${type}`;
        if (!fs.existsSync(targetFolder)) {
          continue;
        }
        const files = fs.readdirSync(targetFolder);
        for (let item of files) {
          if (!list.includes(item)) {
            fs.unlinkSync(`${targetFolder}/${item}`);
          }
        }
      }
      const simple = request.query.simple;
      response.redirect(`/${simple ? 'edit' : 'view'}/${request.params.library}/${request.params.folder}${simple ? '?simple=1' : ''}`);
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // endpoint that lists library data; used as ajax request by the content type editors;
  ajaxLibraries: async (request, response, next) => {
    try {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
      const registry = await logic.getRegistry();
      let libraries = [request.params.library];
      if (Array.isArray(request.body.libraries)) {
        libraries = [];
        for (let item of request.body.libraries) {
          item = item.split(' ')[0];
          libraries.push(registry.reversed[item].repoName);
        }
      }
      if (request.query.machineName) {
        libraries = [];
        libraries.push(registry.reversed[request.query.machineName].repoName);
      }
      const toDo = [];
      for (let item of libraries) {
        toDo.push(computePreloaded(item, baseUrl));
      }
      const preloaded = await Promise.all(toDo);
      let output;
      if (request.query.machineName) {
        const library = libraries[0];
        output = {
          name: cache.edit[library][library].id,
          version: cache.edit[library][library].version,
          title: cache.edit[library][library].title,
          upgradesScript: 'http://example.com/upgrade.js',
          semantics: cache.edit[library][library].semantics,
          language: null,
          defaultLanguage: null,
          languages: ['en'],
          javascript: preloaded[0].preloadedJs,
          css: preloaded[0].preloadedCss,
          translations: preloaded[0].translations,
          directories: preloaded[0].directories
        }
      }
      else {
        output = [];
        for (let item of preloaded) {
          const library = item.library;
          output.push({
            uberName: `${cache.edit[library][library].id} ${cache.edit[library][library].version.major}.${cache.edit[library][library].version.minor}`,
            name: cache.edit[library][library].id,
            majorVersion: cache.edit[library][library].version.major,
            minorVersion: cache.edit[library][library].version.minor,
            title: cache.edit[library][library].title,
            runnable: cache.edit[library][library].runnable,
            restricted: false,
            metadataSettings: null
          });
        }
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(output));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // html page that initializes and renders h5p content type editors
  edit: async (request, response, next) => {
    try {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
      const library = request.params.library;
      const folder = request.params.folder;
      if (!await verifySetup(library, response)) {
        return;
      }
      const metadataSemantics = fs.readFileSync(`${config.folders.assets}/metadataSemantics.json`, 'utf-8');
      const copyrightSemantics = fs.readFileSync(`${config.folders.assets}/copyrightSemantics.json`, 'utf-8');
      const cacheFile = `${config.folders.cache}/${library}_edit.json`;
      let links = '';
      if (!request.query.simple) {
        links = `
<a class="button" href="/view/${library}/${folder}">view</a>
<a class="button" href="/dashboard">dashboard</a>
<div class="button" id="deleteButton">delete</div>`;
      }
      if (!cache?.edit[library]) {
        if (fs.existsSync(cacheFile)) {
          cache.edit[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        }
        else {
          cache.edit[library] = await logic.computeDependencies(library, 'edit', true);
        }
      }
      const jsonContent = fs.readFileSync(`./content/${folder}/content.json`, 'utf8');
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in cache.edit[library]) {
        if (item == library) {
            continue;
          }
        const entry = cache.edit[library][item];
        const label = `${entry.id}-${entry.version.major}.${entry.version.minor}`;
        for (let jsItem of entry.preloadedJs) {
          preloadedJs.push(`"../../../${config.folders.libraries}/${label}/${jsItem.path}"`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`"../../../${config.folders.libraries}/${label}/${cssItem.path}"`);
        }
      }
      const mathDisplay = JSON.parse(fs.readFileSync(`${config.folders.cache}/h5p-math-display.json`, 'utf-8'))['h5p-math-display'];
      const mathDisplayLabel = `${mathDisplay.id}-${mathDisplay.version.major}.${mathDisplay.version.minor}`;
      preloadedJs.push(`"../../../${config.folders.libraries}/${mathDisplayLabel}/dist/h5p-math-display.js"`);
      const libraryConfig = JSON.parse(logic.fromTemplate(fs.readFileSync(`${config.folders.assets}/libraryConfig.json`, 'utf-8'), {
        baseUrl,
        mathDisplayLabel
      }));
      const html = fs.readFileSync('./assets/templates/edit.html', 'utf-8');
      const info = JSON.parse(fs.readFileSync(`content/${folder}/h5p.json`));
      const formParams = {
        params: JSON.parse(jsonContent),
        metadata: info
      }
      const input = {
        title: info.title,
        baseUrl,
        ajaxPath: `${baseUrl}/edit/${library}/${folder}/`,
        copyrightSemantics,
        metadataSemantics,
        folder,
        preloadedCss: preloadedCss.join(',\n'),
        preloadedJs: preloadedJs.join(',\n'),
        l10n: JSON.stringify(l10n),
        machineName: `${cache.edit[library][library].id} ${cache.edit[library][library].version.major}.${cache.edit[library][library].version.minor}`,
        parameters: he.encode(JSON.stringify(formParams)),
        libraryConfig: JSON.stringify(libraryConfig),
        links
      }
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // html page that initializes and renders h5p content types
  view: async (request, response, next) => {
    try {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
      const library = request.params.library;
      const folder = request.params.folder;
      if (!await verifySetup(library, response)) {
        return;
      }
      const cacheFile = `${config.folders.cache}/${library}.json`;
      let links = '';
      if (!request.query.simple) {
        links = `
<a class="button" href="/edit/${library}/${folder}">edit</a>
<a class="button" href="/split/${library}/${folder}">split view</a>
<a class="button" href="/dashboard">dashboard</a>
<div class="button" id="deleteButton">delete</div>`;
      }
      if (!cache?.view[library]) {
        if (fs.existsSync(cacheFile)) {
          cache.view[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        }
        else {
          cache.view[library] = await logic.computeDependencies(library, 'view', true);
        }
      }
      const jsonContent = fs.readFileSync(`./content/${folder}/content.json`, 'utf8');
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in cache.view[library]) {
        const entry = cache.view[library][item];
        const label = `${entry.id}-${entry.version.major}.${entry.version.minor}`;
        for (let jsItem of entry.preloadedJs) {
          preloadedJs.push(`../../../${config.folders.libraries}/${label}/${jsItem.path}`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`../../../${config.folders.libraries}/${label}/${cssItem.path}`);
        }
      }
      const mathDisplay = JSON.parse(fs.readFileSync(`${config.folders.cache}/h5p-math-display.json`, 'utf-8'))['h5p-math-display'];
      const mathDisplayLabel = `${mathDisplay.id}-${mathDisplay.version.major}.${mathDisplay.version.minor}`;
      preloadedJs.push(`../../../${config.folders.libraries}/${mathDisplayLabel}/dist/h5p-math-display.js`);
      const libraryConfig = JSON.parse(logic.fromTemplate(fs.readFileSync(`${config.folders.assets}/libraryConfig.json`, 'utf-8'), {
        baseUrl,
        mathDisplayLabel
      }));
      const html = fs.readFileSync('./assets/templates/view.html', 'utf-8');
      const info = JSON.parse(fs.readFileSync(`content/${folder}/h5p.json`, 'utf-8'));
      const input = {
        title: info.title,
        baseUrl,
        library,
        folder,
        machineName: `${cache.view[library][library].id} ${cache.view[library][library].version.major}.${cache.view[library][library].version.minor}`,
        jsonContent: JSON.stringify(jsonContent),
        preloadedCss: JSON.stringify(preloadedCss),
        preloadedJs: JSON.stringify(preloadedJs),
        l10n: JSON.stringify(l10n),
        libraryConfig: JSON.stringify(libraryConfig),
        links
      }
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
    }
    catch (error) {
      handleError(error, response);
    }
  }
}
// parses content.json objects for entries of file type
const parseContentFiles = (entries) => {
  let toDo = [];
  let list = [];
  const output = {};
  const valid = ['path', 'mime'];
  const parseList = () => {
    toDo = [];
    for (let obj of list) {
      for (let attr in obj) {
        if (valid.includes(attr) && typeof attr == 'string') {
          output[obj.path] = obj;
          continue;
        }
        if (typeof obj[attr] == 'object' && !Array.isArray(obj[attr])) {
          toDo.push(obj[attr]);
        }
        if (Array.isArray(obj[attr])) {
          toDo = toDo.concat(obj[attr]);
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
/* generates lists of JavaScript & CSS files to load
as well as translations and directories entries for use in content types */
const computePreloaded = async (library, baseUrl) => {
  const cacheFile = `${config.folders.cache}/${library}_edit.json`;
  if (!cache?.edit[library]) {
    if (fs.existsSync(cacheFile)) {
      cache.edit[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    }
    else {
      cache.edit[library] = await logic.computeDependencies(library, 'edit', true);
    }
  }
  const directories = {};
  const translations = {};
  let preloadedJs = [];
  let preloadedCss = [];
  for (let item in cache.edit[library]) {
    const entry = cache.edit[library][item];
    if (item == library && entry.requiredBy.length == 1) {
      let required = false;
      for (let obj of entry.editorDependencies) {
        if (obj.machineName == entry.id) {
          required = true;
        }
      }
      if (!required) {
        continue;
      }
    }
    const label = `${entry.id}-${entry.version.major}.${entry.version.minor}`;
    for (let jsItem of entry.preloadedJs) {
      preloadedJs.push(`${baseUrl}/${config.folders.libraries}/${label}/${jsItem.path}`);
    }
    for (let cssItem of entry.preloadedCss) {
      preloadedCss.push(`${baseUrl}/${config.folders.libraries}/${label}/${cssItem.path}`);
    }
    translations[entry.id] = entry.translations;
    directories[label] = label;
  }
  return { library, preloadedJs,  preloadedCss, translations, directories};
}
const handleError = (error, response) => {
  console.log(error);
  response.set('Content-Type', 'application/json');
  response.end(JSON.stringify({ error: error.toString() }));
}
const verifySetup = async (library, response) => {
  const setupStatus = await logic.verifySetup(library);
  if (!setupStatus.ok) {
    response.set('Content-Type', 'text/html');
    response.end(`
"${library}" is not properly setup. Please run "node cli.js setup ${library}" for setup.</br>
For a detailed setup status report please run "node cli.js verify ${library}".`);
    return false;
  }
  else {
    return true;
  }
}
