#!/usr/bin/env node

/**
 * Load requirements.
 */
var cli = require('cli'); // TODO: Use more or just skip.
var h5p = require('../lib/h5p.js');

/**
 * Recursive cloning of all libraries in the collection.
 * Will print out status messages along the way.
 */
function clone() {
  var name = h5p.clone(function (error) {
    var status;
    if (error === -1) {
      status = '\x1B[33mSKIPPED\x1B[0m\n';
    }
    else if (error) {
      status = '\x1B[31mFAILED\x1B[0m: ' + error;
    }
    else {
      status = '\x1B[32mOK\x1B[0m\n';
    }

    cli.spinner(msg + status, true);
    clone();
  });
  if (!name) return; // Nothing to clone.
  var msg = 'Cloning into \'' + name + '\'... ';
  cli.spinner(msg);
}

/**
 * Command routing
 */
cli.main(function (args, options) {
  var that = this;
  var command = args.shift();
  if (!command) return this.error('No command specified.');
  
  switch (command) {
    case 'get':
      var library = args.shift();
      if (!library) return this.error('No library specified.');
      
      var msg = 'Loading dependencies for \'' + library + '\'... ';
      cli.spinner(msg);
      h5p.get(library, function (error) {
        cli.spinner(msg + 'done\n', true);
        if (error) return that.error(error);
        clone();
      });
      
      break;
      
    default:
      return this.error('Unknown command.');
  }
});
