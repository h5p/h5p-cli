/*********************************/
/* h5p-core overrides found here */
/*********************************/
(function ($) {
  /**
   * Find the path to the content files based on the id of the content.
   * Also identifies and returns absolute paths.
   *
   * @param {string} path
   *   Relative to content folder or absolute.
   * @param {number} contentId
   *   ID of the content requesting the path.
   * @returns {string}
   *   Complete URL to path.
   */
  H5P.getPath = function (path) {
    return H5PIntegration.url + '/' + path;
  };

  /**
   * Get the path to the library
   *
   * @param {string} library
   *   The library identifier in the format "machineName-majorVersion.minorVersion".
   * @returns {string}
   *   The full path to the library.
   */
  H5P.getLibraryPath = function (library) {
    // This is a hack - good enough for now.
    // Should have used a lookup-table (machine-name => directory-name)

    // Remove version info
    library = library.split('-')[0];

    // From CamelCase to kebab-case
    library = library.replace('H5P.', 'h5p');
    return "/libs/" + library.replace(/[A-Z]/g, '-$&').toLowerCase();
  };
}(H5P.jQuery));
