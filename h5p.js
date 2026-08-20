#!/usr/bin/env node
const fs = require('fs');
const setupFolders = () => {
  const list = ['content', 'temp', 'libraries', 'uploads'];
  for (let item of list) {
    if (!fs.existsSync(item)) {
      fs.mkdirSync(item);
    }
  }
}
if (['core', 'setup', 'clone', 'install'].includes(process.argv[2])) {
  setupFolders();
}
require('./cli.js');
