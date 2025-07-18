const output = require('../utility/output');
const Input = require('../utility/input');
const repository = require('../utility/repository');
const { execSync } = require('child_process');
const path = require('path');
const process = require('process');
const readline = require('readline');

const c = output.color;

/**
 * Bump patch version of a content type interactively or automatically
 * @param {...string} inputList
 * @returns {Promise<void>}
 */
async function bump(...inputList) {
  const autoYes = inputList.includes('--yes') || inputList.includes('-y');
  inputList = inputList.filter(arg => arg !== '--yes' && arg !== '-y');

  const input = new Input(inputList);

  await input.init(true);

  let libraries = input.getLibraries();

  if (!libraries.length) {
    const cwd = process.cwd();
    const libName = path.basename(cwd);
    libraries = [libName];
    process.chdir(path.dirname(cwd));
    output.printLn(`${c.blue}Defaulting to current folder: ${c.emphasize}${libName}${c.default}`);
  }

  const lib = libraries[0];

  output.printLn(`${c.blue}Bumping patch version of: ${c.emphasize}${lib}${c.default}`);

  // Run the H5P CLI bump
  let bumpOutput = '';
  try {
    bumpOutput = execSync(`h5p utils increase-patch-version ${lib}`, { encoding: 'utf8' });
    output.printLn(bumpOutput.trim());
  } catch {
    output.printLn(`${c.red}Failed to bump version using h5p utils.${c.default}`);
    return;
  }

  if (bumpOutput.includes('SKIPPED')) {
    output.printLn(`${c.yellow}Nothing to bump — skipping further steps.${c.default}`);
    return;
  }

  // Go back into library folder for git
  process.chdir(lib);
  output.printLn(`${c.blue}Changed directory back to: ${c.emphasize}${lib}${c.default}`);

  // Extract new version from library.json
  const libData = repository.getLibraryData('.');
  const { majorVersion, minorVersion, patchVersion } = libData;

  if (!majorVersion || !minorVersion || !patchVersion) {
    output.printLn(`${c.red}Failed to read version from library.json.${c.default}`);
    return;
  }

  const version = `${majorVersion}.${minorVersion}.${patchVersion}`;
  output.printLn(`${c.green}New version: ${version}${c.default}`);

  // Stage changes
  if (autoYes) {
    output.printLn(`${c.yellow}Staging version bump automatically…${c.default}`);
    try {
      execSync(`git restore --staged library.json`, { stdio: 'inherit' });
      execSync(`git add library.json`, { stdio: 'inherit' });
    } catch {
      output.printLn(`${c.red}Git staging failed.${c.default}`);
      return;
    }
  } else {
    output.printLn(`${c.yellow}Staging version bump interactively…${c.default}`);
    try {
      execSync(`git restore --staged library.json`, { stdio: 'inherit' });
      execSync(`git add -p library.json`, { stdio: 'inherit' });
    } catch {
      output.printLn(`${c.red}Git staging failed.${c.default}`);
      return;
    }
  }

  // Check if anything is staged
  const gitStatus = execSync(`git status --porcelain library.json`, { encoding: 'utf8' }).trim();
  if (!gitStatus) {
    output.printLn(`${c.yellow}No changes detected in library.json — nothing to commit.${c.default}`);
    return;
  }

  // Commit
  try {
    execSync(`git commit -m "Bump to ${version}"`, { stdio: 'inherit' });
    output.printLn(`${c.green}Committed version bump to ${version}.${c.default}`);
  } catch {
    output.printLn(`${c.red}Git commit failed.${c.default}`);
    return;
  }

  const proceedWithTagAndPush = (doTag, doPush) => {
    if (doTag) {
      try {
        execSync(`git tag -a ${version} -m "${version}"`, { stdio: 'inherit' });
        output.printLn(`${c.green}Tag ${version} created.${c.default}`);
      } catch {
        output.printLn(`${c.red}Git tag creation failed.${c.default}`);
      }
    } else {
      output.printLn(`${c.yellow}Tag creation skipped.${c.default}`);
    }

    if (doPush) {
      try {
        output.printLn(`${c.blue}Pushing commits…${c.default}`);
        execSync(`git push`, { stdio: 'inherit' });

        if (doTag) {
          output.printLn(`${c.blue}Pushing tag ${version}…${c.default}`);
          execSync(`git push origin ${version}`, { stdio: 'inherit' });
        }

        output.printLn(`${c.green}Changes pushed successfully.${c.default}`);
      } catch {
        output.printLn(`${c.red}Git push failed.${c.default}`);
      }
    } else {
      output.printLn(`${c.yellow}Push aborted.${c.default}`);
    }
  };

  if (autoYes) {
    proceedWithTagAndPush(true, true);
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`Do you want to create a git tag for version ${version}? (y/n): `, tagAnswer => {
      const doTag = tagAnswer.trim().toLowerCase() === 'y';

      rl.question(`Do you want to push the changes? (y/n): `, pushAnswer => {
        const doPush = pushAnswer.trim().toLowerCase() === 'y';
        proceedWithTagAndPush(doTag, doPush);
        rl.close();
      });
    });
  }
}

module.exports = bump;

