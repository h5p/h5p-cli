const Output = require('../../lib/utility/output');

describe('Output', () => {
  beforeEach(() => {
    this.outputSpy = spyOn(process.stdout, 'write');
  });

  it('should print error', () => {
    const error = 'An error message';
    Output.printError(error);
    expect(this.outputSpy.calls.allArgs()).toMatch(error);
  });

  it('should print a message', () => {
    const msg = 'A message';
    Output.printLn(msg);
    expect(this.outputSpy.calls.allArgs()).toMatch(msg);
  });

  describe('repositories', () => {
    beforeEach(() => {
      this.repo = {
        name: 'testRepo'
      };
    });

    it('should output repo name and fail msg if failed', () => {
      this.repo.failed = true;
      Output.printResults(this.repo);
      expect(this.outputSpy.calls.allArgs()).toMatch(this.repo.name);
      expect(this.outputSpy.calls.allArgs()).toMatch(/FAILED/);
    });

    it('should output repo name and SKIPPED msg if skipped', () => {
      this.repo.skipped = true;
      Output.printResults(this.repo);
      expect(this.outputSpy.calls.allArgs()).toMatch(this.repo.name);
      expect(this.outputSpy.calls.allArgs()).toMatch(/SKIPPED/);
    });

    it('should output repo name and OK msg if skipped', () => {
      Output.printResults(this.repo);
      expect(this.outputSpy.calls.allArgs()).toMatch(this.repo.name);
      expect(this.outputSpy.calls.allArgs()).toMatch(/OK/);
    });

    it('should output message if supplied', () => {
      this.repo.msg = 'hello ?';
      Output.printResults(this.repo);
      expect(this.outputSpy.calls.allArgs()).toMatch(this.repo.msg);
    });

    it('should be able to output multiple repositories', () => {
      const secondRepo = {
        name: 'secondRepo',
        msg: 'world !'
      };
      this.repo.msg = 'hello ?';

      const repositories = [
        this.repo,
        secondRepo
      ];

      Output.printResults(repositories);
      expect(this.outputSpy.calls.allArgs()).toMatch(this.repo.msg);
      expect(this.outputSpy.calls.allArgs()).toMatch(secondRepo.msg);
    });
  });
});
