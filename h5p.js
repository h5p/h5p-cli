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
if (!['utils', 'help'].includes(process.argv[2] && process.argv[2])) {
  setupFolders();
}
require('./cli.js');
