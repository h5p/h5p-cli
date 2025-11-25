• `h5p help` prints this help page.  
`h5p help <command>` prints the help entry for that `<command>`.  

• `h5p utils help` prints a list of utility commands.  
Each utility command can then be run via `h5p utils <cmd> [<args>...]`.  
Run `h5p utils help <cmd>` for a detailed help entry for each utility `<cmd>`.  

• `h5p core` installs the core H5P libraries.  
These are required to view and edit H5P content types.  

• `h5p list [machineName] [pullRegistry]` lists the current H5P libraries.  
Use `1` for `[machineName]` to list the machine name instead of the default repo name.  
Use `1` for `[pullRegistry]` to recreate the local registry.  
The output format is `<library> (<org>)`.  

• `h5p tags <org> <library> <mainBranch>` lists current library versions.  
The `<org>` for a library is mentioned in the `list` command output.  
`<mainBranch>` is the main branch of the repository. Default is `master`.  

• `h5p deps <library> <mode> [version] [folder]` computes dependencies for an H5P library.  
Use `view` or `edit` for `<mode>` to generate dependencies for those cases.  
Specify a `[version]` to compute deps for that version. Default is `master`. Use the `tags` command to list versions for a library.  
Specify a `[folder]` to compute deps based on the library from `libraries/[folder]` folder. Default is `""`.  

• `h5p register <gitUrl>` or `h5p register <entry.json>` to add or update entries in the local registry.  
`<gitUrl>` is something like `git@github.com:h5p/h5p-accordion.git` or `https://github.com/h5p/h5p-accordion`.  
If specified, the `<entry.json>` file needs to be created. Below is an example.  
You can use this command to update existing registry entries.
```
{
  "H5P.Accordion": {
    "id": "H5P.Accordion", // library machine name
    "title": "Accordion",
    "repo": { // optional
      "type": "github",
      "url": "https://github.com/h5p/h5p-accordion"
    },
    "author": "Batman",
    "runnable": true, // specify true if this is a main library from which you can create content types; false if it's a dependency for another
    "shortName": "h5p-accordion", // library name
    "repoName": "h5p-accordion", // optional repository name
    "org": "h5p" // github organization under which the library is published; optional; required for clone, install and deps commands
  }
}
```

• `h5p clone <library> <mode>` clones the library and its dependencies in the libraries folder.  
Use `view` or `edit` for `<mode>`.  

• `h5p install <library> <mode>` downloads the library and its dependencies in the libraries folder.  
Use `view` or `edit` for `<mode>`.  

• `h5p setup <library|repoUrl> [version] [download]` sets up a library and its dependencies.  
`<repoUrl>` is a github repository url. Running the command in this format will also update the library in the local registry. This is useful for unregistered libraries.  
For example, `h5p setup git@github.com:h5p/h5p-accordion.git` installs the "h5p-accordion" library and its dependencies. It also updates its entry in the local library registry.  
You can optionally specify a library `[version]`. To view current versions for a library use the `tags` command.
Using `1` for the `[download]` parameter will download the libraries instead of cloning them as git repos.  
Set the `H5P_NO_UPDATES` environment variable to `1` to skip updating libraries and speed up the setup process.  
Set the `H5P_SSH_CLONE` environment variable to `1` so that ssh urls are used when cloning private repositories. This is useful for cloning private repos and for when you want to commit from the `libraries/<library>` folder.  
> [!IMPORTANT]
> If no `[version]` is specified master branches will be used.  

• `h5p missing <library>` will compute the unregistered dependencies for a library.  
The library itself has to exist in the local library registry.  

• `h5p verify <h5p-repo-name>` to check the status of the setup for a given library.  
Running `h5p verify h5p-accordion` should return something like below if the library was properly set up.  
```
{
  registry: true, // library found in registry
  libraries: { // shows which dependencies are installed; optional dependencies are ignored but should be present for the library to be fully featured
    'FontAwesome-4.5': { optional: false, present: true },
    'H5P.AdvancedText-1.1': { optional: true, present: true },
    'H5P.Accordion-1.0': { optional: false, present: true }
  },
  ok: true // overall setup status
}
```

• `h5p @branches [<branch>...]` creates `@<branch>` folders when run within a git repository folder.  
The command runs `npm install --ignore-scripts` and `npm run build` for each `@<branch>` folder if required.  
The command also updates the preloaded `library.json` entries to include those from the `@<branch>` folders.  

• `h5p server [port]` starts the dev server.  
`[port]` is an optional port number. Default is 8080.  
Once the dev server is started you can use your browser to view, edit, delete, import, export and create new content types.  

• `h5p export <library> <folder>` will export the `<library>` content type from the `content/<folder>` folder.  
An example here is `h5p export h5p-agamotto agamotto-test` which will export the `h5p-agamotto` content type located in the `content/agamotto-test` folder.  
Make sure that the library's dependencies are installed.  
Once finished, the export command outputs the location of the resulting file.  

• `h5p import <folder> <h5p_archive_file_path>` will import the archived .h5p `<h5p_archive_file_path>` content type into the `content/<folder>` folder.  
An example here is `h5p import agamotto-test ~/Downloads/agamotto_test.h5p` which will import the `~/Downloads/agamotto_test.h5p` archived .h5p file into the `content/agamotto-test` folder.  
Once finished, the import command outputs the location of the resulting content type folder.  

 When viewing content types they are automatically upgraded to the version of the currently used main library.  
 When viewing content types you can create and switch between resume sessions. A resume session allows you to save the state of the content type that supports it so that it will be the same on reload.  
 You can create a new session by clicking on the "new session" button and entering a new name for it.  
 To switch between existing sessions simply choose the one you want from the dropdown. Choose the "null" session to not save states.  
 To stop auto reloading the view page on library file changes set `files.watch` to `false` in `config.json`.  
