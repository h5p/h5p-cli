# Folder structure

Running commands listed in [commands.md](commands.md) results in the creation of 4 folders. The folders are created in the current working directory (the folder where you ran the command).  
- `content` holds actual content types and their assets.  
- `libraries` holds the libraries that have been set up.  
- `temp` holds local copies of git repositories that are used when computing dependencies.  
- `uploads` is a temporary location used by the import and export commands.  

> [!IMPORTANT]
> Make sure to delete the `temp` folder when updating to the latest version of a library that has new or updated dependencies so that fresh git repository copies are cloned.  

# Setup a local library

1 - Create a folder for it in the `libraries` directory.  
1.1 - Remember to run `npm install` and `npm run build` from within that library folder if your library has a build flow.  
2 - Library dependencies need to be present in the `libraries` folder. Otherwise they need to be set up separately.  
Please [find a library development tutorial](https://h5p.org/library-development) for details on that topic.  
An example library which corresponds to the "Hello World" tutorial can be found in [libraries/H5P.GreetingCard-1.0](../../libraries/H5P.GreetingCard-1.0).  

# Setup a library from github

Libraries that can be automatically installed are stored in the local library registry. The registry is a json file `libraryRegistry.json`.  
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
