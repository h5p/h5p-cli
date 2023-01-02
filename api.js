const fs = require('fs');
const he = require('he');
const logic = require('./logic.js');
const config = require('./config.js');
const l10n = require('./assets/l10n.json');
const lib = config.folders.lib;
let cache = {
  run: {},
  edit: {}
};
module.exports = {
  saveFile: async (request, response, next) => {
    try {
      const form = JSON.parse(request.body.field);
      const targetFolder = `content/${request.params.folder}/${form.type}s`;
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
      }
      else { // delete unused file(s)
        const content = JSON.parse(fs.readFileSync(`content/${request.params.folder}/content.json`));
        const contentFiles = parseContentFiles([content]);
        const list = [];
        for (let item in contentFiles) {
          list.push(item.split('/')[1]);
        }
        const files = fs.readdirSync(targetFolder);
        for (let item of files) {
          if (!list.includes(item)) {
            fs.unlinkSync(`${targetFolder}/${item}`);
          }
        }
      }
      fs.renameSync(`${request.file.path}`, `${targetFolder}/${request.file.filename}`);
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify({
        mime: request.file.mimetype,
        path: `images/${request.file.filename}`
      }));
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  },
  saveContent: async (request, response, next) => {
    try {
      const input = JSON.parse(request.body.parameters);
      fs.writeFileSync(`content/${request.body.action}/content.json`, JSON.stringify(input.params));
      response.redirect(`/editor/${request.params.library}/${request.params.folder}`);
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  },
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
  editor: async (request, response, next) => {
    try {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
      const library = request.params.library;
      const folder = request.params.folder;
      const metadataSemantics = fs.readFileSync(`${config.folders.assets}/metadataSemantics.json`, 'utf-8');
      const copyrightSemantics = fs.readFileSync(`${config.folders.assets}/copyrightSemantics.json`, 'utf-8');
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
      response.set('Content-Type', 'text/html');
      response.end(
`<!DOCTYPE html>
<html>
  <head>
    <title>h5p-dev</title>
    <meta charset="utf-8">
    <script type="text/javascript">
      H5PIntegration = {
        ajax: { contentUserData: "/h5p-ajax/content-user-data/:contentId/:dataType/:subContentId" },
        ajaxPath: "/h5p-ajax/",
        baseUrl: "${baseUrl}",
        url: "${baseUrl}",
        siteUrl: "${baseUrl}",
        core: {
          scripts: [
            "/assets/h5p-php-library/js/jquery.js",
            "/assets/h5p-php-library/js/h5p.js",
            "/assets/h5p-php-library/js/h5p-event-dispatcher.js",
            "/assets/h5p-php-library/js/h5p-x-api-event.js",
            "/assets/h5p-php-library/js/h5p-x-api.js",
            "/assets/h5p-php-library/js/h5p-content-type.js",
            "/assets/h5p-php-library/js/h5p-confirmation-dialog.js",
            "/assets/h5p-php-library/js/h5p-action-bar.js",
            "/assets/h5p-php-library/js/h5p-display-options.js",
            "/assets/h5p-php-library/js/h5p-tooltip.js",
            "/assets/h5p-php-library/js/request-queue.js"
          ],
          styles: [
            "/assets/h5p-php-library/styles/h5p.css",
            "/assets/h5p-php-library/styles/h5p-confirmation-dialog.css",
            "/assets/h5p-php-library/styles/h5p-core-button.css",
            "/assets/h5p-php-library/styles/h5p-tooltip.css"
          ]
        },
        libraryConfig: [],
        libraryDirectories: {
          "FontAwesome-4.5": "FontAwesome-4.5",
          "H5PEditor.VerticalTabs-1.3": "H5PEditor.VerticalTabs-1.3"
        },
        hubIsEnabled: false,
        editor: {
          language: "en",
          ajaxPath: "${baseUrl}/editor/${library}/${folder}/",
          copyrightSemantics: ${copyrightSemantics},
          metadataSemantics: ${metadataSemantics},
          libraryUrl: "/assets/h5p-editor-php-library/",
          filesPath: "",
          wysiwygButtons: [],
          apiVersion: {
            majorVersion: 1,
            minorVersion: 25
          },
          nodeVersionId: "${folder}",
          assets: {
            css: [
              "/assets/h5p-php-library/styles/h5p.css",
              "/assets/h5p-php-library/styles/h5p-confirmation-dialog.css",
              "/assets/h5p-php-library/styles/h5p-core-button.css",
              "/assets/h5p-php-library/styles/h5p-tooltip.css",
              "/assets/h5p-editor-php-library/libs/darkroom.css",
              "/assets/h5p-editor-php-library/styles/css/h5p-hub-client.css",
              "/assets/h5p-editor-php-library/styles/css/fonts.css",
              "/assets/h5p-editor-php-library/styles/css/application.css",
              "/assets/h5p-editor-php-library/styles/css/libs/zebra_datepicker.min.css",
              ${preloadedCss.join(',\n')}
            ],
            js: [
              "/assets/h5p-php-library/js/jquery.js",
              "/assets/h5p-php-library/js/h5p.js",
              "/assets/h5p-php-library/js/h5p-event-dispatcher.js",
              "/assets/h5p-php-library/js/h5p-x-api-event.js",
              "/assets/h5p-php-library/js/h5p-x-api.js",
              "/assets/h5p-php-library/js/h5p-content-type.js",
              "/assets/h5p-php-library/js/h5p-confirmation-dialog.js",
              "/assets/h5p-php-library/js/h5p-action-bar.js",
              "/assets/h5p-php-library/js/h5p-display-options.js",
              "/assets/h5p-php-library/js/h5p-tooltip.js",
              "/assets/h5p-php-library/js/request-queue.js",
              "/assets/h5p-editor-php-library/scripts/h5p-hub-client.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-semantic-structure.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-library-selector.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-form.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-text.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-html.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-number.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-textarea.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-file-uploader.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-file.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-image.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-image-popup.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-av.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-group.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-boolean.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-list.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-list-editor.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-library.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-library-list-cache.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-select.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-selector-hub.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-selector-legacy.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-dimensions.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-coordinates.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-none.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-metadata.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-metadata-author-widget.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-metadata-changelog-widget.js",
              "/assets/h5p-editor-php-library/scripts/h5peditor-pre-save.js",
              "/assets/h5p-editor-php-library/ckeditor/ckeditor.js",
              ${preloadedJs.join(',\n')}
            ]
          }
        },
        user: { name: "developer", mail: "some.developer@some.company.com" }
      };
      H5PIntegration.l10n = ${JSON.stringify(l10n)};
    </script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/jquery.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-event-dispatcher.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-x-api-event.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-x-api.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-content-type.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-confirmation-dialog.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-action-bar.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-display-options.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-tooltip.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/request-queue.js"></script>
    <script type="text/javascript" src="/assets/h5p-editor-php-library/scripts/h5peditor-editor.js"></script>
    <script type="text/javascript" src="/assets/h5p-editor-php-library/scripts/h5peditor-init.js"></script>
    <script type="text/javascript" src="/assets/h5p-editor-php-library/language/en.js"></script>
    <script type="text/javascript">
      window.addEventListener('load', (event) => {
        console.log('> page loaded');
        const $ = H5P.jQuery;
        var $form = $('#h5p-content-form');
        var $type = $('input[name="action"]');
        var $upload = $('.h5p-upload').hide();
        var $create = $('.h5p-create').hide();
        var $editor = $('.h5p-editor');
        var $library = $('input[name="library"]');
        var $params = $('input[name="parameters"]');
        var $title = $('input[name="action"]');
        console.log('> initializing...');
        H5PEditor.init($form, $type, $upload, $create, $editor, $library, $params, null, $title);
      });
    </script>
  </head>
  <body>
    <form method="post" action="" enctype="multipart/form-data" id="h5p-content-form">
      <input type="hidden" name="library" id="h5p-library" value="${cache.edit[library][library].id} ${cache.edit[library][library].version.major}.${cache.edit[library][library].version.minor}">
      <input type="hidden" name="parameters" id="h5p-parameters" value="${he.encode(JSON.stringify(formParams))}">
      <input type="radio" name="action" value="create" style="display: none" checked="checked"/>
      <div class="h5p-create"><div class="h5p-editor">...</div></div>
      <input type="submit" value="save">
    </form>
  </body>
</html>`);
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  },
  content: async (request, response, next) => {
    try {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
      const library = request.params.library;
      const folder = request.params.folder;
      const cacheFile = `${config.folders.cache}/${library}.json`;
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
      response.set('Content-Type', 'text/html');
      response.end(
`<!DOCTYPE html>
<html>
  <head>
    <title>h5p-dev</title>
    <meta charset="utf-8">
    <script type="text/javascript">
      H5PIntegration = {
        ajax: { contentUserData: "/h5p-ajax/content-user-data/:contentId/:dataType/:subContentId" },
        ajaxPath: "/h5p-ajax/",
        baseUrl: "/",
        url: "${baseUrl}",
        siteUrl: "${baseUrl}",
        contents: {
          "cid-${folder}": {
            library: "${cache.run[library][library].id} ${cache.run[library][library].version.major}.${cache.run[library][library].version.minor}",
            jsonContent: ${JSON.stringify(jsonContent)},
            url: "${baseUrl}",
            mainId: "${folder}",
            displayOptions: {
              "copy": false,
              "copyright": false,
              "embed": true,
              "export": true,
              "frame": true,
              "icon": true
            },
            contentUserData: [{state: "{}"}],
            resizeCode: "",
            title: "${folder}",
            styles: ${JSON.stringify(preloadedCss)},
            scripts: ${JSON.stringify(preloadedJs)}
          }
        },
        core: {
          scripts: [
            "/assets/h5p-php-library/js/jquery.js",
            "/assets/h5p-php-library/js/h5p.js",
            "/assets/h5p-php-library/js/h5p-event-dispatcher.js",
            "/assets/h5p-php-library/js/h5p-x-api-event.js",
            "/assets/h5p-php-library/js/h5p-x-api.js",
            "/assets/h5p-php-library/js/h5p-content-type.js",
            "/assets/h5p-php-library/js/h5p-confirmation-dialog.js",
            "/assets/h5p-php-library/js/h5p-action-bar.js",
            "/assets/h5p-php-library/js/h5p-display-options.js",
            "/assets/h5p-php-library/js/h5p-tooltip.js",
            "/assets/h5p-php-library/js/request-queue.js"
          ],
          styles: [
            "/assets/h5p-php-library/styles/h5p.css",
            "/assets/h5p-php-library/styles/h5p-confirmation-dialog.css",
            "/assets/h5p-php-library/styles/h5p-tooltip.css"
          ]
        },
        user: { name: "developer", mail: "some.developer@some.company.com" }
      };
      H5PIntegration.l10n = ${JSON.stringify(l10n)};
    </script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/jquery.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-event-dispatcher.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-x-api-event.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-x-api.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-content-type.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-confirmation-dialog.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-action-bar.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-display-options.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/h5p-tooltip.js"></script>
    <script type="text/javascript" src="/assets/h5p-php-library/js/request-queue.js"></script>
  </head>
  <body>
    <iframe id="h5p-iframe-${folder}" class="h5p-iframe" data-content-id="${folder}" style="width: 100%;" src="about:blank" frameBorder="0" scrolling="no"></iframe>
  </body>
</html>`);
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  }
}
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
const computePreloaded = (library, baseUrl) => {
  return new Promise(async (resolve, reject) => {
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
      resolve({ library, preloadedJs,  preloadedCss, translations, directories});
    }
    catch (error) {
      reject(error);
    }
  });
}
