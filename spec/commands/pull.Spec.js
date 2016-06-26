const Pull = require('../../lib/commands/pull');
const h5p = require('../../lib/h5p');

describe('Pull', () => {
  it('should run h5p update with libraries', () => {
    const h5pupdate = spyOn(h5p, 'update');
    const inputList = 'h5p-course-presentation';
    new Pull(inputList);
    expect(h5pupdate)
      .toHaveBeenCalledWith(['h5p-course-presentation'], jasmine.any(Function));
  });
});
