const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const { after, before, test } = require('node:test');
const express = require('express');
// Removal needs no editor translations or installed H5P core libraries.
const languageCatcher = require.resolve('./assets/languageCatcher.js');
require.cache[languageCatcher] = {
  id: languageCatcher,
  filename: languageCatcher,
  loaded: true,
  exports: {}
};
const api = require('./api.js');
const validateContentFolder = require('./content-folder.js');

let server;
let origin;
before(async () => {
  const app = express();
  app.param('folder', validateContentFolder);
  app.post('/remove/:folder', api.remove);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

for (const folder of [
  '..',
  '.',
  '',
  '../victim',
  '..\\victim',
  'nested/lesson',
  'nested\\lesson',
  '/tmp/victim',
  'C:\\victim',
  'lesson:stream',
  'lesson\0',
  '.. ',
  'lesson.'
]) {
  test(`rejects unsafe folder ${JSON.stringify(folder)} before deletion`, (t) => {
    const remove = t.mock.method(fs, 'rmSync', () => {});
    let status = 200;
    const response = {
      status(code) {
        status = code;
        return this;
      },
      set() {
        return this;
      },
      json() {
        return this;
      },
      end() {}
    };

    const request = { params: { folder } };
    validateContentFolder(request, response, () => api.remove(request, response), folder);

    assert.equal(status, 400);
    assert.equal(remove.mock.callCount(), 0);
  });
}

for (const encoded of ['..%2F..%2Fvictim', '..%5C..%5Cvictim']) {
  test(`rejects traversal decoded from an Express route parameter: ${encoded}`, async (t) => {
    const remove = t.mock.method(fs, 'rmSync', () => {});
    const response = await fetch(`${origin}/remove/${encoded}`, {
      method: 'POST'
    });

    assert.equal(response.status, 400);
    assert.equal(remove.mock.callCount(), 0);
  });
}

for (const folder of ['lesson-1', 'lesson_1.0', 'my lesson', 'Leçon']) {
  test(`still removes valid content folder ${folder}`, async (t) => {
    const remove = t.mock.method(fs, 'rmSync', () => {});
    const response = await fetch(`${origin}/remove/${encodeURIComponent(folder)}`, {
      method: 'POST'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { result: `removed "content/${folder}"` });
    assert.equal(remove.mock.callCount(), 1);
    assert.deepEqual(remove.mock.calls[0].arguments, [
      `content/${folder}`,
      { recursive: true, force: true }
    ]);
  });
}
