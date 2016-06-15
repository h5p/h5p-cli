const pack = require('../../lib/commands/pack');
const output = require('../../lib/utility/output');
const h5p = require('../../lib/h5p');
const repository = require('../../lib/utility/repository');

describe('Pack', () => {
  beforeEach(() => {
    spyOn(output, 'printLn');
    spyOn(h5p, 'pack');
    spyOn(h5p, 'findDirectories').and
      .returnValue(Promise.resolve(['h5p-course-presentation']));
    spyOn(repository, 'getLibraryData').and
      .returnValue({});
  });

  describe('no args', () => {
    it('should say that you must specify libraries', () => {
      pack();
      expect(output.printLn).toHaveBeenCalled();
      expect(h5p.pack).not.toHaveBeenCalled();
    })
  });

  it('should print 1 library being packed when specifying one lib', () => {
    pack('h5p-course-presentation');
    expect(output.printLn).toHaveBeenCalled();
    expect(output.printLn.calls.allArgs()).toMatch('1');
  });

  it('should print 2 libraries being packed when specifying two libs', () => {
    pack('h5p-course-presentation', 'h5p-interactive-video');
    expect(output.printLn).toHaveBeenCalled();
    expect(output.printLn.calls.allArgs()).toMatch('2');
  });

  describe('recursive', () => {
    it('should be used if specified', (done) => {
      h5p.pack.and.callFake(done);
      pack('-r', 'h5p-course-presentation');
    });

    it('should not be used if not specified', () => {
      pack('h5p-course-presentation');
      expect(h5p.pack.calls.mostRecent().args)
        .toContain(['h5p-course-presentation']);
    });

    describe('with dependencies', () => {
      it('should not output dependencies if there are none', (done) => {
        h5p.pack.and.callFake(() => {
          expect(output.printLn.calls.allArgs()).not.toMatch('dependenc');
          done();
        });
        pack('-r', 'h5p-course-presentation');
      });

      it('should output one dependency', (done) => {
        h5p.pack.and.callFake(() => {
          expect(output.printLn.calls.allArgs()).toMatch('dependency');
          done();
        });
        h5p.findDirectories.and
          .returnValue(Promise.resolve(['h5p-course-presentation', 'dependency']));
        repository.getLibraryData.and.returnValues(
          {
            machineName: 'h5p-course-presentation',
            preloadedDependencies: [
              {
                machineName: 'dependency',
                majorVersion: 1,
                minorVersion: 0
              }
            ]
          },
          {
            machineName: 'dependency',
            majorVersion: 1,
            minorVersion: 0
          });
        pack('-r', 'h5p-course-presentation', 'not-a-lib');
      });

      it('should output multiple dependencies', (done) => {
        h5p.pack.and.callFake(() => {
          expect(output.printLn.calls.allArgs()).toMatch('dependencies');
          done();
        });

        h5p.findDirectories.and
          .returnValue(Promise.resolve(
            ['h5p-course-presentation', 'dependency', 'other-dependency']
          ));

        repository.getLibraryData.and.returnValues(
          {
            machineName: 'h5p-course-presentation',
            preloadedDependencies: [
              {
                machineName: 'dependency',
                majorVersion: 1,
                minorVersion: 0
              },
              {
                machineName: 'other-dependency',
                majorVersion: 2,
                minorVersion: 1
              }
            ]
          },
          {
            machineName: 'dependency',
            majorVersion: 1,
            minorVersion: 0
          },
          {
            machineName: 'other-dependency',
            majorVersion: 2,
            minorVersion: 1
          });

        pack('-r', 'h5p-course-presentation', 'h5p-hei');
      });

      it('should call pack with all libraries and dependencies', (done) => {
        h5p.pack.and.callFake(() => {
          expect(h5p.pack.calls.allArgs()).toMatch('h5p-course-presentation');
          expect(h5p.pack.calls.allArgs()).toMatch('invalid-library');
          expect(h5p.pack.calls.allArgs()).toMatch('h5p-new');
          expect(h5p.pack.calls.allArgs()).toMatch('h5p-multi-choice');
          expect(h5p.pack.calls.allArgs()).toMatch('h5p-mark-the-words');
          done()
        });

        h5p.findDirectories.and
          .returnValue(Promise.resolve(
            ['h5p-course-presentation', 'h5p-multi-choice', 'h5p-mark-the-words']
          ));

        repository.getLibraryData.and.returnValues(
          {
            machineName: 'h5p-course-presentation',
            preloadedDependencies: [
              {
                machineName: 'h5p-mark-the-words',
                majorVersion: 1,
                minorVersion: 10
              },
              {
                machineName: 'h5p-multi-choice',
                majorVersion: 2,
                minorVersion: 1
              }
            ]
          },
          {
            machineName: 'h5p-mark-the-words',
            majorVersion: 1,
            minorVersion: 10
          },
          {
            machineName: 'h5p-multi-choice',
            majorVersion: 2,
            minorVersion: 1
          });

        pack('-r', 'h5p-course-presentation', 'invalid-library', 'h5p-new');

      })
    });
  });

  describe('invalid library', () => {
    it('should be included in pack', () => {
      pack('h5p-invalid');
      expect(h5p.pack.calls.mostRecent().args).toContain(['h5p-invalid']);
    });

    it('should be included in recursive pack', (done) => {
      h5p.pack.and.callFake(done);
      pack('h5p-invalid');
      expect(h5p.pack.calls.mostRecent().args).toContain(['h5p-invalid']);
    });
  });
});
