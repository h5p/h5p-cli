const fs = require('fs');
const logic = require('./logic.js');
const config = require('./config.js');
const lib = config.folders.lib;
let cache = {
  deps: {}
};
module.exports = {
  content: async (request, response, next) => {
    try {
      if (!cache?.deps[request.params.library]) {
        cache.deps[request.params.library] = await logic.computeDependencies(request.params.library);
      }
      const jsonContent = fs.readFileSync(`./content/${request.params.library}/${request.params.folder}/content.json`, {encoding: 'utf8', flag: 'r'});
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in cache.deps[request.params.library]) {
        for (let jsItem of cache.deps[request.params.library][item].preloadedJs)
          preloadedJs.push(`../../${lib}/${cache.deps[request.params.library][item].id}/${jsItem.path}`);
        for (let cssItem of cache.deps[request.params.library][item].preloadedCss)
          preloadedCss.push(`../../${lib}/${cache.deps[request.params.library][item].id}/${cssItem.path}`);
      }
      response.set('Content-Type', 'text/html');
      response.end(
`<!DOCTYPE html>
<html>
  <head>
    <title>h5p-dev</title>
    <meta charset="utf-8">
    <script type="text/javascript" src="/assets/h5p-core/library/js/jquery.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p-event-dispatcher.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p-x-api-event.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p-x-api.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p-content-type.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/editor/scripts/h5peditor-editor.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/editor/language/en.js"></script>
    <script type="text/javascript">
      H5PIntegration = {
        ajax: { contentUserData: "/h5p-ajax/content-user-data/:contentId/:dataType/:subContentId" },
        ajaxPath: "/h5p-ajax/",
        baseUrl: "${request.protocol}://${request.get('host')}",
        contents: {
          "cid-1": {
            library: "${cache.deps[request.params.library][request.params.library]?.id} 1.16.4",
            jsonContent: ${JSON.stringify(jsonContent)},
            mainId: "1",
            contentUserData: [{state: false}],
            disable: 6,
            resizeCode: "",
            title: "${request.params.folder}",
            scripts: ${JSON.stringify(preloadedJs)},
            styles: ${JSON.stringify(preloadedCss)},
            url: "${request.protocol}://${request.get('host')}"
          }
        },
        core: {
          scripts: ["/assets/h5p-core/library/js/jquery.js?nw7byb", "/assets/h5p-core/library/js/h5p.js?nw7byb", "/assets/h5p-core/library/js/h5p-event-dispatcher.js?nw7byb", "/assets/h5p-core/library/js/h5p-x-api-event.js?nw7byb", "/assets/h5p-core/library/js/h5p-x-api.js?nw7byb", "/assets/h5p-core/library/js/h5p-content-type.js?nw7byb"],
          styles: ["/assets/h5p-core/library/styles/h5p.css?nw7byb"]
        },
        postUserStatistics: false,
        saveFreq: false,
        url: "${request.protocol}://${request.get('host')}/content/${request.params.library}/${request.params.folder}",
        user: { name: "developer", mail: "some.developer@some.company.com" }
      };
    </script>
  </head>
  <body>
    <iframe id="h5p-iframe-1" class="h5p-iframe" data-content-id="1" style="width: 100%;" src="about:blank" frameBorder="0" scrolling="no"></iframe>
  </body>
</html>`);
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  }
}
