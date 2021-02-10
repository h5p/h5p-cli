const defaultFileName = process.env.H5P_DEFAULT_PACK || 'libraries.h5p';
const h5p = require('../h5p');

class Input {

  /**
   * Input list
   * @param {Array} inputList List of inputs
   */
  constructor(inputList = []) {
    this.inputList = inputList;

    this.flags = this.inputList.filter(Input.isFlag);
    this.fileNames = this.inputList.filter(Input.isFileName);

    this.remainingInputs = this.inputList
      .filter(x => !Input.isFlag(x))
      .filter(x => !Input.isFileName(x));
  }

  init(skipCheck = false) {
    return h5p.findDirectories(skipCheck)
      .then((dirs) => {
        if (this.remainingInputs.indexOf('*') >= 0) {
          this.libraries = dirs;
          this.remainingInputs = this.remainingInputs.filter(i => {
            return i !== '*';
          });
        }
        else {
          this.libraries = this.remainingInputs
            .map(Input.removeTrailingDash)
            .filter(x => Input.isLibrary(x, dirs));
        }

        this.languages = this.remainingInputs
          .filter(x => this.libraries.indexOf(x) < 0);
      });
  }

  /**
   * Determines if input contains flag
   * @param {string|Array} flag Flag as a string, e.g. '-r'
   * @return {boolean} True if flag was found
   */
  hasFlag(flag) {
    if (Array.isArray(flag)) {
      return flag.reduce((prev, singleFlag) => {
        return prev || this.flags.indexOf(singleFlag) >= 0;
      }, false);
    }

    return this.flags.indexOf(flag) >= 0;
  }

  /**
   * Get file name from input, or default file name
   * @return {string} File name
   */
  getFileName() {
    if (this.fileNames.length) {
      return this.fileNames[this.fileNames.length - 1];
    }
    else {
      return defaultFileName;
    }
  }

  /**
   * Get libraries from input if it was provided.
   * @return {Array} Libraries
   */
  getLibraries() {
    return this.libraries;
  }

  getLanguages() {
    return this.languages;
  }

  /**
   * Check if input string is a flag
   * @param {string} input String to check if is flag
   * @return {boolean} True if input is a flag
   */
  static isFlag(input) {
    return input.charAt(0) === '-';
  }

  /**
   * Checks if input is a file name
   * @param {string} input String to check if is file name
   * @return {Boolean} True if input is a file name
   */
  static isFileName(input) {
    return input.match(/\.h5p$/) !== null;
  }

  static isLibrary(input, directories) {
    return directories.indexOf(input) >= 0;
  }

  /**
   * Remove trailing dash from input
   * @param {string} input Input string
   * @return {string} Input without trailing dash
   */
  static removeTrailingDash(input) {
    if (input.charAt(input.length - 1) === '/') {
      input = input.substr(0, input.length - 1);
    }

    return input;
  }
}

module.exports = Input;
