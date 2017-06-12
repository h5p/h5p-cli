const pull = require('../../lib/commands/pull');
const h5p = require('../../lib/h5p');

describe('Pull', () => {
  it('should run h5p update with libraries', (done) => {
    const h5pupdate = spyOn(h5p, 'update');
    spyOn(h5p, 'findDirectories').and
      .returnValue(Promise.resolve('h5p-course-presentation'));
    const inputList = 'h5p-course-presentation';
    pull(inputList)
      .then(() => {
        expect(h5pupdate)
          .toHaveBeenCalledWith(['h5p-course-presentation'], jasmine.any(Function));
        done();
      });
  });
});
