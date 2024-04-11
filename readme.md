An h5p toolkit for running, editing and developing h5p content types.  
Make sure you have [git](https://git-scm.com/downloads), [NodeJS](https://nodejs.org/en/download/current) and [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (usually included in NodeJS) installed.  
Some of the commands listed here are Linux & MacOS specific. On Windows it’s recommended that you run them inside [git bash](https://git-scm.com/download/win).  

# INSTALLATION

Uninstall any previous h5p-cli toolkit instance
```
npm uninstall -g h5p-cli
npm uninstall -g h5p
```
then install it from this repository
```
git clone https://github.com/h5p/h5p-cli.git
cd h5p-cli
npm install
cd ..
npm install -g ./h5p-cli
```

![installation gif](assets/docs/install.gif)

# QUICK START GUIDE

1. Install the core h5p libraries.
```
h5p core
```
2. Setup an h5p library such as h5p-course-presentation.
```
h5p setup h5p-course-presentation
```
This is required for running and editing content types in the h5p-course-presentation library.  
You can install other libraries listed by `h5p list` in the same way.  
For example, `h5p setup h5p-accordion` installs the "h5p-accordion" library and its dependencies.  
> [!NOTE]
> You can read more on setting up libraries [here](assets/docs/setup.md).
3. Start the development server.
```
h5p server
```
You can now use your browser to view, edit, delete, import, export and create new content types.  
<video src="https://github.com/h5p/h5p-cli/assets/5208532/b33a12e6-3200-488c-81c6-eae41b13f512"></video>
> [!IMPORTANT]
> h5p commands run relative to the current working directory. This means that the folder where you run the h5p server is where the server will look for the libraries. If you run the setup commands in another folder then the server will not find those libraries.  
> It's recommended that you create a new folder and run the setup and server commands from there. You can have different folders each with different library setups.  

Other h5p commands can be found [here](assets/docs/commands.md) or by running `h5p help`.  
