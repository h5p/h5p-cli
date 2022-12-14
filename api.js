const fs = require('fs');
const logic = require('./logic.js');
const config = require('./config.js');
const l10n = require('./assets/l10n.json');
const lib = config.folders.lib;
let cache = {
  deps: {}
};
module.exports = {
  content: async (request, response, next) => {
    try {
      const library = request.params.library;
      const folder = request.params.folder;
      const cacheFile = `${config.folders.cache}/${library}.json`;
      if (!cache?.deps[library])
        if (fs.existsSync(cacheFile)) cache.deps[library] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        else cache.deps[library] = await logic.computeDependencies(library, true);
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
        url: "${request.protocol}://${request.get('host')}",
        siteUrl: "${request.protocol}://${request.get('host')}",
        contents: {
          "cid-${folder}": {
            library: "${cache.deps[library][library]?.id} 1.0.0",
            jsonContent: ${JSON.stringify(jsonContent)},
            url: "${request.protocol}://${request.get('host')}",
            mainId: "${folder}",
            displayOptions: {
              "anonymous": 1,
              "confusion": 1,
              "copy": true,
              "copyright": false,
              "embed": 0,
              "export": true,
              "frame": true,
              "icon": true
            },
            contentUserData: [{state: false}],
            disable: 6,
            resizeCode: "",
            title: "${folder}",
            styles: ${JSON.stringify(preloadedCss)},
            scripts: ${JSON.stringify(preloadedJs)}
          }
        },
        core: {
          scripts: [
            "/assets/js/jquery.js",
            "/assets/js/h5p.js",
            "/assets/js/h5p-event-dispatcher.js",
            "/assets/js/h5p-x-api-event.js",
            "/assets/js/h5p-x-api.js",
            "/assets/js/h5p-content-type.js",
            "/assets/js/h5p-confirmation-dialog.js",
            "/assets/js/h5p-action-bar.js",
            "/assets/js/h5p-display-options.js",
            "/assets/js/h5p-tooltip.js",
            "/assets/js/request-queue.js"
          ],
          styles: [
            "/assets/styles/h5p.css",
            "/assets/styles/h5p-confirmation-dialog.css",
            "/assets/styles/h5p-tooltip.css"
          ]
        },
        postUserStatistics: false,
        saveFreq: false,
        user: { name: "developer", mail: "some.developer@some.company.com" }
      };
      H5PIntegration.l10n = ${JSON.stringify(l10n)};
    </script>
    <script type="text/javascript" src="/assets/js/jquery.js"></script>
    <script type="text/javascript" src="/assets/js/h5p.js"></script>
    <script type="text/javascript" src="/assets/js/h5p-event-dispatcher.js"></script>
    <script type="text/javascript" src="/assets/js/h5p-x-api-event.js"></script>
    <script type="text/javascript" src="/assets/js/h5p-x-api.js"></script>
    <script type="text/javascript" src="/assets/js/h5p-content-type.js"></script>
    <script type="text/javascript" src="/assets/js/h5p-confirmation-dialog.js"></script>
    <script type="text/javascript" src="/assets/js/h5p-action-bar.js"></script>
    <script type="text/javascript" src="/assets/js/h5p-display-options.js"></script>
    <script type="text/javascript" src="/assets/js/h5p-tooltip.js"></script>
    <script type="text/javascript" src="/assets/js/request-queue.js"></script>
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
