WebCola
=======

JavaScript constraint based layout for high-quality graph visualization and exploration 
using D3.js and other web-based graphics libraries.  
[Homepage with examples](http://marvl.infotech.monash.edu/webcola)

Installation
------------

A version suitable for browsers can be found [here](WebCola/cola.js) ([minified](WebCola/cola.min.js)).

You can also install it through npm by first adding it to `package.json`:

    "dependencies": {
      "cola": "tgdwyer/WebCola#master"
    }

Then by running `npm install`.

If you use TypeScript, you can get complete TypeScript definitions by installing [tsd 0.6](https://github.com/DefinitelyTyped/tsd) and running `tsd link`.

Building
--------

*Linux/Mac/Windows Command Line:*

 - install [node.js](http://nodejs.org)
 - install grunt from the command line using npm (comes with node.js):

        npm install -g grunt-cli

 - from the WebCola directory:

        npm install

 - build, minify and test:

        grunt

This creates the `cola.js` and `cola.min.js` files in the `WebCola` directory, generates `index.js` for npm, and runs tests.

*Visual Studio:*

 - get the [typescript plugin](http://www.typescriptlang.org/#Download)
 - open webcola.sln

Running
-------

*Linux/Mac/Windows Command Line:*

Install the Node.js http-server module:

    npm install -g http-server

After installing http-server, we can serve out the example content in the WebCola directory.

    http-server WebCola

The default configuration of http-server will serve the exampes on [http://localhost:8080](http://localhost:8080).
