/**
 * Helps run procecss task on all items in parallel.
 * TODO: In the future support objects as well?
 *
 * @private
 * @param {Array} arr item container
 * @param {Function} process task
 * @param {Function} finished callback
 */
const parallel = (arr, process, finished) => {
  var results = [];

  /**
   * Callback for when processing is done
   *
   * @private
   * @param {Object} status
   */
  var done = function (status) {
    results.push(status);
    if (results.length === arr.length) {
      finished(null, results);
    }
  };

  for (var i = 0; i < arr.length; i++) {
    process(i, arr[i], done);
  }
};

module.exports = parallel;
