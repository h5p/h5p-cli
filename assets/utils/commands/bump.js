const output = require('../utility/output');
const Input = require('../utility/input');
const repository = require('../utility/repository');
const { execSync } = require('child_process');
const path = require('path');
const process = require('process');

const c = output.color;

/**
 * Bump patch version of a content type interactively
 * @param {...string} inputList
 * @returns {Promise<void>}
 */
async function bump(...inputList) {
  const input = new Input(inputList);

  return input.init(true)
    .then(() => {
      let libraries = input.getLibraries();

      if (!libraries.length) {
        const cwd = process.cwd();
        const libName = path.basename(cwd);
        libraries = [libName];
        process.chdir(path.dirname(cwd)); // move up to parent folder
        output.printLn(`${c.blue}Defaulting to current folder: ${c.emphasize}${libName}${c.normal}`);
      }

      const lib = libraries[0];

      output.printLn(`${c.blue}Bumping patch version of: ${c.emphasize}${lib}${c.normal}`);

      // Run the H5P CLI bump
      let bumpOutput = '';
      try {
        bumpOutput = execSync(`h5p utils increase-patch-version ${lib}`, { encoding: 'utf8' });
        output.printLn(bumpOutput.trim());
      } catch (err) {
        output.printLn(`${c.red}Failed to bump version using h5p utils.${c.normal}`);
        return;
      }

      if (bumpOutput.includes('SKIPPED')) {
        output.printLn(`${c.yellow}Nothing to bump — skipping further steps.${c.normal}`);
        return;
      }

      // Go back into library folder for git
      process.chdir(lib);
      output.printLn(`${c.blue}Changed directory back to: ${c.emphasize}${lib}${c.normal}`);

      // Extract new version from library.json
      const libData = repository.getLibraryData('.');
      const { majorVersion, minorVersion, patchVersion } = libData;

      if (!majorVersion || !minorVersion || !patchVersion) {
        output.printLn(`${c.red}Failed to read version from library.json.${c.normal}`);
        return;
      }

      const version = `${majorVersion}.${minorVersion}.${patchVersion}`;
      output.printLn(`${c.green}New version: ${version}${c.normal}`);

      // Interactive git add -p
      output.printLn(`${c.yellow}Staging version bump interactively…${c.normal}`);
      try {
        execSync(`git restore --staged library.json`, { stdio: 'inherit' });
        execSync(`git add -p library.json`, { stdio: 'inherit' });
      } catch (err) {
        output.printLn(`${c.red}Git staging failed.${c.normal}`);
        return;
      }

      // Check if anything is actually staged
      const gitStatus = execSync(`git status --porcelain library.json`, { encoding: 'utf8' }).trim();
      if (!gitStatus) {
        output.printLn(`${c.yellow}No changes detected in library.json — nothing to commit.${c.normal}`);
        return;
      }

      // Commit
      try {
        execSync(`git commit -m "Bump to ${version}"`, { stdio: 'inherit' });
      } catch (err) {
        output.printLn(`${c.red}Git commit failed.${c.normal}`);
        return;
      }

      output.printLn(`${c.green}Committed version bump to ${version}.${c.normal}`);

      // Prompt for tag
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question(`Do you want to create a git tag for version ${version}? (y/n): `, tagAnswer => {
        let doTag = false;

        if (tagAnswer.trim().toLowerCase() === 'y') {
          try {
            execSync(`git tag -a ${version} -m "${version}"`, { stdio: 'inherit' });
            output.printLn(`${c.green}Tag ${version} created.${c.normal}`);
            doTag = true;
          } catch (err) {
            output.printLn(`${c.red}Git tag creation failed.${c.normal}`);
          }
        } else {
          output.printLn(`${c.yellow}Tag creation skipped.${c.normal}`);
        }

        // Prompt for push
        readline.question(`Do you want to push the changes? (y/n): `, pushAnswer => {
          if (pushAnswer.trim().toLowerCase() === 'y') {
            try {
              output.printLn(`${c.blue}Pushing commits…${c.normal}`);
              execSync(`git push`, { stdio: 'inherit' });

              if (doTag) {
                output.printLn(`${c.blue}Pushing tag ${version}…${c.normal}`);
                execSync(`git push origin ${version}`, { stdio: 'inherit' });
              }

              output.printLn(`${c.green}Changes pushed successfully.${c.normal}`);
            } catch (err) {
              output.printLn(`${c.red}Git push failed.${c.normal}`);
            }
          } else {
            output.printLn(`${c.yellow}Push aborted.${c.normal}`);
          }

          readline.close();
        });
      });
    });
}

module.exports = bump;

