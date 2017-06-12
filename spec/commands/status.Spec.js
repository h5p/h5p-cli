const status = require('../../lib/commands/status');
const output = require('../../lib/utility/output');
const h5p = require('../../lib/h5p');
const repository = require('../../lib/utility/repository');

describe('Status', () => {

  beforeEach(() => {
    const directories = ['h5p-course-presentation', 'h5p-interactive-video'];
    spyOn(h5p, 'findDirectories').and
      .returnValue(Promise.resolve(directories));
  });

  it('should find directories', () => {
    status();
    expect(h5p.findDirectories).toHaveBeenCalled();
  });

  describe('Dirs changed', () => {
    beforeEach((done) => {
      const repoHasChanged = (repo) => {
        return Promise.resolve({
          branch: repo,
          changes: 'change'
        });
      };

      spyOn(repository, 'statusRepository').and
        .callFake(repoHasChanged);

      spyOn(output, 'printStatus').and
        .callFake(() => {
          setTimeout(() => {
            done();
          }, 0);
        });

      status();
    });

    it('should find directories', () => {
      expect(h5p.findDirectories).toHaveBeenCalled();
    });

    it('should output directories that have changed', () => {
      expect(repository.statusRepository).toHaveBeenCalledTimes(2);
      expect(output.printStatus).toHaveBeenCalledWith({
        branch: 'h5p-course-presentation',
        changes: 'change'
      });
      expect(output.printStatus).toHaveBeenCalledWith({
        branch: 'h5p-interactive-video',
        changes: 'change'
      });
    });
  });

  describe('Dirs unchanged', () => {
    beforeEach((done) => {
      const repoNotChanged = (repo) => {
        return Promise.resolve({
          branch: repo
        })
      };

      spyOn(repository, 'statusRepository').and
        .callFake(() => {
          repoNotChanged();
          setTimeout(() => {
            done();
          }, 0);
        });

      spyOn(output, 'printStatus');
      status();
    });

    it('should not output directories that have not changed', () => {

      expect(output.printStatus).not.toHaveBeenCalled();
    });
  });

  describe('Dirs has error', () => {
    beforeEach((done) => {
      const repoHasChanged = (repo) => {
        return Promise.resolve({
          branch: repo,
          error: 'error'
        });
      };

      spyOn(repository, 'statusRepository').and
        .callFake(repoHasChanged);

      spyOn(output, 'printStatus').and
        .callFake(() => {
          setTimeout(() => {
            done();
          }, 0);
        });

      status();
    });

    it('should output directories that have errors', () => {
      expect(repository.statusRepository).toHaveBeenCalledTimes(2);
      expect(output.printStatus).toHaveBeenCalledWith({
        branch: 'h5p-course-presentation',
        error: 'error'
      });
      expect(output.printStatus).toHaveBeenCalledWith({
        branch: 'h5p-interactive-video',
        error: 'error'
      });
    });
  });

  describe('directories unchanged with force flag', () => {

    beforeEach((done) => {
      const repoNotChanged = (repo) => {
        return Promise.resolve({
          branch: repo
        })
      };

      spyOn(repository, 'statusRepository').and
        .callFake(repoNotChanged);

      spyOn(output, 'printStatus').and
        .callFake(() => {
          setTimeout(() => {
            done();
          }, 0);
        });

      status('-f');
    });

    it('should output all directories', () => {
      expect(repository.statusRepository).toHaveBeenCalledTimes(2);
      expect(output.printStatus).toHaveBeenCalledWith({
        branch: 'h5p-course-presentation'
      });
      expect(output.printStatus).toHaveBeenCalledWith({
        branch: 'h5p-interactive-video'
      });
    });
  });

  describe('with libraries arguments', () => {
    beforeEach((done) => {
      spyOn(repository, 'statusRepository').and
        .callFake(() => {
          setTimeout(() => {
            done();
          }, 0);
        });
      status('h5p-course-presentation', 'not-a-library');
    });

    it('should not output non-existing libraries', () => {
      expect(repository.statusRepository).not
        .toHaveBeenCalledWith('not-a-library');
    });

    it('should output all specified libraries that exists in dir', () => {
      expect(repository.statusRepository)
        .toHaveBeenCalledWith('h5p-course-presentation');
    });

    it('should not output non-specified libraries', () => {
      expect(repository.statusRepository).not
        .toHaveBeenCalledWith('h5p-interactive-video');
    });
  });
});

