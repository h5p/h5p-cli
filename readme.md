An h5p toolkit for running, editing and developing h5p content types.  
Make sure you have git, NodeJS and npm installed.  
NodeJS version 17 is currently recommended due to newer versions having compatibility issues with the `node-sass` npm package which is required by some h5p libraries.  

QUICK START GUIDE

0. Install this tool as a global app by running `npm install -g h5p`. To uninstall it run `npm uninstall -g h5p`.  
If that doesn't work try running `npm install -g ./h5p-cli` from the folder where you cloned this repository. To uninstall it run `npm uninstall -g h5p-cli`.  
1. `npm install` to install the project's npm dependencies (if you cloned this repository).  
2. `h5p core` installs the core h5p libraries.  
3. `h5p list` lists and caches the currently published h5p libraries in the local library registry (`cache/libraryRegistry.json`).  
4. `h5p setup <library>` computes and clones an h5p `<library>` and its dependencies.  
This is required for running and editing content types based on that `<library>`.  
5. `h5p server` starts the dev server.  
Once the dev server is started you can use your browser to view, edit, delete, import, export and create new content types. To view the dashboard point your browser to  
http://localhost:8080/dashboard  
6. To use your own library run `h5p use <library> <folder>`.  
This computes dependencies for a `<library>` using the provided `<folder>` as the main library.  
An example for this would be `h5p use h5p-my-library H5P.MyLibrary-1.01`. This assumes that the `libraries/H5P.MyLibrary-1.01` folder exists and is a valid H5P library.  
You can also use this command to switch between different versions of the same library.  
7. To create a new library the local registry needs to be made aware of its existence by running `h5p register <entry.json>`.  
The `<entry.json>` file needs to be created. Below is an example.  
You can also use this command to update existing registry entries.  
<details>
<summary>"entry.json" example</summary>

  ```
  {
    "H5P.Accordion": {
      "id": "H5P.Accordion", // library machine name
      "title": "Accordion",
      "repo": { // optional; required for clone, install and deps commands;
        "type": "github",
        "url": "https://github.com/h5p/h5p-accordion"
      },
      "author": "Batman",
      "runnable": true, // specify true if this is a main library from which you can create content types; false if it's a dependency for another;
      "repoName": "h5p-accordion", // library name
      "org": "h5p" // optional organization under which the library is published
    }
  }
  ```

</details>

<details>
<summary>Detailed CLI commands & instructions</summary>

1. `npm install` to install the project's npm dependencies.  
2. `h5p core` installs the core h5p libraries.  
These are required to view and edit h5p content types.  
3. `h5p list` lists the current h5p libraries.  
4. `h5p register <entry.json>` updates the local registry file.  
5. `h5p deps <library> <mode> [saveToCache] [version] [folder]` computes dependencies for an h5p library.  
Use `view` or `edit` for `<mode>` to generate dependencies for those cases.  
Specify `1` for `<saveToCache>` to save the result in the cache folder.  
Specify a `[version]` to compute deps for that version.  
Specify a `[folder]` to compute deps based on the library from `libraries/[folder]` folder.  
6. `h5p use <library> <folder>` computes view & edit dependencies for a `<library>` using the provided `libraries/<folder>` as the main library.  
7. `h5p tags <org> <library>` lists current library versions.  
8. `h5p clone <library> <mode> <useCache>` clones the library and its dependencies in the libraries folder.  
`<mode>` is the same as above and `<useCache>` can be `1` if you want it to use the cached deps.  
9. `h5p install <library> <mode> <useCache>` installs the library and its dependencies in the libraries folder.  
`<mode>` is the same as above and `<useCache>` can be `1` if you want it to use the cached deps.  
10. Below is an example for the setup CLI commands needed before viewing and editing content types in the `h5p-accordion` library.  
The first 2 commands compute dependencies for view & edit modes and saves them in the cache folder.  
The last 2 commands install the dependencies for those modes using the cached dependency lists.  
Running `h5p setup h5p-accordion` is the equivalent for all 4 commands.  
```
h5p deps h5p-accordion view 1
h5p deps h5p-accordion edit 1
h5p install h5p-accordion view 1
h5p install h5p-accordion edit 1
```
11. `h5p setup <library> [version] [download]` computes & clones/installs view and edit `<library>` dependencies.  
You can optionally specify a specific library `[version]`.  
Using `1` for the `[download]` parameter will download the libraries instead of cloning them as git repos.  
12. To check the status of the setup for a given library you can run `h5p verify <h5p-repo-name>`.  
Running `h5p verify h5p-accordion` should return something like below if the library was properly set up.  
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
13. `h5p server` starts the dev server.  
Once the dev server is started you can use your browser to view, edit, delete, import, export and create new content types. To view the dashboard point your browser to  
http://localhost:8080/dashboard  
14. `h5p export <library> <folder>` will export the `<library>` content type from the "content/`<folder>`" folder.  
Make sure that the library's dependency lists are cached and that the dependencies are installed.  
Once finished, the export command outputs the location of the resulting file.  
15. When viewing content types you can create and switch between resume sessions. A resume session allows you to save the state of the content type that supports it so that it will be the same on reload.  
You can create a new session by clicking on the "new session" button and entering a new name for it.  
To switch between existing sessions simply choose the one you want from the dropdown. Choose the "null" session to not save states.  
16. To stop auto reloading the view page on library file changes set `files.watch` to `false` in `config.json`.  
17. Run `h5p utils help` to get a list of utility commands.  
Each utility command can then be run via `h5p utils <cmd> [<args>...]`.  
You can also install the utils cli globally by running `npm install -g ./h5p-cli` from the folder where you cloned this repository. You can then run utils commands via `h5p-cli <cmd> [<args>...]`.  
18. Git related utility commands may require you to add your public ssh key to the ssh agent after starting it.  
Here are some guides on how to add an ssh key to the ssh agent on [Linux](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent#adding-your-ssh-key-to-the-ssh-agent), [Mac](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#adding-your-ssh-key-to-the-ssh-agent), [Windows](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=windows#adding-your-ssh-key-to-the-ssh-agent).  

</details>
