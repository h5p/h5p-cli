An h5p toolkit for running and editing h5p content types.
CLI commands:
1. `npm install` to install the project's npm dependencies.
2. `node cli.js list` lists the current h5p libraries.
3. `node cli.js deps <h5p_repo_name> <mode> <saveToCache>` computes dependencies for an h5p library.
Use `run` or `edit` for `<mode>` to generate dependencies for those cases.  
Use `1` for `<saveToCache>` to save the result in the cache folder.
4. `node cli.js install <h5p_repo_name> <mode> <useCache>` installs the dependencies in the libraries folder.
`<mode>` is the same as above and `<useCache>` can be `1` if you want it to use the cached deps if you generated them beforehand using the `deps` cli command.
5. Below is an example for the setup CLI commands needed before running and editing content types in the `h5p-accordion` library.
```
node cli.js deps h5p-accordion run 1
node cli.js deps h5p-accordion edit 1
node cli.js install h5p-accordion run 1
node cli.js install h5p-accordion edit 1
```
6. `node server.js` starts the dev server.
7. To view a content type point your browser to  
`http://localhost:8080/content/<h5p-repo-name>/<folder>`  
`<h5p_repo_name>` is the library to be used when rendering the content type.  
The `<folder>` parameter points to a folder in the "content" directory which stores the content.json and all media files required to run a content type. You can use the content folder which comes in the zipped .h5p files that you normally get when clicking "reuse" on h5p.com content types.
8. To edit a content type point your browser to
`http://localhost:8080/editor/<h5p-repo-name>/<folder>`
