An h5p toolkit for running, editing and developing h5p content types.  
Make sure you have git, NodeJS and npm installed.  
NodeJS version 17 is currently recommended due to newer versions having compatibility issues with the `node-sass` npm package which is required by some h5p libraries.  

### QUICK START GUIDE

0. Uninstall any previous h5p-cli toolkit instance by running  
```
npm uninstall -g h5p-cli
npm uninstall -g h5p
```  
1. `npm install` to install the project's npm dependencies (if you cloned this repository).  
2. Install this tool as a global app by running `npm install -g h5p`. To uninstall it you can run `npm uninstall -g h5p`.  
If that doesn't work or if you cloned this repository then rename the project folder to `h5p-cli` and run `npm install -g ./h5p-cli` from its parent folder (where you cloned this repository). To uninstall it you can run `npm uninstall -g h5p-cli`.  
You can skip the global app installation and run all commands in the `node cli.js <cmd> <args...>` format within this folder. Otherwise, all `h5p` commands run relative to the current working directory.  
This means that if you setup a library it will only be available in the location where you've set it up.  
The same goes for `h5p server`. The dashboard will only display content types found in the `<current_directory>/content` folder.  
Remember to keep track of your development folders. :)  
3. `h5p core` installs the core h5p libraries.  
4. `h5p list` lists and caches the currently published h5p libraries in the local library registry (`cache/libraryRegistry.json`).  
5. `h5p setup <library|repoUrl>` computes and clones an h5p library and its dependencies.  
This is required for running and editing content types based on that library.  
`<library>` must be one of the libraries in `h5p list`.  
For example, `h5p setup h5p-accordion` installs the "h5p-accordion" library and its dependencies.  
`<repoUrl>` is a github repository url. Running the command in this format will also update the library in the local registry. This is useful for unregistered libraries.  
For example, `h5p setup https://github.com/h5p/h5p-accordion` installs the "h5p-accordion" library and its dependencies. It also updates its entry in the local library registry.  
6. `h5p server` starts the dev server.  
Once the dev server is started you can use your browser to view, edit, delete, import, export and create new content types. To view the dashboard point your browser to  
http://localhost:8080/dashboard  
7. `h5p help` lists available commands.  
`h5p help <command>` prints help entry for that `<command>`.  
8. To use your own local library run `h5p use <library> <folder>`.  
This computes dependencies for a `<library>` using the provided `<folder>` as the main library.  
`<library>` is something like `h5p-accordion`.  
`<folder>` is something like `H5P.GreetingCard-1.0`. The format for it is `<h5pMachineName>-<majorVersion>.<minorVersion>`.  
An example for this is `h5p use h5p-greeting-card H5P.GreetingCard-1.0`.  
It will compute and cache dependencies for the `h5p-greeting-card` library located in the `libraries/H5P.GreetingCard-1.0` directory.  
Its dependencies also need to be present in the `libraries` folder (otherwise they need to be installed by running the appropriate `h5p use <dependency> <depFolder>` command).  
Please note that, should the dependencies change (including the optional ones in semantics.json), you will have to run this command again in order to regenerate the cached dependency lists.  
You can also use this command to switch between different versions of the same library.  
A library development tutorial can be found [here](https://h5p.org/library-development).  

### Handling unregistered libraries

Running `h5p setup <library>` may return the `unregistered library` error. This means that the local library registry is missing this library. We have to find its repository url and register it.  
As an example, run `h5p register git@github.com:otacke/h5p-game-map.git` to register the `h5p-game-map` library in the local registry.  
Run `h5p missing h5p-game-map` to list the unregistered dependencies for `h5p-game-map`. Then find their repository urls and register them.  
```
h5p register git@github.com:otacke/h5p-editor-game-map.git
h5p register git@github.com:otacke/h5p-combination-lock.git
h5p register git@github.com:otacke/h5p-tabs.git
h5p register git@github.com:otacke/h5p-transcript.git
```
Run `h5p missing h5p-game-map` again to list any unregistered dependencies for the newly registered ones. And register them.  
```
h5p register git@github.com:otacke/h5p-editor-tabs.git
h5p register git@github.com:otacke/h5p-transcript-library.git
```
Run `h5p missing h5p-game-map` again to make sure there are no other unregistered dependencies.  
Finally, run `h5p setup h5p-game-map` to install the library and its dependencies.  

If you have to setup libraries from private repositories or if you encounter the `Permission denied (publickey)` error make sure you add your public ssh key to your local ssh agent.  
It's as easy as running the two commands below.  
```
eval `ssh-agent -t 8h`
ssh-add
```
All git related commands should now work in the current session for at leat 8h. Feel free to change the duration to better suit your needs. :)  
More info on this [here](commands.md#git-ssh-agent-setup).

### Detailed CLI commands & instructions

[commands.md](commands.md)
