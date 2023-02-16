An h5p toolkit for running and editing h5p content types.  
Make sure you have NodeJS and npm installed.  
CLI commands & instructions:  
1. `npm install` to install the project's npm dependencies.  
2. `node cli.js core` installs the core h5p libraries.  
These are required to view/edit h5p content types.  
3. `node cli.js list` lists the current h5p libraries.  
4. `node cli.js deps <h5p_repo_name> <mode> <saveToCache>` computes dependencies for an h5p library.  
Use `view` or `edit` for `<mode>` to generate dependencies for those cases.  
Use `1` for `<saveToCache>` to save the result in the cache folder.  
5. `node cli.js install <h5p_repo_name> <mode> <useCache>` installs the dependencies in the libraries folder.  
`<mode>` is the same as above and `<useCache>` can be `1` if you want it to use the cached deps.  
6. Below is an example for the setup CLI commands needed before viewing and editing content types in the `h5p-accordion` library.  
The first 2 commands compute dependencies for view & edit modes and saves them in the cache folder.  
The second 2 commands install the dependencies for those modes using the cached dependency lists.  
Running `node cli.js setup h5p-accordion` is the equivalent for all 4 commands.  
```
node cli.js deps h5p-accordion view 1
node cli.js deps h5p-accordion edit 1
node cli.js install h5p-accordion view 1
node cli.js install h5p-accordion edit 1
```
7. To check the status of the setup for a given library you can run `node cli.js verify <h5p-repo-name>`.  
Running `node cli.js verify h5p-accordion` should return something like below if the library was properly setup.  
```
{
  registry: true, // library found in registry
  lists: { view: true, edit: true }, // dependency lists are cached
  libraries: { // shows which dependencies are installed
    'FontAwesome-4.5': true,
    'H5P.AdvancedText-1.1': true,
    'H5P.Accordion-1.0': true
  },
  ok: true // overall setup status
}

```
8. `node server.js` starts the dev server.  
9. Once the dev server is started you can use your browser to view, edit, delete, import, export and create new content types. To view the dashboard point your browser to  
http://localhost:8080/dashboard  
10. `node cli.js export <h5p_repo_name> <folder>` will export the `<h5p_repo_name>` library content type from the "content/`<folder>`" folder.  
Make sure that the library's dependency lists are cached and that the dependencies are installed.  
11. When viewing content types you can create and switch between resume sessions. A resume session allows you to resume where you left off in the content types that support it.  
To create a new session simply rename the current session and click outside the session name textbox.  
12. To stop auto reloading the view page on library file changes set `files.watch` to `false` in `config.json`.  
13. Run `node cli.js utils help` to get a list of utility commands.  
Each utility command can then be run via `node cli.js utils <cmd> [<args>...]`.  
You can also install the utils cli globally by running `npm install -g ./h5p-cli` from the folder where you cloned this repository. You can then run utils commands via `h5p-cli <cmd> [<args>...]`.  
14. Git related utility commands require you to add your public ssh key to the ssh agent after starting it.  
Here are some guides on how to add an ssh key to the ssh agent on [Linux](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent#adding-your-ssh-key-to-the-ssh-agent), [Mac](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#adding-your-ssh-key-to-the-ssh-agent), [Windows](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=windows#adding-your-ssh-key-to-the-ssh-agent).  
