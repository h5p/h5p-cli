const output = require('../utility/output');
const Input = require('../utility/input');
const repository = require('../utility/repository');
const { execSync } = require('child_process');
const path = require('path');
const process = require('process');
const readline = require('readline');

const c = output.color;

async function bump(...inputList) {
  const autoYes = inputList.includes('--yes') || inputList.includes('-y');
  inputList = inputList.filter(arg => arg !== '--yes' && arg !== '-y');

  const input = new Input(inputList);
  await input.init(true);

  const lib = detectLibrary(input);
  if (!lib) {
    return;
  }

  if (!runH5pBump(lib)) {
    return;
  }

  process.chdir(lib);
  output.printLn(`${c.blue}Changed directory back to: ${c.emphasize}${lib}${c.default}`);

  const version = getVersion();
  if (!version) return;

  if (!stageChanges(autoYes)) return;
  if (!commitChanges(version)) return;

  if (autoYes) {
    tagAndPush(version, true, true);
  }
  else {
    promptTagAndPush(version);
  }
}

// Helpers
function detectLibrary(input) {
  let libraries = input.getLibraries();
  if (!libraries.length) {
    const cwd = process.cwd();
    const libName = path.basename(cwd);
    libraries = [libName];
    process.chdir(path.dirname(cwd));
    output.printLn(`${c.blue}Defaulting to current folder: ${c.emphasize}${libName}${c.default}`);
  }
  output.printLn(`${c.blue}Bumping patch version of: ${c.emphasize}${libraries[0]}${c.default}`);
  return libraries[0];
}

function runH5pBump(lib) {
  let bumpOutput = '';
  try {
    bumpOutput = execSync(`h5p utils increase-patch-version ${lib}`, { encoding: 'utf8' });
    output.printLn(bumpOutput.trim());
  }
  catch {
    output.printLn(`${c.red}Failed to bump version using h5p utils.${c.default}`);
    return false;
  }
  if (bumpOutput.includes('SKIPPED')) {
    output.printLn(`${c.yellow}Nothing to bump — skipping further steps.${c.default}`);
    return false;
  }
  return true;
}

function isValidSemver(...args) {
  return args.every(n => typeof n === 'number');
}

function getVersion() {
  const libData = repository.getLibraryData('.');
  const { majorVersion, minorVersion, patchVersion } = libData;
  if (!isValidSemver(majorVersion, minorVersion, patchVersion)) {
    output.printLn(`${c.red}Failed to read version from library.json.${c.default}`);
    return null;
  }
  const version = `${majorVersion}.${minorVersion}.${patchVersion}`;
  output.printLn(`${c.green}New version: ${version}${c.default}`);
  return version;
}

function stageChanges(autoYes) {
  try {
    execSync(`git restore --staged library.json`, { stdio: 'inherit' });
    if (autoYes) {
      output.printLn(`${c.yellow}Staging version bump automatically…${c.default}`);
      execSync(`git add library.json`, { stdio: 'inherit' });
    }
    else {
      output.printLn(`${c.yellow}Staging version bump interactively…${c.default}`);
      execSync(`git add -p library.json`, { stdio: 'inherit' });
    }
  }
  catch {
    output.printLn(`${c.red}Git staging failed.${c.default}`);
    return false;
  }

  const gitStatus = execSync(`git status --porcelain library.json`, { encoding: 'utf8' }).trim();
  if (!gitStatus) {
    output.printLn(`${c.yellow}No changes detected in library.json — nothing to commit.${c.default}`);
    return false;
  }

  return true;
}

function commitChanges(version) {
  try {
    execSync(`git commit -m "Bump to ${version}"`, { stdio: 'inherit' });
    output.printLn(`${c.green}Committed version bump to ${version}.${c.default}`);
  }
  catch {
    output.printLn(`${c.red}Git commit failed.${c.default}`);
    return false;
  }
  return true;
}

function tagAndPush(version, doTag, doPush) {
  let tagHandled = true;

  if (doTag) {
    try {
      execSync(`git tag -a ${version} -m "${version}"`, { stdio: 'inherit' });
      output.printLn(`${c.green}Tag ${version} created.${c.default}`);
    }
    catch {
      output.printLn(`${c.red}Git tag creation failed.${c.default}`);
      tagHandled = false;
    }
  }
  else {
    output.printLn(`${c.yellow}Tag creation skipped.${c.default}`);
  }

  // Only push if tag is handled correctly (or no tag was requested)
  if (doPush && tagHandled) {
    try {
      output.printLn(`${c.blue}Pushing commits…${c.default}`);
      execSync(`git push`, { stdio: 'inherit' });
      if (doTag) {
        output.printLn(`${c.blue}Pushing tag ${version}…${c.default}`);
        execSync(`git push origin ${version}`, { stdio: 'inherit' });
      }
      output.printLn(`${c.green}Changes pushed successfully.${c.default}`);
    }
    catch {
      output.printLn(`${c.red}Git push failed.${c.default}`);
    }
  }
  else if (doPush) {
    output.printLn(`${c.red}Skipping push due to tag failure.${c.default}`);
  }
  else {
    output.printLn(`${c.yellow}Push aborted.${c.default}`);
  }
}

function promptTagAndPush(version) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`Do you want to create a git tag for version ${version}? (y/n): `, tagAnswer => {
    const doTag = tagAnswer.trim().toLowerCase() === 'y';

    rl.question(`Do you want to push the changes? (y/n): `, pushAnswer => {
      const doPush = pushAnswer.trim().toLowerCase() === 'y';
      tagAndPush(version, doTag, doPush);
      rl.close();
    });
  });
}

module.exports = bump;

