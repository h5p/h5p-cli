const Input = require('../input');
require('jasmine-node');

describe('Input', () => {
  describe('File name', () => {
    it('should return the h5p output name from array', () => {
      const inputList = ['test.h5p'];
      const input = new Input(inputList);
      expect(input.getFileOutputName()).toEqual('test.h5p');
    });

    it('should find file name inside array', () => {
      const inputList = ['hello', 'test', 'filename.h5p', 'h5p-test'];
      const input = new Input(inputList);
      expect(input.getFileOutputName()).toEqual('filename.h5p');
    });

    it('should return a default name when nothing is supplied', () => {
      const inputList = ['h5p-interactive-video', 'h5p-course-presentation'];
      const input = new Input(inputList);
      const fileName = input.getFileOutputName();
      expect(fileName.match(/\.h5p/).length).toBeTruthy();
    });

    it('should return the last argument when more than one is supplied', () => {
      const inputList = ['first.h5p', 'second.h5p', 'last.h5p', 'h5p-invalid'];
      const input = new Input(inputList);
      expect(input.getFileOutputName()).toBe('last.h5p');
    })
  });
});
