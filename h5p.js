#!/usr/bin/env node
const fs = require('fs');
const setupFolders = () => {
  const list = ['cache', 'content', 'temp', 'libraries', 'uploads'];
  for (let item of list) {
    if (!fs.existsSync(item)) {
      fs.mkdirSync(item);
    }
  }
}
if (process.argv[2] && process.argv[2] != 'utils') {
  setupFolders();
}
require('./cli.js');
