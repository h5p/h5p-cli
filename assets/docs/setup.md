# Setup a local library

To use your own local library run `h5p use <library> <folder>`.  
`<library>` is something like `h5p-accordion`.  
`<folder>` is something like `H5P.GreetingCard-1.0`. The format for it is `<h5pMachineName>-<majorVersion>.<minorVersion>`.  
An example for this is
```
h5p use h5p-greeting-card H5P.GreetingCard-1.0
```
It will setup the `h5p-greeting-card` library located in the `libraries/H5P.GreetingCard-1.0` directory.  
Its dependencies need to be present in the `libraries` folder (otherwise they need to be set up separately).  
Please note that, should the dependencies change (including the optional ones in semantics.json), you will have to run this command again in order to regenerate the cached dependency lists.  
You can also use this command to switch between different versions of the same library.  
A library development tutorial can be found [here](https://h5p.org/library-development).  

# Setup a library from github

Running `h5p setup <library>` may return the `unregistered library` error. This means that the local library registry is missing this library. We have to find its repository url and register it.  
As an example, run `h5p register https://github.com/otacke/h5p-game-map` to register the `h5p-game-map` library in the local registry.  
Run `h5p missing h5p-game-map` to list the unregistered dependencies for `h5p-game-map`. Then find their repository urls and register them.  
```
h5p register https://github.com/otacke/h5p-editor-game-map
h5p register https://github.com/otacke/h5p-combination-lock
h5p register https://github.com/otacke/h5p-tabs
h5p register https://github.com/otacke/h5p-transcript
```
Run `h5p missing h5p-game-map` again to list any unregistered dependencies for the newly registered ones. And register them.  
```
h5p register https://github.com/otacke/h5p-editor-tabs
h5p register https://github.com/otacke/h5p-transcript-library
```
Run `h5p missing h5p-game-map` again to make sure there are no other unregistered dependencies.  
Finally, run `h5p setup h5p-game-map` to install the library and its dependencies.  
You can also use the `git@github.com:otacke/h5p-game-map.git` url format when dealing with private repositories.  

# GIT and your SSH-AGENT

If you have to setup libraries from private repositories or if you encounter the `Permission denied (publickey)` error make sure you add your public ssh key to your local ssh agent.  
It's as easy as running the two commands below.  
```
eval `ssh-agent -t 8h`
ssh-add
```
Here are some guides on how to add an ssh key to the ssh agent on [Linux](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent#adding-your-ssh-key-to-the-ssh-agent), [Mac](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#adding-your-ssh-key-to-the-ssh-agent), [Windows](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=windows#adding-your-ssh-key-to-the-ssh-agent).  
All git related commands should now work in the current session for at least 8h. Feel free to change the duration to better suit your needs. :)  

# Linux, MacOS, Windows

Some of the commands listed here are Linux & MacOS specific. On Windows it’s recommended that you run them inside [git bash](https://git-scm.com/download/win).  

# Folder structure

Running commands listed in [commands.md](assets/docs/commands.md) results in the creation of five folders.  
`cache` holds computed dependency lists for the libraries that have been set up.  
`content` holds actual content types and their assets.  
`libraries` holds the libraries that have been set up.  
`temp` holds local copies of git repositories that are used when computing dependencies. Make sure to delete the `temp` folder when updating to the latest version of a library that has added or removed dependencies so that fresh git repository copies are cloned.  
`uploads` is a temporary location used by the import and export commands.  
