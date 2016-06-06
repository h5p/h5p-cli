## H5P Command Line Interface

A tool that simplifies the development process of [H5P](https://h5p.org) (HTML5 Packages).

The H5P development documentation is found on [h5p.org/developers](https://h5p.org/developers)

Note that this tool is still in alpha!

## Install

`sudo npm install -g h5p`

Make sure ssh-agent is running and that `ssh -T git@github.com` works.

## H5P developer server

The H5P cli tool makes it possible to run a H5P development server using node.js. The server needs some input to be able to start. This input should be placed in a h5p-server.json file, and must contain the following:

```javascript
{
  "host": "localhost",
  "port": 8080,
  "libraryDir": "<name of directory where libraries are found>",
  "mainLibraryDir": "<the directory where the main library is found>",
  "contentDir": "<the directory where content is found>"
}
```
An example of the complete directory structure is found below:
```
.
├── h5p-server.json
├── h5p-content
│   ├── blanks
│      ├── blanks-example-1
│         ├── content.json
│      ├── blanks-example-2
|         ├── content.json
├── h5p-libs
│   ├── h5p-blanks
│   ├── h5p-question
│   ├── <...>
```
With the above example structure, the h5p-server.json below is created to be able to view the Fill in the blanks H5Ps (located in the h5p-content/blanks directory):
```javascript
{
  "host": "localhost",
  "port": 8080,
  "libraryDir": "h5p-libs",
  "mainLibraryDir": "h5p-blanks",
  "contentDir": "h5p-content/blanks"
}
```
To start the H5P development server with the above setup, run the following command from within the directory the h5p-server.json file is located:

`h5p server`

The development server should now be available at http://localhost:8080

## License

(The MIT License)

Copyright (c) 2013 Joubel AS

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
