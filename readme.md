An h5p toolkit for running, editing and developing h5p content types.  

Make sure you have [git](https://git-scm.com/downloads), [NodeJS](https://nodejs.org/en/download/current) and [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (usually included in NodeJS) installed.  
Some of the commands listed here are Linux & MacOS specific. On Windows it’s recommended that you run them inside [git bash](https://git-scm.com/download/win).  

# INSTALLATION

Uninstall any previous h5p-cli toolkit instance.
```
npm uninstall -g h5p-cli
npm uninstall -g h5p
```
Install it via npm
```
npm install -g h5p-cli
```
or install it from its repository.
```
git clone https://github.com/h5p/h5p-cli.git
cd h5p-cli
npm install
cd ..
npm install -g ./h5p-cli
```
You can now use `h5p` as a global command.  

![installation gif](assets/docs/install.gif)

# QUICK START GUIDE

> [!IMPORTANT]
> H5P commands run relative to the current working directory.  
> You can create multiple work directories each with different library setups.  

0. Create a new folder for your first H5P development environment and change your current work dir to it.  
```
mkdir my_first_h5p_environment
cd my_first_h5p_environment
```

1. Install the core H5P libraries.
```
h5p core
```

2. Setup an H5P library such as h5p-course-presentation.
```
h5p setup h5p-course-presentation
```
This is required for running and editing content types in the "h5p-course-presentation" library.  
You can install other libraries listed by `h5p list` in the same way.  
For example, `h5p setup h5p-accordion` installs the "h5p-accordion" library and its dependencies.  
> [!NOTE]
> You can [read more on setting up libraries here](assets/docs/setup.md) and you can
> [read more on tweaking the configuration to your needs here](assets/docs/configuration.md).

3. Start the development server.
```
h5p server
```
You can now use your browser to view, edit, delete, import, export and create new content types.  
> [!IMPORTANT]
> Remember that the folder where you run the H5P server is where the server will look for the libraries. If you run the setup commands in another folder then the server will not find those libraries.  

<video src="https://github.com/h5p/h5p-cli/assets/5208532/b33a12e6-3200-488c-81c6-eae41b13f512"></video>

You can [find more commands in an overview](assets/docs/commands.md) or by running `h5p help`.  
