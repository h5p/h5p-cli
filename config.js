module.exports = {
  port: 8080,
  folders: {
    assets: 'assets',
    lib: 'libraries',
    cache: 'cache',
    uploads: 'uploads'
  },
  urls: {
    registry: 'https://raw.githubusercontent.com/h5p/h5p-registry/main/libraries.json',
    library: {
      language: 'https://raw.githubusercontent.com/{org}/{dep}/master/language/en.json',
      semantics: 'https://raw.githubusercontent.com/{org}/{dep}/master/semantics.json',
      info: 'https://raw.githubusercontent.com/{org}/{dep}/master/library.json'
    }
  }
}
