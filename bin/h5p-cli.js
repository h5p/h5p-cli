#!/usr/bin/env node
const utils = require('../assets/utils/cli.js');
if (typeof utils[process.argv[2]] == 'function') {
  utils[process.argv[2]].apply(null, process.argv.slice(3));
}
else {
  console.log(`> "${process.argv[2]}" is not a valid command`);
}
