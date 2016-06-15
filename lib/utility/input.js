const defaultFileName = process.env.H5P_DEFAULT_PACK || 'libraries.h5p';

class Input {

  /**
   * Input list
   * @param {Array} inputList List of inputs
   */
  constructor(inputList = []) {
    this.flags = inputList.filter(Input.isFlag);
    this.fileNames = inputList.filter(Input.isFileName);
    this.libraries = inputList
      .filter(x => !Input.isFlag(x))
      .filter(x => !Input.isFileName(x));
  }

  /**
   * Determines if input contains flag
   * @param {string} flag Flag as a string, e.g. '-r'
   * @return {boolean} True if flag was found
   */
  hasFlag(flag) {
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
}

module.exports = Input;
