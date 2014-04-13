# WebCola

[![build status][]][travis]
[travis]: https://travis-ci.org/bollwyvl/WebCola
[build status]: https://travis-ci.org/bollwyvl/WebCola.svg

Javascript constraint based layout for high-quality graph visualization and exploration 
using D3.js and other web-based graphics libraries.  
[Homepage with examples](http://marvl.infotech.monash.edu/webcola)

## Building


### Linux/Mac/Windows Command Line

 - install [node.js](http://nodejs.org)
 - install grunt and bower from the command line using npm (comes with node.js):

~~~~shell
npm install -g grunt-cli bower
~~~~

- in the WebCola directory, install the frontend and backend dependencies:
~~~~bash
npm install
bower install
~~~~

- build, minify and test (`dist/cola.js` and `dist/cola.min.js`, `dist/data/`, and `dist/test/` awill be  created):
~~~~bash
grunt
~~~~

- build the rest of `dist/`: `dist/api/`, `dist/examples/`:
~~~~bash
grunt site
~~~~

- watch all files (source and site) and rebuild as necessary
~~~~bash
grunt watch
~~~~

### Releasing the site
- `dist/` is a submodule, pointing at the `gh-pages` branch. by clearing `dist/` away, you can link these up with:
- TODO: automate
~~~~bash
rm -rf dist
git submodule update --init
grunt full
cd dist
git add .
git commit -m "New version of site"
git push origin gh-pages
cd ..
git add dist
git commit -m "New version of site"
git push origin master
~~~~

### Visual Studio
TBD

 - get the [typescript plugin](http://www.typescriptlang.org/#Download)
 - open webcola.sln
