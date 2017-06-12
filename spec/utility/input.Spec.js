const Input = require('../../lib/utility/input');
describe('Input', () => {
  describe('with no arguments', () => {
    beforeEach(() => {
      this.input = new Input();
    });

    it('should be defined', () => {
      expect(this.input).toBeDefined();
    });

    it('should return false when asking for flag', () => {
      expect(this.input.hasFlag('-f')).toBeFalsy();
    });

    it('should return an empty array for libraries', () => {
      expect(this.input.getLibraries()).toEqual([]);
    })
  });

  describe('file name', () => {
    it('should return the h5p output name from array', () => {
      const inputList = ['test.h5p'];
      const input = new Input(inputList);
      expect(input.getFileName()).toEqual('test.h5p');
    });

    it('should find file name inside array', () => {
      const inputList = ['hello', 'test', 'filename.h5p', 'h5p-test'];
      const input = new Input(inputList);
      expect(input.getFileName()).toEqual('filename.h5p');
    });

    it('should return a default name when nothing is supplied', () => {
      const inputList = ['h5p-interactive-video', 'h5p-course-presentation'];
      const input = new Input(inputList);
      const fileName = input.getFileName();
      expect(fileName.match(/\.h5p/).length).toBeTruthy();
    });

    it('should return the last argument when more than one is supplied', () => {
      const inputList = ['first.h5p', 'second.h5p', 'last.h5p', 'h5p-invalid'];
      const input = new Input(inputList);
      expect(input.getFileName()).toBe('last.h5p');
    })
  });

  describe('flags', () => {
    beforeEach(() =>  {
      const inputList = ['test.h5p', 'lib1', 'lib2', '-r', '-g', 'somethingElse'];
      this.input = new Input(inputList);
    });
    it('should find a single flag among input', () => {
      expect(this.input.hasFlag('-r'))
    });

    it('should find multiple flags in input', () => {
      expect(this.input.hasFlag('-g')).toBeTruthy();
    });

    it('should not classify non-flags as flags', () => {
      // Non-existing flag
      expect(this.input.hasFlag('somethingElse')).toBeFalsy();
    });

    it('should return not find non-existing flags', () => {
      expect(this.input.hasFlag('non-existing')).toBeFalsy();
    });
  });

  describe('libraries', () => {
    beforeEach(() => {
      const inputList = ['h5p-course-presentation', 'test.h5p', '-r', 'h5p-interactive-video', 'custom-lib/'];
      const input = new Input(inputList);
      this.libraries = input.getLibraries();
    });

    it('should find a normal h5p library', () => {
      expect(this.libraries).toContain('h5p-course-presentation');
    });

    it('should find multiple h5p libraries', () => {
      expect(this.libraries).toContain('h5p-interactive-video');
    });

    it('should find custom libraries', () => {
      expect(this.libraries).toContain('custom-lib');
    });

    it('should not find file names', () => {
      expect(this.libraries).not.toContain('test.h5p');
    });

    it('should not find flags', () => {
      expect(this.libraries).not.toContain('-r');
    });

    it('should strip dashes from library names', () => {
      expect(this.libraries).toContain('custom-lib');
    });
  });
});
