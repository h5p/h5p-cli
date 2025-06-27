/**
 * Upgrades content parameters to the latest version using the provided upgrade script.
 * Just a wrapper - to the caller, `upgradeContent` makes more sense, but here `processField` is more adequate.
 * @param {object} params The content parameters to upgrade.
 * @param {function} getUpgradesScript Function that returns the upgrade script for the content type.
 * @param {function} getLatestLibraryVersion Function that returns the latest library version.
 * @param {object} [targetVersion] Optional target version to upgrade to. If not provided, all upgrade functions for newer versions will be applied.
 * @returns {object} Upgraded content parameters.
 */
const upgradeContent = (params, getUpgradesScript = () => {}, getLatestLibraryVersion, targetVersion = {}) => {
  return processField(params, getUpgradesScript, getLatestLibraryVersion, targetVersion) || params;
};

/**
 * Recursively process parameter fields and upgrade them if required
 * @param {object} params The content parameters to upgrade.
 * @param {function} getUpgradesScript Function that returns the upgrade script for the content type.
 * @param {function} getLatestLibraryVersion Function that returns the latest library version.
 * @param {object} [targetVersion] Optional target version to upgrade to. If not provided, all upgrade functions for newer versions will be applied.
 * @returns {object} Upgraded content parameters.
 */
const processField = (params, getUpgradesScript, getLatestLibraryVersion, targetVersion) => {
  const isGroup = typeof params === 'object' && params !== null;
  if (isGroup) {
    const isLibraryField = params.library && params.params;
    if (isLibraryField) {
      // Upgrade child parameters recursively first (depth-first)
      params.params = processField(params.params, getUpgradesScript, getLatestLibraryVersion, targetVersion);

      const { machineName, majorVersion, minorVersion } = buildLibraryInfo(params.library);

      const processed = processParams(
        params.params,
        params.metadata,
        getUpgradesScript(machineName),
        { major: majorVersion, minor: minorVersion },
        targetVersion
      );

      const versionFunction = (targetVersion?.major && targetVersion?.minor) ?
        () => targetVersion :
        getLatestLibraryVersion;

      params.library = upgradeLibrary(params.library, versionFunction);
      params.params = processed.params;
      params.metadata = processed.metadata;

      return params;
    }
    else {
      // Process all group fields recursively
      for (const key in params) {
        params[key] = processField(params[key], getUpgradesScript, getLatestLibraryVersion, targetVersion);
      }

      return params;
    }
  }
  else if (Array.isArray(params)) {
    // Process list items fields recursively
    return params.map(item => processField(item, getUpgradesScript, getLatestLibraryVersion, targetVersion));
  }

  return params;
}

/**
 * Build library information from a versioned name string (like H5P core for content types).
 * @param {string} versionedName The versioned name string in the format 'machine
 * @returns {object} An object containing the libraryInfo.
 */
const buildLibraryInfo = (versionedName) => {
  // if versioned name is not a string and does not match 'machineName version' format, throw an error
  if (typeof versionedName !== 'string' || !/^[\w0-9\-\.]{1,255}\s\d+\.\d+$/.test(versionedName)) {
    throw new Error(`Invalid versioned name: ${versionedName}`);
  }

  const [machineName, version] = versionedName.split(' ', 2);
  const [majorVersion, minorVersion] = version.split('.').map(Number);
  const versionedNameNoSpaces = versionedName.replace(/\s/g, '');

  return { machineName, majorVersion, minorVersion, versionedName, versionedNameNoSpaces };
}

/**
 * Process parameters using the provided upgrade functions.
 * @param {object} params The content parameters to upgrade.
 * @param {object} metadata Metadata associated with the content.
 * @param {object} upgradeFunctions The upgrade functions organized by major and minor versions.
 * @param {object} currentVersion The current version of the content parameters.
 * @param {object} [targetVersion] Optional target version to upgrade to. If not provided, all upgrade functions for newer versions will be applied.
 * @returns {object} Upgraded content parameters and metadata.
 */
const processParams = (params, metadata, upgradeFunctions, currentVersion, targetVersion) => {
  for (let major in upgradeFunctions) {
    const majorInt = parseInt(major);
    if (currentVersion.major > majorInt) {
      continue; // Skip, as upgrade function is for older major versions than current
    }

    if (targetVersion && targetVersion.major < majorInt) {
      continue; // Skip, as upgrade function is for newer major versions than target
    }

    for (let minor in upgradeFunctions[major]) {
      const minorInt = parseInt(minor);

      if (currentVersion.major === majorInt && currentVersion.minor >= minorInt) {
        continue; // Skip, as upgrade function is for older minor versions than current
      }

      if (targetVersion && targetVersion.major === majorInt && targetVersion.minor < minorInt) {
        continue; // Skip, as upgrade function is for newer minor versions than target
      }

      const upgraded = upgradeParams(params, upgradeFunctions[major][minor], { metadata: metadata });

      params = upgraded.params;
      metadata = upgraded.extras.metadata;
    }
  }

  return { params, metadata };
};

/**
 * Upgrade content parameters using the provided upgrade function.
 * @param {object} params The content parameters to upgrade.
 * @param {function} upgradeFunction The function that performs the upgrade.
 * @param {object} extras Optional extra data for the upgrade process.
 * @returns {object} Upgraded parameters and extras, or original values if error occurred.
 */
const upgradeParams = (params, upgradeFunction, extras = {}) => {
  if (!params || typeof upgradeFunction !== 'function') {
    console.error('>>> Invalid parameters or upgrade function');
    return { params, extras };
  }

  // In theory, we could just modify the values directly, but to avoid side effects ...
  const clonedParams = JSON.parse(JSON.stringify(params));
  const clonedExtras = JSON.parse(JSON.stringify(extras));

  const result = { params: clonedParams, extras: clonedExtras, error: null };

  try {
    // Pass everything to content type's upgrade function without replication callback chaining from H5P core.
    upgradeFunction(
      clonedParams,
      (error, upgradedParams, upgradedExtras) => {
        if (error) {
          result.error = error;
        }
        else if (upgradedParams) {
          result.params = upgradedParams;

          if (upgradedExtras?.metadata) {
            result.extras.metadata = upgradedExtras.metadata;
          }
        }
      },
      clonedExtras
    );
  }
  catch (error) {
    result.error = error;
  }

  if (result.error) {
    console.error(`>>> Error during upgrade: ${result.error.name} ${result.error.message}`);
    console.error(result.error.stack);

    return {
      params: clonedParams,
      extras: clonedExtras
    };
  }

  return {
    params: result.params,
    extras: result.extras
  };
};

/**
 * Upgrade library string to the new version.
 * @param {string} versionedName The versioned name string in the format 'machineName version'.
 * @param {function} getLatestLibraryVersion Function that returns the latest library version.
 * @param {number} major The new major version number.
 * @param {number} minor The new minor version number.
 * @returns {string} Upgraded library name.
 */
upgradeLibrary = (versionedName, getLatestLibraryVersion) => {
  const machineName = versionedName.split(' ')[0];
  const latestVersion = getLatestLibraryVersion(machineName);
  return `${machineName} ${latestVersion.major}.${latestVersion.minor}`;
};

module.exports = {
  upgradeContent,
};
