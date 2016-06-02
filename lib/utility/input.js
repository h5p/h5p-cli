const defaultFileName = process.env.H5P_DEFAULT_PACK || 'libraries.h5p';

class Input {
  constructor(inputList) {
    this.flags = inputList.filter(Input.isFlag);
    this.outputName = inputList.filter(Input.isOutputName);
    this.libraries = inputList
      .filter(x => !Input.isFlag(x))
      .filter(x => !Input.isOutputName(x));
  }

  hasFlag(flag) {
    return this.flags.indexOf(flag) >= 0;
  }

  getFileOutputName() {
    if (this.outputName.length) {
      return this.outputName[this.outputName.length];
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

  static isOutputName(input) {
    return input.match(/\.h5p$/);
  }
}

module.exports = Input;
