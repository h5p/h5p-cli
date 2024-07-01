const fs = require('fs');
const he = require('he');
const imageSize = require('image-size');
const logic = require('./logic.js');
const config = require('./config.js');
const l10n = require('./assets/l10n.json');
const supportedLanguages = require(`${require.main.path}/${config.folders.assets}/languageCatcher.js`);
let cache = {
  registry: null,
  view: {},
  edit: {}
};
let session = {
  name: 'main-session',
  language: 'en',
  status: ''
}
module.exports = {
  // load favicon.ico file
  favicon: (request, response, next) => {
    try {
      const icon = fs.readFileSync(`${require.main.path}/favicon.ico`);
      response.set('Content-Type', 'image/x-icon');
      response.end(icon);
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // renders dashboard
  dashboard: async (request, response, next) => {
    try {
      manageSession(null, {
        language: request.query?.language,
        name: request.query?.session
      });
      const html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/templates/dashboard.html`, 'utf-8');
      const labels = await getLangLabels();
      const languageFiles = logic.getFileList(`${config.folders.libraries}/h5p-editor-php-library/language`);
      const languages = {};
      for (let item of languageFiles) {
        const key = item.match(/language\/(.*?)\.js/)?.[1];
        languages[key] = supportedLanguages[key];
      }
      let input = {
        assets: config.folders.assets,
        api: config.api,
        status: session.status,
        language: session.language,
        languages: JSON.stringify(languages)
      }
      input = {...input, ...labels};
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
      session.status = '';
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
        const list = [];
        for (let item in cache.registry.regular) {
          if (cache.registry.regular[item].runnable) {
            list.push(item);
          }
        }
        list.sort((a, b) => {
          const first = a.toLowerCase();
          const second = b.toLowerCase();
          if (first < second) {
            return -1;
          }
          if (first > second) {
            return 1;
          }
          return 0;
        });
        for (let item of list) {
          cache.registry.runnable[item] = cache.registry.regular[item];
        }
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(cache.registry.runnable));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // updates session file used for resume functionality
  setUserData: (request, response, next) => {
    try {
      manageSession(request.params.folder, {
        language: request.query?.language,
        name: request.query?.session
      });
      if (session.name == 'null') {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({success: true}));
        return;
      }
      const dataFile = `content/${request.params.folder}/sessions/${session.name}.json`;
      const data = getSession(request.params.folder);
      data.resume[request.params.id] = data.resume[request.params.id] || {};
      data.resume[request.params.id][request.params.type] = request.body.data;
      fs.writeFileSync(dataFile, JSON.stringify(data));
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({success: true}));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // retrieves session data for resume functionality
  getUserData: (request, response, next) => {
    try {
      manageSession(request.params.folder, {
        language: request.query?.language,
        name: request.query?.session
      });
      const data = getSession(request.params.folder);
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(data?.[0] || {}));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // import zipped archive of content type
  import: (request, response, next) => {
    try {
      request.params.folder = request.params.folder.replaceAll(/[^a-zA-Z0-9 -]/g, '');
      request.params.folder = request.params.folder.replaceAll(' ', '-');
      const path = logic.import(request.params.folder, request.file.path);
      fs.rmSync(request.file.path);
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
      request.params.folder = request.params.folder.replaceAll(/[^a-zA-Z0-9 -]/g, '');
      request.params.folder = request.params.folder.replaceAll(' ', '-');
      const target = `content/${request.params.folder}`;
      const viewDepsFile = `${config.folders.cache}/${request.params.type}.json`;
      const editDepsFile = `${config.folders.cache}/${request.params.type}_edit.json`;
      if (!fs.existsSync(viewDepsFile) || !fs.existsSync(editDepsFile)) {
        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify({
          error: `"${request.params.type}" library not cached; please run "h5p setup ${request.params.type}".`
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
      fs.mkdirSync(target);
      logic.generateInfo(request.params.folder, request.params.type);
      fs.writeFileSync(`${target}/content.json`, JSON.stringify({}));
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({
        result: request.params.folder
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
        const info = JSON.parse(fs.readFileSync(`content/${item}/h5p.json`, 'utf-8'));
        if (!cache.registry.reversed[info.mainLibrary]) {
          continue;
        }
        list.push({
          id: info.mainLibrary,
          title: info.title,
          folder: item
        });
      }
      list.sort((a, b) => {
        const first = a.title.toLowerCase();
        const second = b.title.toLowerCase();
        if (first < second) {
          return -1;
        }
        if (first > second) {
          return 1;
        }
        return 0;
      });
      output.total = list.length;
      for (let i = start; i < Math.min(end, list.length); i++) {
        let entry = cache.registry.reversed?.[list[i].id];
        const library = entry.shortName;
        const cacheFile = `${config.folders.cache}/${library}.json`;
        if (fs.existsSync(cacheFile)) {
          entry = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))[library];
        }
        let icon = '/assets/icon.svg';
        if (entry.version) {
          const libraryFolder = `${config.folders.libraries}/${list[i].id}-${entry.version.major}.${entry.version.minor}`;
          const iconFile = `${libraryFolder}/icon.svg`;
          if (fs.existsSync(libraryFolder)) {
            if (fs.existsSync(iconFile)) {
              icon = iconFile;
            }
            else {
              const files = fs.readdirSync(libraryFolder);
              for (let item of files) {
                if (item.split('.')?.[1] == 'svg') {
                  icon = `${libraryFolder}/${item}`;
                  break;
                }
              }
            }
          }
        }
        list[i].library = library;
        list[i].icon = icon;
        output.list.push(list[i]);
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(output));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // renders view & edit modes on the same page
  splitView: async (request, response, next) => {
    try {
      const splitView_html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/templates/splitView.html`, 'utf-8');
      const labels = await getLangLabels();
      let input = {
        assets: config.folders.assets,
        viewFrameSRC: `/view/${request.params.library}/${request.params.folder}?simple=1`,
        editFrameSRC: `/edit/${request.params.library}/${request.params.folder}?simple=1`
      }
      input = {...input, ...labels};
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

      const ext =
        (request.file.originalname.split('.')?.pop() || '').toLowerCase();

      const valid =
        validateFileForUpload(form.type, request.file.mimetype, ext);

      if (valid !== 'OK') {
        throw new Error(valid);
      }

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
        const parts = item.split('/');
        list.push(parts[parts.length - 1]);
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
  // return translations entries for library and dependencies
  ajaxTranslations: async (request, response, next) => {
    try {
      const library = request.params.library;
      const cacheFile = `${config.folders.cache}/${library}.json`;
      if (!cache?.view[library]) {
        if (fs.existsSync(cacheFile)) {
          cache.view[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        }
        else {
          cache.view[library] = await logic.computeDependencies(library, 'view', true);
        }
      }
      if (!cache.registry) {
        cache.registry = await logic.getRegistry();
      }
      const translations = {};
      for (let item of request.body.libraries) {
        const entry = cache.view[library][cache.registry.reversed[item.split(' ')[0]].shortName];
        const label = `${entry.id}-${entry.version.major}.${entry.version.minor}`;
        const idx = `${entry.id} ${entry.version.major}.${entry.version.minor}`;
        const languageFolder = `${config.folders.libraries}/${label}/language`;
        const langFile = `${languageFolder}/${request.query.language}.json`;
        if (fs.existsSync(langFile)) {
          translations[idx] = fs.readFileSync(langFile, 'utf-8');
        }
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({ success: true, data: translations }));
    }
    catch (error) {
      handleError(error, response);
    }
  },
  // endpoint that lists library data; used as ajax request by the content type editors;
  ajaxLibraries: async (request, response, next) => {
    try {
      const output = await ajaxLibraries({
        library: request.params.library,
        libraries: request.body.libraries,
        machineName: request.query.machineName
      });
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
      const baseUrl = config.api;
      const library = request.params.library;
      const folder = request.params.folder;
      if (!await verifySetup(library, response)) {
        return;
      }
      const metadataSemantics = fs.readFileSync(`${require.main.path}/${config.folders.assets}/metadataSemantics.json`, 'utf-8');
      const copyrightSemantics = fs.readFileSync(`${require.main.path}/${config.folders.assets}/copyrightSemantics.json`, 'utf-8');
      const cacheFile = `${config.folders.cache}/${library}_edit.json`;
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
          preloadedJs.push(`"/${config.folders.libraries}/${label}/${jsItem.path}"`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`"/${config.folders.libraries}/${label}/${cssItem.path}"`);
        }
      }
      const mathDisplay = JSON.parse(fs.readFileSync(`${config.folders.cache}/h5p-math-display.json`, 'utf-8'))['h5p-math-display'];
      const mathDisplayLabel = `${mathDisplay.id}-${mathDisplay.version.major}.${mathDisplay.version.minor}`;
      preloadedJs.push(`"/${config.folders.libraries}/${mathDisplayLabel}/dist/h5p-math-display.js"`);
      const libraryConfig = JSON.parse(logic.fromTemplate(fs.readFileSync(`${require.main.path}/${config.folders.assets}/libraryConfig.json`, 'utf-8'), {
        baseUrl,
        mathDisplayLabel
      }));
      const html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/templates/edit.html`, 'utf-8');
      const info = JSON.parse(fs.readFileSync(`content/${folder}/h5p.json`, 'utf-8'));
      info.language = session.language;
      const id = cache.edit[library][library].id;
      let mainLibrary = {};
      for (let item of info.preloadedDependencies) {
        if (item.machineName == id) {
          mainLibrary = item;
          break;
        }
      }
      manageSession(request.params.folder, {
        language: request.query?.language,
        name: request.query?.session
      }, true);
      const formParams = {
        params: JSON.parse(jsonContent),
        metadata: info
      }
      const labels = await getLangLabels();
      const machineName = `${cache.edit[library][library].id} ${cache.edit[library][library].version.major}.${cache.edit[library][library].version.minor}`;
      const libraryDirectories = JSON.stringify(await getLibraryDirectories(id));
      let input = {
        assets: config.folders.assets,
        libraries: config.folders.libraries,
        title: info.title,
        baseUrl,
        ajaxPath: `${baseUrl}/edit/${library}/${folder}/`,
        copyrightSemantics,
        metadataSemantics,
        library,
        folder,
        preloadedCss: preloadedCss.join(',\n'),
        preloadedJs: preloadedJs.join(',\n'),
        l10n: JSON.stringify(l10n),
        machineName,
        version: `${cache.edit[library][library].version.major}.${cache.edit[library][library].version.minor}`,
        contentVersion: `${mainLibrary.majorVersion}.${mainLibrary.minorVersion}`,
        id,
        libraryDirectories,
        parameters: he.encode(JSON.stringify(formParams)),
        libraryConfig: JSON.stringify(libraryConfig),
        language: session.language,
        watcher: config.files.watch,
        simple: request.query.simple ? 'hidden' : ''
      }
      input = {...input, ...labels};
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
      const baseUrl = config.api;
      const library = request.params.library;
      const folder = request.params.folder;
      if (!await verifySetup(library, response)) {
        return;
      }
      logic.upgrade(folder, library);
      const cacheFile = `${config.folders.cache}/${library}.json`;
      if (!cache?.view[library]) {
        if (fs.existsSync(cacheFile)) {
          cache.view[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        }
        else {
          cache.view[library] = await logic.computeDependencies(library, 'view', true);
        }
      }
      const jsonContent = fs.readFileSync(`./content/${folder}/content.json`, 'utf8');
      const sessions = manageSession(request.params.folder, {
        language: request.query?.language,
        name: request.query?.session
      }, true);
      const userData = getSession(request.params.folder);
      let metadata = await logic.getFile(`content/${folder}/h5p.json`, true);
      metadata.language = session.language;
      metadata = JSON.stringify(metadata);
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in cache.view[library]) {
        const entry = cache.view[library][item];
        const label = `${entry.id}-${entry.version.major}.${entry.version.minor}`;
        for (let jsItem of entry.preloadedJs) {
          preloadedJs.push(`/${config.folders.libraries}/${label}/${jsItem.path}`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`/${config.folders.libraries}/${label}/${cssItem.path}`);
        }
      }
      const mathDisplay = JSON.parse(fs.readFileSync(`${config.folders.cache}/h5p-math-display.json`, 'utf-8'))['h5p-math-display'];
      const mathDisplayLabel = `${mathDisplay.id}-${mathDisplay.version.major}.${mathDisplay.version.minor}`;
      preloadedJs.push(`/${config.folders.libraries}/${mathDisplayLabel}/dist/h5p-math-display.js`);
      const libraryConfig = JSON.parse(logic.fromTemplate(fs.readFileSync(`${require.main.path}/${config.folders.assets}/libraryConfig.json`, 'utf-8'), {
        baseUrl,
        mathDisplayLabel
      }));
      const html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/templates/view.html`, 'utf-8');
      const info = JSON.parse(fs.readFileSync(`content/${folder}/h5p.json`, 'utf-8'));
      const id = cache.view[library][library].id;
      let mainLibrary = {};
      for (let item of info.preloadedDependencies) {
        if (item.machineName == id) {
          mainLibrary = item;
          break;
        }
      }
      const machineName = `${id} ${cache.view[library][library].version.major}.${cache.view[library][library].version.minor}`;
      const labels = await getLangLabels();
      const libraryDirectories = JSON.stringify(await getLibraryDirectories(id));
      let input = {
        assets: config.folders.assets,
        libraries: config.folders.libraries,
        title: info.title,
        baseUrl,
        library,
        folder,
        session: session.name,
        sessions: JSON.stringify(sessions),
        machineName,
        version: `${cache.view[library][library].version.major}.${cache.view[library][library].version.minor}`,
        contentVersion: `${mainLibrary.majorVersion}.${mainLibrary.minorVersion}`,
        id,
        fullscreen: cache.view[library][library].fullscreen,
        libraryDirectories,
        jsonContent: JSON.stringify(jsonContent),
        preloadedCss: JSON.stringify(preloadedCss),
        preloadedJs: JSON.stringify(preloadedJs),
        l10n: JSON.stringify(l10n),
        libraryConfig: JSON.stringify(libraryConfig),
        language: session.language,
        metadata,
        contentUserData: JSON.stringify(userData.resume),
        watcher: config.files.watch,
        simple: request.query.simple ? 'hidden' : ''
      }
      input = {...input, ...labels};
      response.set('Content-Type', 'text/html');
      response.end(logic.fromTemplate(html, input));
    }
    catch (error) {
      handleError(error, response);
    }
  }
}

/**
 * Validate file for upload by mime type and extension.
 * @param {string} uploadFieldType Upload field type.
 * @param {string} mimeType File's mime type.
 * @param {string} extension File's extension.
 * @returns {string} Error message or 'OK'.
 */
const validateFileForUpload = (uploadFieldType, mimeType, extension) => {
  let allowed;

  // Set allowed extensions per mime type depending on upload field type
  switch (uploadFieldType) {
    // Image upload field
    case 'image':
      allowed = {
        'image/png': ['png'],
        'image/jpeg': ['jpg', 'jpeg'],
        'image/gif': ['gif'],
      };
      break;

    // Audio upload field
    case 'audio':
      allowed = {
        'audio/mpeg': ['mp3'],
        'audio/mp3': ['mp3'],
        'audio/mp4': ['m4a'],
        'audio/x-wav': ['wav'],
        'audio/wav': ['wav'],
        'audio/ogg': ['ogg'],
      };
      break;

    // Video upload field
    case 'video':
      allowed = {
        'video/mp4': ['mp4'],
        'video/webm': ['webm'],
        'video/ogg': ['ogv'],
      };
      break;

    // File upload field
    case 'file':
      const allowedExtensions = config.files.patterns.allowed.toString()
        .replace(/[^a-zA-Z0-9|]/g, '')
        .split('|');

      mimeType = '*'; // Allow allowedExtensions for all mime types
      allowed = { mimeType : allowedExtensions };
      break;

    default:
      allowed = {};
  }

  const isExtensionAllowed = (allowed[mimeType] ?? []).includes(extension);

  const message = isExtensionAllowed ?
    'OK' :
    `Invalid ${uploadFieldType} file format.`;

  const extensionsToUse = isExtensionAllowed ?
    '' :
    listExtensions(Object.values(allowed).flat());

  return [message, extensionsToUse].filter(Boolean).join(' ');
}

/**
 * List extension options as human language string.
 * @param {string[]} extensions List of extensions.
 * @returns {string} Human language string.
 */
const listExtensions = (extensions = []) => {
  if (!Array.isArray(extensions) || !extensions.length) {
    return '';
  }
  else if (extensions.length === 1) {
    return `Use ${extensions[0]}.`;
  }
  else {
    return `Use ${extensions.slice(0, -1).join(', ')} or ${extensions.slice(-1)}.`;
  }
};

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
      process.stdout.write(`>> computing dependency list for ${library} ... `);
      cache.edit[library] = await logic.computeDependencies(library, 'edit', true);
      console.log(' done');
    }
  }
  const directories = {};
  const translations = {};
  const languages = [];
  let preloadedJs = [];
  let preloadedCss = [];
  for (let item in cache.edit[library]) {
    const entry = cache.edit[library][item];
    const label = `${entry.id}-${entry.version.major}.${entry.version.minor}`;
    const fullLabel = `${label}.${entry.version.patch}`;
    const languageFolder = `${config.folders.libraries}/${label}/language`;
    const langFile = `${languageFolder}/${session.language}.json`;
    if (fs.existsSync(langFile)) {
      translations[entry.id] = JSON.parse(fs.readFileSync(langFile, 'utf-8'));
    }
    if (!languages.length && fs.existsSync(languageFolder)) {
      const langFiles = fs.readdirSync(languageFolder);
      for (let item of langFiles) {
        const id = (item.replace(/^\./, "")).split('.')[0];
        languages.push(id);
      }
    }
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
    for (let jsItem of entry.preloadedJs) {
      preloadedJs.push(`${baseUrl}/${config.folders.libraries}/${label}/${jsItem.path}`);
    }
    for (let cssItem of entry.preloadedCss) {
      preloadedCss.push(`${baseUrl}/${config.folders.libraries}/${label}/${cssItem.path}`);
    }
    directories[label] = fullLabel;
  }
  return { library, preloadedJs, preloadedCss, languages, translations, directories };
}
const ajaxLibraries = async (options) => {
  const baseUrl = config.api;
  const registry = await logic.getRegistry();
  let libraries = [options.library];
  if (Array.isArray(options.libraries)) {
    libraries = [];
    for (let item of options.libraries) {
      item = item.split(' ')[0];
      libraries.push(registry.reversed[item].shortName);
    }
  }
  if (options.machineName) {
    libraries = [];
    libraries.push(registry.reversed[options.machineName].shortName);
  }
  const toDo = [];
  for (let item of libraries) {
    toDo.push(computePreloaded(item, baseUrl));
  }
  const preloaded = await Promise.all(toDo);
  let output;
  if (options.machineName) {
    const library = libraries[0];
    const version = cache.edit[library][library].version;
    const label = `${cache.edit[library][library].id}-${version.major}.${version.minor}`;
    output = {
      name: cache.edit[library][library].id,
      version,
      title: cache.edit[library][library].title,
      upgradesScript: `${baseUrl}/${config.folders.libraries}/${label}/upgrades.js`,
      semantics: JSON.parse(fs.readFileSync(`${config.folders.libraries}/${label}/semantics.json`, 'utf-8')),
      language: null,
      defaultLanguage: null,
      languages: preloaded[0].languages,
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
        metadataSettings: cache.edit[library][library].metadataSettings
      });
    }
  }
  return output;
}
const getLibraryDirectories = async (id) => {
  const output = (await ajaxLibraries({ machineName: id })).directories;
  for (let item in output) {
    output[item] = item;
  }
  return output;
}
const handleError = (error, response) => {
  console.log(error);
  response.set('Content-Type', 'application/json');
  response.end(JSON.stringify({ error: error.toString() }));
}
const verifySetup = async (library, response) => {
  const setupStatus = await logic.verifySetup(library);
  if (!setupStatus.ok) {
    session.status = `"${library}" is not properly set up. Please run "h5p setup ${library}" for setup.
For a setup status report run "h5p verify ${library}".`;
    response.redirect(`/dashboard`);
    return false;
  }
  else {
    return true;
  }
}
const manageSession = (folder, options, getSessions) => {
  for (let key in options) {
    if (typeof options[key] !== 'undefined') {
      session[key] = options[key];
    }
  }
  const sessionFolder = `content/${folder}/sessions`;
  const sessionFile = `${sessionFolder}/${session.name}.json`;
  if (folder && !fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder);
  }
  if (folder && session.name != 'null' && !fs.existsSync(sessionFile)) {
    fs.writeFileSync(sessionFile, JSON.stringify({
      resume: []
    }));
  }
  if (folder && getSessions) {
    const files = fs.readdirSync(sessionFolder);
    return files;
  }
  return [];
}
const getSession = (folder) => {
  const dataFile = `content/${folder}/sessions/${session.name}.json`;
  let userData = {};
  if (fs.existsSync(dataFile)) {
    userData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  }
  return userData;
}
const getLangLabels = async () => {
  let langFile = `${require.main.path}/${config.folders.assets}/languages/${session.language}.json`;
  if (!fs.existsSync(langFile)) {
    langFile = `${config.folders.assets}/languages/en.json`;
  }
  return await logic.getFile(langFile, true);
}
