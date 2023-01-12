const fs = require('fs');
const he = require('he');
const imageSize = require('image-size');
const logic = require('./logic.js');
const config = require('./config.js');
const l10n = require('./assets/l10n.json');
const lib = config.folders.lib;
let cache = {
  run: {},
  edit: {}
};
module.exports = {
  // renders dashboard
  dashboard: (request, response, next) => {
    try {
      const html = fs.readFileSync('./assets/templates/dashboard.html', 'utf-8');
      const input = {
        header: 'cheese'
      }
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  },
  // lists content folders
  projects: (request, response, next) => {
    try {
      const limit = parseInt(request.query.limit) || 10;
      const page = parseInt(request.query.page) || 0;
      const start = page * limit;
      const end = start + limit;
      const output = [];
      const dirs = fs.readdirSync('content');
      const list = [];
      for (let item of dirs) {
        item = item.split('_');
        if (item.length == 2) {
          list.push(item);
        }
      }
      for (let i = start; i < Math.min(end, list.length); i++) {
        output.push({
          name: list[i][1],
          library: list[i][0],
          folder: `${list[i][0]}_${list[i][0]}`
        });
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(output));
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  },
  // renders run & edit modes on the same page
  splitView: (request, response, next) => {
    const splitView_html = fs.readFileSync('./assets/templates/splitView.html', 'utf-8');
    const input = {
      runFrameSRC: `/content/${request.params.library}/${request.params.folder}?simple=1`,
      editFrameSRC: `/editor/${request.params.library}/${request.params.folder}?simple=1`
    }
    response.set('Content-Type', 'text/html');
    response.end(logic.fromTemplate(splitView_html, input));
  },
  // editor file upload
  saveFile: (request, response, next) => {
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
      console.log(error);
      response.end(error.toString());
    }
  },
  // updates content.json file with data from content type editor form
  saveContent: (request, response, next) => {
    try {
      const input = JSON.parse(request.body.parameters);
      fs.writeFileSync(`content/${request.body.action}/content.json`, JSON.stringify(input.params));
      // delete unused media files
      const contentFiles = parseContentFiles([input.params]);
      const list = [];
      for (let item in contentFiles) {
        list.push(item.split('/')[1]);
      }
      for (let type of config.mediaTypes) {
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
      response.redirect(`/${simple ? 'editor' : 'content'}/${request.params.library}/${request.params.folder}${simple ? '?simple=1' : ''}`);
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
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
      console.log(error);
      response.end(error.toString());
    }
  },
  // html page that initializes and renders h5p content type editors
  editor: async (request, response, next) => {
    try {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
      const library = request.params.library;
      const folder = request.params.folder;
      const metadataSemantics = fs.readFileSync(`${config.folders.assets}/metadataSemantics.json`, 'utf-8');
      const copyrightSemantics = fs.readFileSync(`${config.folders.assets}/copyrightSemantics.json`, 'utf-8');
      const cacheFile = `${config.folders.cache}/${library}_edit.json`;
      let links = '';
      if (!request.query.simple) {
        links = `<a class="h5p-cli-button" href="/content/${library}/${folder}">cancel</a>`;
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
          preloadedJs.push(`"../../../${lib}/${label}/${jsItem.path}"`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`"../../../${lib}/${label}/${cssItem.path}"`);
        }
      }
      const formParams = {
        params: JSON.parse(jsonContent),
        metadata: {
          defaultLanguage: 'en',
          license: 'U',
          title: folder
        }
      }
      const html = fs.readFileSync('./assets/templates/editor.html', 'utf-8');
      const input = {
        baseUrl,
        ajaxPath: `${baseUrl}/editor/${library}/${folder}/`,
        copyrightSemantics,
        metadataSemantics,
        folder,
        preloadedCss: preloadedCss.join(',\n'),
        preloadedJs: preloadedJs.join(',\n'),
        l10n: JSON.stringify(l10n),
        library: `${cache.edit[library][library].id} ${cache.edit[library][library].version.major}.${cache.edit[library][library].version.minor}`,
        parameters: he.encode(JSON.stringify(formParams)),
        links
      }
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  },
  // html page that initializes and renders h5p content types
  content: async (request, response, next) => {
    try {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
      const library = request.params.library;
      const folder = request.params.folder;
      const cacheFile = `${config.folders.cache}/${library}.json`;
      let links = '';
      if (!request.query.simple) {
        links = `<a class="h5p-cli-button" href="/editor/${library}/${folder}">editor</a> <a class="h5p-cli-button" href="/split/${library}/${folder}">split view</a>`;
      }
      if (!cache?.run[library]) {
        if (fs.existsSync(cacheFile)) {
          cache.run[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        }
        else {
          cache.run[library] = await logic.computeDependencies(library, 'run', true);
        }
      }
      const jsonContent = fs.readFileSync(`./content/${folder}/content.json`, 'utf8');
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in cache.run[library]) {
        const entry = cache.run[library][item];
        const label = `${entry.id}-${entry.version.major}.${entry.version.minor}`;
        for (let jsItem of entry.preloadedJs) {
          preloadedJs.push(`../../../${lib}/${label}/${jsItem.path}`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`../../../${lib}/${label}/${cssItem.path}`);
        }
      }
      const html = fs.readFileSync('./assets/templates/content.html', 'utf-8');
      const input = {
        baseUrl,
        folder,
        library: `${cache.run[library][library].id} ${cache.run[library][library].version.major}.${cache.run[library][library].version.minor}`,
        jsonContent: JSON.stringify(jsonContent),
        preloadedCss: JSON.stringify(preloadedCss),
        preloadedJs: JSON.stringify(preloadedJs),
        l10n: JSON.stringify(l10n),
        links
      }
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
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
/* generates lists os JavaScript & CSS files to load
as well as translations and directories entries for use in content types */
const computePreloaded = async (library, baseUrl) => {
  try {
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
        continue;
      }
      const label = `${entry.id}-${entry.version.major}.${entry.version.minor}`;
      for (let jsItem of entry.preloadedJs) {
        preloadedJs.push(`${baseUrl}/${lib}/${label}/${jsItem.path}`);
      }
      for (let cssItem of entry.preloadedCss) {
        preloadedCss.push(`${baseUrl}/${lib}/${label}/${cssItem.path}`);
      }
      translations[entry.id] = entry.translations;
      directories[label] = label;
    }
    return { library, preloadedJs,  preloadedCss, translations, directories};
  }
  catch (error) {
    throw error;
  }
}
