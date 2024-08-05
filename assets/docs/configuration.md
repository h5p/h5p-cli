# Configuration
You can optionally update the default [config.js](../../config.js) variables by creating a JS file named `config.js` in your development environment directory.
## Example
```
const config = require(`${require.main.path}/config.js`);

// user config
config.saveFreq = 15;
// end of user config

module.exports = config;
```
This will update the `saveFreq` variable to `15`.
