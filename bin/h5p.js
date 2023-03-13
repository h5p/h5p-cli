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
setupFolders();
const utils = require('../cli.js');
