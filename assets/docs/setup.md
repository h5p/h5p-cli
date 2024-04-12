# Folder structure

Running commands listed in [commands.md](commands.md) results in the creation of five folders. The folders are created in the current working directory (the folder where you ran the command).  
- `cache` holds computed dependency lists for the libraries that have been set up.  
- `content` holds actual content types and their assets.  
- `libraries` holds the libraries that have been set up.  
- `temp` holds local copies of git repositories that are used when computing dependencies.  
- `uploads` is a temporary location used by the import and export commands.  

> [!IMPORTANT]
> Make sure to delete the `temp` folder when updating to the latest version of a library that has new or updated dependencies so that fresh git repository copies are cloned.  

# Setup a local library

To use your own local library create a folder for it in the `libraries` directory. The library folder name format is `<h5pLibraryName>-<majorVersion>.<minorVersion>`.  
Then run `h5p use <library> <folder>`.  
`<library>` is something like `h5p-greeting-card`.  
`<folder>` is something like `H5P.GreetingCard-1.0`.  
An example for this is
```
h5p use h5p-greeting-card H5P.GreetingCard-1.0
```
It will setup the `h5p-greeting-card` library located in the `libraries/H5P.GreetingCard-1.0` directory.  
Its dependencies need to be present in the `libraries` folder. Otherwise they need to be set up separately.  
Please note that, should the dependencies change (including the optional ones in semantics.json), you will have to run this command again in order to regenerate the cached dependency lists.  
Please [find a library development tutorial](https://h5p.org/library-development) for details on that topic.  

# Setup a library from github

Libraries that can be automatically installed are stored in the local library registry. The registry is a json file located at `cache/libraryRegistry.json`.  
Running `h5p setup <library>` may return the `unregistered library` error. This means that the local library registry is missing this library. We have to find its repository url and register it.  
As an example, run `h5p register https://github.com/otacke/h5p-portfolio` to register the `h5p-portfolio` library in the local registry.  
Run `h5p missing h5p-portfolio` to list the unregistered dependencies for `h5p-portfolio`. Then find their repository urls and register them.  
```
h5p register https://github.com/otacke/h5p-portfolio-placeholder
h5p register https://github.com/otacke/h5p-portfolio-chapter
h5p register https://github.com/otacke/h5p-editor-portfolio
```
Run `h5p missing h5p-portfolio` again to list any unregistered dependencies for the newly registered ones. And register them.  
```
h5p register https://github.com/otacke/h5p-file-for-download
h5p register https://github.com/otacke/h5p-editor-portfolio-placeholder
h5p register https://github.com/otacke/h5p-editor-portfolio-chapter
```
Run `h5p missing h5p-portfolio` again to make sure there are no other unregistered dependencies.  
Finally, run `h5p setup h5p-portfolio` to install the library and its dependencies.  
You can use the `git@github.com:otacke/h5p-portfolio.git` url format when dealing with private repositories.  

# GIT and your SSH-AGENT

If you have to setup libraries from private repositories or if you encounter the `Permission denied (publickey)` error make sure you add your public ssh key to your local ssh agent.  
It's as easy as running the two commands below.  
```
eval `ssh-agent -t 8h`
ssh-add
```
All git related commands should now work in the current session for at least 8h. Feel free to change the duration to better suit your needs. :)  
Here are some guides on how to add an ssh key to the ssh agent on [Linux](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent#adding-your-ssh-key-to-the-ssh-agent), [Mac](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#adding-your-ssh-key-to-the-ssh-agent), [Windows](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=windows#adding-your-ssh-key-to-the-ssh-agent).  
