• `h5p core` installs the core h5p libraries.  
These are required to view and edit h5p content types.  

• `h5p list [machineName] [ignoreCache]` lists the current h5p libraries.  
Use `1` for `[machineName]` to list the machine name instead of the default repo name.  
Use `1` for `[ignoreCache]` to recreate the local registry.  
The output format is `<library> (<org>)`.  

• `h5p tags <org> <library> <mainBranch>` lists current library versions.  
The `<org>` for a library is mentioned in the `list` command output.  
`<mainBranch>` is the main branch of repository. Default is `master`.  

• `h5p deps <library> <mode> [saveToCache] [version] [folder] [showMissing] [verbose]` computes dependencies for an h5p library.  
Use `view` or `edit` for `<mode>` to generate dependencies for those cases.  
Specify `1` for `[saveToCache]` to save the result in the cache folder. Default is `0`.  
Specify a `[version]` to compute deps for that version. Default is `master`.  
Specify a `[folder]` to compute deps based on the library from `libraries/[folder]` folder. Default is `""`.  

• `h5p use <library> <folder>` computes view & edit dependencies for a `<library>` using the provided `libraries/<folder>` as the main library. A local library registry entry will also be created if the library is missing from the local registry.  
Library dependencies also need to be present in the `libraries` folder.  

• `h5p register <repoUrl>` or `h5p register <entry.json>` to add or update entries in the local registry.  
`<repoUrl>` is the library repository url.
If specified, the `<entry.json>` file needs to be created. Below is an example.  
You can also use this command to update existing registry entries.  
```
{
  "H5P.Accordion": {
    "id": "H5P.Accordion", // library machine name
    "title": "Accordion",
    "repo": { // optional; required for clone, install and deps commands
      "type": "github",
      "url": "https://github.com/h5p/h5p-accordion"
    },
    "author": "Batman",
    "runnable": true, // specify true if this is a main library from which you can create content types; false if it's a dependency for another
    "repoName": "h5p-accordion", // library name
    "org": "h5p" // github organization under which the library is published; optional; required for clone, install and deps commands
  }
}
```

• `h5p clone <library> <mode> [useCache]` clones the library and its dependencies in the libraries folder.  
Use `view` or `edit` for `<mode>`.  
`[useCache]` can be `1` if you want it to use the cached deps.  

• `h5p install <library> <mode> [useCache]` downloads the library and its dependencies in the libraries folder.  
Use `view` or `edit` for `<mode>`.  
`[useCache]` can be `1` if you want it to use the cached deps.  

• `h5p setup <library|repoUrl> [version] [download]` computes & clones/installs view and edit dependencies for a library.  
You can optionally specify a library `[version]`. To view current versions for a library use the `tags` command.  
Using `1` for the `[download]` parameter will download the libraries instead of cloning them as git repos.  

• `h5p missing <library>` will compute the unregistered dependencies for a library.  
The library itself has to exist in the local library registry.  

• `h5p verify <h5p-repo-name>` to check the status of the setup for a given library.  
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

• `h5p server` starts the dev server.  
Once the dev server is started you can use your browser to view, edit, delete, import, export and create new content types. To view the dashboard point your browser to  
http://localhost:8080/dashboard  

• `h5p export <library> <folder>` will export the `<library>` content type from the `content/<folder>` folder.  
Make sure that the library's dependency lists are cached and that the dependencies are installed.  
Once finished, the export command outputs the location of the resulting file.  

 When viewing content types they are automatically upgraded to the version of the currently used main library.  

 When viewing content types you can create and switch between resume sessions. A resume session allows you to save the state of the content type that supports it so that it will be the same on reload.  
You can create a new session by clicking on the "new session" button and entering a new name for it.  
To switch between existing sessions simply choose the one you want from the dropdown. Choose the "null" session to not save states.  

 To stop auto reloading the view page on library file changes set `files.watch` to `false` in `config.json`.  

 Run `h5p utils help` to get a list of utility commands.  
Each utility command can then be run via `h5p utils <cmd> [<args>...]`.  

 Git related commands may require you to add your ssh key to the ssh agent after starting it.  
Here are some guides on how to add an ssh key to the ssh agent on [Linux](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent#adding-your-ssh-key-to-the-ssh-agent), [Mac](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#adding-your-ssh-key-to-the-ssh-agent), [Windows](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=windows#adding-your-ssh-key-to-the-ssh-agent).  
