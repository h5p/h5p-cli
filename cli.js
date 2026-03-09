const { execSync } = require("child_process");
const fs = require('fs');
const path = require('path');
const logic = require('./logic.js');
const config = require('./configLoader.js');
const utils = require('./assets/utils/cli.js');
let marked = require('marked');
const markedTerminal = require('marked-terminal');
marked.setOptions({
  mangle: false,
  headerIds: false,
  renderer: new markedTerminal()
});
marked = marked.marked;
if (process.env.H5P_SSH_CLONE) {
  config.urls.library.clone = config.urls.library.sshClone;
}

const gitRefExists = (ref) => {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${ref} || git show-ref --verify --quiet refs/remotes/${ref}`, {
      stdio: 'ignore',
    });
    return true;
  }
  catch {
    return false;
  }
};

const handleMissingOptionals = (missingOptionals, result, item) => {
  if (result[item].optional) {
    if (!missingOptionals[item]) {
      missingOptionals[item] = result[item];
    }
  } else {
    throw new Error(
      `unregistered ${item} library required by ${result[item].parent}`
    );
  }
};
const cli = {
  // exports content type as .h5p zipped file
  export: async (library, folder) => {
    try {
      const file = await logic.export(library, folder);
      console.log(file);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // imports content type from .h5p zipped file
  import: (folder, archive) => {
    try {
      const output = logic.import(folder, archive);
      console.log(`content/${output}`);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // lists h5p libraries
  list: async (reversed, ignoreFile) => {
    try {
      console.log('> fetching h5p library registry');
      const result = await logic.getRegistry(parseInt(ignoreFile));
      for (let item in result.regular) {
        console.log(`${parseInt(reversed) ? result.regular[item].id : item} (${result.regular[item].org})`);
      }
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // list tags for library
  tags: (org, library, mainBranch) => {
    try {
      console.log('> fetching h5p library tags');
      const result = logic.tags(org, library, mainBranch);
      console.log(result);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // computes dependencies for h5p library
  deps: async (library, mode, version, folder) => {
    try {
      const result = await logic.computeDependencies(library, mode, version, folder);
      for (let item in result) {
        console.log(result[item].id ? item : `!!! unregistered ${result[item].optional ? 'optional' : 'required'} ${item} library`);
      }
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // computes missing dependencies for h5p library
  missing: async (library) => {
    try {
      const libraryDirs = await logic.parseLibraryFolders();
      const registry = await logic.getRegistry();
      const missing = {}; // list of missing dependencies (key) with true for optional & false for required (value)
      const parseMissing = (result, item) => {
        if (!registry.regular[item] && (typeof missing[item] === 'undefined' || missing[item])) {
          missing[item] = result[item].optional;
        }
      }
      let result = await logic.computeDependencies(library, 'view', null, libraryDirs[registry.regular[library].id]);
      for (let item in result) {
        parseMissing(result, item);
        if (registry.regular[item]) {
          const list = await logic.computeDependencies(item, 'edit', null, libraryDirs[registry.regular[item].id]);
          for (let elem in list) {
            parseMissing(list, elem);
          }
        }
      }
      result = await logic.computeDependencies(library, 'edit', null, libraryDirs[registry.regular[library].id]);
      for (let item in result) {
        parseMissing(result, item);
      }
      if (!Object.keys(missing).length) {
        console.log(`> ${library} has no unregistered dependencies`);
        return;
      }
      console.log(`> unregistered dependencies for ${library}`);
      for (let item in missing) {
        console.log(`${item} (${missing[item] ? 'optional' : 'required'})`);
      }
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // installs dependencies for h5p library
  install: async (library, mode) => {
    try {
      console.log(`> downloading ${library} library and dependencies into "${config.folders.libraries}" folder`);
      await logic.getWithDependencies('download', library, mode);
      console.log(`> done installing ${library}`);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // clones dependencies for h5p library
  clone: async (library, mode) => {
    try {
      console.log(`> cloning ${library} library and dependencies into "${config.folders.libraries}" folder`);
      await logic.getWithDependencies('clone', library, mode);
      console.log(`> done installing ${library}`);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // installs core h5p libraries
  core: async () => {
    try {
      for (let item of config.core.clone) {
        const folder = `${config.folders.libraries}/${item}`;
        if (fs.existsSync(folder)) {
          console.log(`>> ~ skipping ${item}; it already exists.`);
          continue;
        }
        console.log(`>> + installing ${item}`);
        logic.clone('h5p', item, 'master', item);
      }
      for (let item of config.core.setup) {
        await cli.setup(item);
      }
      console.log('> done setting up core libraries');
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // computes & installs dependencies for h5p library
  setup: async function(library, version, download) {
    const isUrl = ['http', 'git@'].includes(library.slice(0, 4)) ? true : false;
    const url = library;
    const missingOptionals = {};
    try {
      if (isUrl) {
        const entry = await this.register(url);
        library = logic.machineToShort(Object.keys(entry)[0]);
      }
      let toSkip = [];
      const action = parseInt(download) ? 'download' : 'clone';
      const latest = version ? false : true;
      let result = await logic.computeDependencies(library, 'view', version);
      for (let item in result) {
        // setup editor dependencies for every view dependency
        if (!result[item].id) {
          handleMissingOptionals(missingOptionals, result, item);
        }
        else {
          toSkip = await logic.getWithDependencies(action, item, 'edit', latest, toSkip);
        }
      }
      result = await logic.computeDependencies(library, 'edit', version);
      for (let item in result) {
        if (!result[item].id) {
          handleMissingOptionals(missingOptionals, result, item);
        }
      }
      toSkip = [];
      console.log(`> ${action} ${library} library "view" dependencies into "${config.folders.libraries}" folder`);
      toSkip = await logic.getWithDependencies(action, library, 'view', latest, toSkip);
      console.log(`> ${action} ${library} library "edit" dependencies into "${config.folders.libraries}" folder`);
      toSkip = await logic.getWithDependencies(action, library, 'edit', latest, toSkip);
      if (Object.keys(missingOptionals).length) {
        console.log('!!! missing optional libraries');
        for (let item in missingOptionals) {
          console.log(`${item} (${missingOptionals[item].optional ? 'optional' : 'required'}) required by ${missingOptionals[item].parent}`);
        }
      }
      console.log(`> done setting up ${library}`);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // clone library branches in corresponding @branch folders
  '@branches': (input) => {
    try {
      console.log(execSync('git checkout .').toString());
      execSync('rm -rdf @*');
      const initialBranch = execSync('git rev-parse --abbrev-ref HEAD').toString();
      const branches = process.argv.slice(3);
      const validBranches = [];
      for (let branch of branches) {
        const target = `@${branch.replace('/', '_')}`;
        const tmpTarget = `/tmp/h5p-cli-${target}`;

        let checkoutRef = branch;

        if (!gitRefExists(branch)) {
          if (!branch.includes('/') && gitRefExists(`origin/${branch}`)) {
            checkoutRef = `origin/${branch}`;
          }
          else {
            console.log(`\x1b[33m > branch "${branch}" does not exist locally or remotely \x1b[0m`);
            continue;
          }
        }

        execSync(`git checkout ${checkoutRef}`);
        fs.rmSync(tmpTarget, { recursive: true, force: true });
        execSync(`cp -r . ${tmpTarget}`);
        validBranches.push(branch);
      }
      execSync(`git checkout ${initialBranch}`);
      const libraryJson = JSON.parse(fs.readFileSync('library.json'));
      for (let branch of validBranches) {
        const target = `@${branch.replace('/', '_')}`;
        const tmpTarget = `/tmp/h5p-cli-${target}`;
        execSync(`cp -r ${tmpTarget} ${target}`);
        fs.rmSync(tmpTarget, { recursive: true, force: true });
        const targetLibraryJson = JSON.parse(fs.readFileSync(`${target}/library.json`));

        if (Array.isArray(targetLibraryJson.preloadedJs) &&
            Array.isArray(libraryJson.preloadedJs)) {

          for (const item of targetLibraryJson.preloadedJs) {
            if (!item?.path) continue;
            libraryJson.preloadedJs.push({
              ...item,
              path: `${target}/${item.path}`
            });
          }
        }

        if (Array.isArray(targetLibraryJson.preloadedCss) &&
            Array.isArray(libraryJson.preloadedCss)) {

          for (const item of targetLibraryJson.preloadedCss) {
            if (!item?.path) continue;
            libraryJson.preloadedCss.push({
              ...item,
              path: `${target}/${item.path}`
            });
          }
        }
        const packageFile = `${target}/package.json`;
        if (!fs.existsSync(packageFile)) {
          continue;
        }
        const info = JSON.parse(fs.readFileSync(packageFile));
        if (!info?.scripts?.build) {
          continue;
        }
        const pathToNodeModules = path.resolve(process.cwd(), target, 'node_modules');
        // // Delete node_modules if it exists
        if (fs.existsSync(pathToNodeModules)) {
          fs.rmSync(pathToNodeModules, { recursive: true, force: true });
        }
        console.log(`>>> npm install --ignore-scripts ${target}`);
        console.log(execSync('npm install --ignore-scripts', {cwd: target}).toString());
        console.log(`>>> npm run build ${target}`);
        console.log(execSync('npm run build', {cwd: target}).toString());
      }
      fs.writeFileSync('library.json', JSON.stringify(libraryJson, null, 2));
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // updates local library registry entry
  register: async (input) => {
    try {
      const isUrl = ['http', 'git@'].includes(input.slice(0, 4)) ? true : false;
      let registry = await logic.getRegistry();
      const entry = isUrl ? await logic.registryEntryFromRepoUrl(input) : JSON.parse(fs.readFileSync(input, 'utf-8'));
      registry.reversed = {...registry.reversed, ...entry};
      fs.writeFileSync(config.registry, JSON.stringify(registry.reversed));
      console.log('> updated registry entry');
      console.log(entry);
      return entry;
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // generates report that verifies if an h5p library and its dependencies have been correctly computed & installed
  verify: async (library) => {
    try {
      let result = await logic.verifySetup(library);
      console.log(result);
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // run the dev server
  server: () => {
    require('./server.js');
  },
  // help section
  help: (command) => {
    try {
      const help = fs.readFileSync(`${require.main.path}/assets/docs/commands.md`, 'utf-8');
      if (command) {
        const regexp = ` \`h5p ${command}(.*?)(\\n\\n|\\Z)`;
        const data = help.match(new RegExp(regexp, 's'))?.[0];
        if (!data) {
          console.log(`> "${command}" is not a valid command`);
          return;
        }
        console.log(marked(data));
        return;
      }
      console.log(marked(help));
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  },
  // various utility commands
  utils: function() {
    if (typeof utils[arguments[0]] != 'function') {
      console.log(`> "${process.argv[3]}" is not a valid utils command`);
      return;
    }
    utils[arguments[0]].apply(null, Array.prototype.slice.call(arguments).slice(1));
  }
}
if (typeof cli[process.argv[2]] == 'function') {
  cli[process.argv[2]].apply(cli, process.argv.slice(3));
}
else if (process.argv[2] === undefined) {
  cli.help();
}
else {
  console.log(`> "${process.argv[2]}" is not a valid command`);
}
