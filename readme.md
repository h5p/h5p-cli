An h5p toolkit for running, editing and developing h5p content types.  
Make sure you have [git](https://git-scm.com/downloads), [NodeJS](https://nodejs.org/en/download/current) and [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (usually included in NodeJS) installed.  

# INSTALLATION

Uninstall any previous h5p-cli toolkit instance
```
npm uninstall -g h5p-cli
npm uninstall -g h5p
```
then install it from this repository
```
git clone git@github.com:h5p/h5p-cli.git
cd h5p-cli
npm install
cd ..
npm install -g ./h5p-cli
```

![installation gif](assets/docs/install.gif)

# QUICK START GUIDE

0. h5p commands run relative to the current working directory. It's recommended that you run them in a new folder. Remember to keep track of your development folders. :)  
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
h5p server [port]
```
`[port]` is an optional port number. Default is 8080.  
You can now use your browser to view, edit, delete, import, export and create new content types.  
[!(server command video)](assets/docs/server.mp4)
4. List all available commands.
```
h5p help
```
`h5p help <command>` prints the help entry for that `<command>`.  

# Detailed CLI commands

[commands.md](assets/docs/commands.md)
