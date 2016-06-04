const defaultFileName = process.env.H5P_DEFAULT_PACK || 'libraries.h5p';

class Input {
  constructor(inputList) {
    this.flags = inputList.filter(Input.isFlag);
    this.fileNames = inputList.filter(Input.isFileName);
    this.libraries = inputList
      .filter(x => !Input.isFlag(x))
      .filter(x => !Input.isFileName(x));
  }

  hasFlag(flag) {
    return this.flags.indexOf(flag) >= 0;
  }

  getFileName() {
    if (this.fileNames.length) {
      return this.fileNames[this.fileNames.length - 1];
    }
    else {
      return defaultFileName;
    }
  }

  getLibraries() {
    return this.libraries;
  }

  static isFlag(input) {
    return input.charAt(0) === '-';
  }

  static isFileName(input) {
    return input.match(/\.h5p$/);
  }
}

module.exports = Input;
