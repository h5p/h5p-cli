const fs = require('fs');
const he = require('he');
const logic = require('./logic.js');
const config = require('./config.js');
const l10n = require('./assets/l10n.json');
const lib = config.folders.lib;
let cache = {
  deps: {}
};
module.exports = {
  libraries: async (request, response, next) => {
    try {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
      const library = request.params.library;
      const folder = request.params.folder;
      const cacheFile = `${config.folders.cache}/${library}_edit.json`;
      if (!cache?.deps[library])
        if (fs.existsSync(cacheFile)) cache.deps[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        else cache.deps[library] = await logic.computeDependencies(library, 'edit', true);
      const jsonContent = fs.readFileSync(`./content/${folder}/content.json`, 'utf8');
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in cache.deps[library]) {
        const entry = cache.deps[library][item]
        for (let jsItem of entry.preloadedJs) {
          preloadedJs.push(`"../../../${lib}/${entry.id}-${entry.version.major}.${entry.version.minor}/${jsItem.path}"`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`"../../../${lib}/${entry.id}-${entry.version.major}.${entry.version.minor}/${cssItem.path}"`);
        }
      }
      response.set('Content-Type', 'application/json');
      response.end(JSON.stringify(1));
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  },
  editor: async (request, response, next) => {
    try {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
console.log(baseUrl);
      const library = request.params.library;
      const folder = request.params.folder;
      const cacheFile = `${config.folders.cache}/${library}_edit.json`;
      if (!cache?.deps[library])
        if (fs.existsSync(cacheFile)) cache.deps[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        else cache.deps[library] = await logic.computeDependencies(library, 'edit', true);
console.log(folder);
      const jsonContent = fs.readFileSync(`./content/${folder}/content.json`, 'utf8');
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in cache.deps[library]) {
        const entry = cache.deps[library][item]
        for (let jsItem of entry.preloadedJs) {
          preloadedJs.push(`"../../../${lib}/${entry.id}-${entry.version.major}.${entry.version.minor}/${jsItem.path}"`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`"../../../${lib}/${entry.id}-${entry.version.major}.${entry.version.minor}/${cssItem.path}"`);
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
        editor: {
          language: "en",
          ajaxPath: "${baseUrl}/ajax/${library}/${folder}",
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
        const $ = H5P.jQuery;
        var $form = $('#h5p-content-form');
        var $type = $('input[name="action"]');
        var $upload = $('.h5p-upload').hide();
        var $create = $('.h5p-create').hide();
        var $editor = $('.h5p-editor');
        var $library = $('input[name="library"]');
        var $params = $('input[name="parameters"]');
        H5PEditor.init($form, $type, $upload, $create, $editor, $library, $params);
        console.log('ready :)');
      });
    </script>
  </head>
  <body>
    <form method="post" action="" enctype="multipart/form-data" id="h5p-content-form">
      <input type="hidden" name="library" id="h5p-library" value="${cache.deps[library][library].id} ${cache.deps[library][library].version.major}.${cache.deps[library][library].version.minor}">
      <input type="hidden" name="parameters" id="h5p-parameters" value=${he.encode(jsonContent)}>
      <input type="radio" name="action" value="upload"/>
      <input type="radio" name="action" value="create" checked="checked"/>
      <div class="h5p-create"><div class="h5p-editor">... loading</div></div>
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
      if (!cache?.deps[library])
        if (fs.existsSync(cacheFile)) cache.deps[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        else cache.deps[library] = await logic.computeDependencies(library, 'run', true);
      const jsonContent = fs.readFileSync(`./content/${folder}/content.json`, 'utf8');
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in cache.deps[library]) {
        const entry = cache.deps[library][item]
        for (let jsItem of entry.preloadedJs) {
          preloadedJs.push(`../../../${lib}/${entry.id}-${entry.version.major}.${entry.version.minor}/${jsItem.path}`);
        }
        for (let cssItem of entry.preloadedCss) {
          preloadedCss.push(`../../../${lib}/${entry.id}-${entry.version.major}.${entry.version.minor}/${cssItem.path}`);
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
            library: "${cache.deps[library][library].id} ${cache.deps[library][library].version.major}.${cache.deps[library][library].version.minor}",
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
