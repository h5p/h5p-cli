const pack = require('../../lib/commands/pack');
const output = require('../../lib/utility/output');
const h5p = require('../../lib/h5p');
const repository = require('../../lib/utility/repository');
const input = require('../../lib/utility/input');

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
    it('should say that you must specify libraries', done => {
      pack().then(() => {
        expect(output.printLn).toHaveBeenCalled();
        expect(h5p.pack).not.toHaveBeenCalled();
        done();
      });
    });
  });

  it('should print library being packed when specifying one lib', done => {
    pack('h5p-course-presentation')
      .then(() => {
        expect(output.printLn).toHaveBeenCalled();
        expect(output.printLn.calls.allArgs()).toMatch('1');
        done();
    });
  });

  it('should print libraries being packed when specifying two libs', done => {
    pack('h5p-course-presentation', 'h5p-interactive-video')
      .then(() => {
        expect(output.printLn).toHaveBeenCalled();
        expect(output.printLn.calls.allArgs()).toMatch('1');
        done();
    });
  });

  describe('recursive', () => {
    it('should be used if specified', (done) => {
      h5p.pack.and.callFake(done);
      pack('-r', 'h5p-course-presentation');
    });

    it('should not be used if not specified', done => {
      pack('h5p-course-presentation')
        .then(() => {
          expect(h5p.pack.calls.mostRecent().args)
            .toContain(['h5p-course-presentation']);
          done();
        });
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
    });
  });
});
