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
        cache.deps = await logic.computeDependencies(request.params.library, true);
      }
      const jsonContent = fs.readFileSync(`./content/${request.params.folder}/content.json`, {encoding: 'utf8', flag: 'r'});
      let preloadedJs = [];
      let preloadedCss = [];
      for (let item in cache.deps) {
        for (let jsItem of cache.deps[item].preloadedJs)
          preloadedJs.push(`../../${lib}/${cache.deps[item].id}/${jsItem.path}`);
        for (let cssItem of cache.deps[item].preloadedCss)
          preloadedCss.push(`../../${lib}/${cache.deps[item].id}/${cssItem.path}`);
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
        contents: {
          "cid-${request.params.folder}": {
            library: "${cache.deps[request.params.library]?.id} 1.16.4",
            jsonContent: ${JSON.stringify(jsonContent)},
            url: "${request.protocol}://${request.get('host')}",
            mainId: "${request.params.folder}",
            contentUserData: [{state: false}],
            disable: 6,
            resizeCode: "",
            title: "${request.params.folder}",
            scripts: ${JSON.stringify(preloadedJs)},
            styles: ${JSON.stringify(preloadedCss)}
          }
        },
        core: {
          scripts: ["/assets/h5p-core/library/js/jquery.js?nw7byb", "/assets/h5p-core/library/js/h5p.js?nw7byb", "/assets/h5p-core/library/js/h5p-event-dispatcher.js?nw7byb", "/assets/h5p-core/library/js/h5p-x-api-event.js?nw7byb", "/assets/h5p-core/library/js/h5p-x-api.js?nw7byb", "/assets/h5p-core/library/js/h5p-content-type.js?nw7byb"],
          styles: ["/assets/h5p-core/library/styles/h5p.css?nw7byb"]
        },
        postUserStatistics: false,
        saveFreq: false,
        user: { name: "developer", mail: "some.developer@some.company.com" },
        "l10n": {
          "H5P":{"fullscreen":"Fullscreen","disableFullscreen":"Disable fullscreen","download":"Download","copyrights":"Rights of use","embed":"Embed","size":"Size","showAdvanced":"Show advanced","hideAdvanced":"Hide advanced","advancedHelp":"Include this script on your website if you want dynamic sizing of the embedded content:","copyrightInformation":"Rights of use","close":"Close","title":"Title","author":"Author","year":"Year","source":"Source","license":"License","thumbnail":"Thumbnail","noCopyrights":"No copyright information available for this content.","downloadDescription":"Download this content as a H5P file.","copyrightsDescription":"View copyright information for this content.","embedDescription":"View the embed code for this content.","h5pDescription":"Visit H5P.org to check out more cool content.","contentChanged":"This content has changed since you last used it.","startingOver":"You'll be starting over.","by":"by","showMore":"Show more","showLess":"Show less","subLevel":"Sublevel"}
        }
      };
    </script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/jquery.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p-event-dispatcher.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p-x-api-event.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p-x-api.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/library/js/h5p-content-type.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/editor/scripts/h5peditor-editor.js"></script>
    <script type="text/javascript" src="/assets/h5p-core/editor/language/en.js"></script>
  </head>
  <body>
    <iframe id="h5p-iframe-${request.params.folder}" class="h5p-iframe" data-content-id="${request.params.folder}" style="width: 100%;" src="about:blank" frameBorder="0" scrolling="no"></iframe>
  </body>
</html>`);
    }
    catch (error) {
      console.log(error);
      response.end(error.toString());
    }
  }
}
