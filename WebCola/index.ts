/**
 * When compiled, this file will build a CommonJS module for WebCola.
 *
 * Unfortunately, internal and external TypeScript modules do not get
 * along well. This method of converting internal modules to external
 * modules is a bit of a hack, but is minimally invasive (i.e., no modules
 * need to be rewritten as external modules and modules can still span
 * multiple files)
 *
 * When starting a new project from scratch where CommonJS compatibility
 * is desired, consider instead preferring external modules to internal
 * modules.
 */

// In the current context, build the "cola" object we want to export.
///<reference path="./src/d3adaptor.ts"/>
///<reference path="./src/descent.ts"/>
///<reference path="./src/geom.ts"/>
///<reference path="./src/gridrouter.ts"/>
///<reference path="./src/handledisconnected.ts"/>
///<reference path="./src/layout.ts"/>
///<reference path="./src/layout3d.ts"/>
///<reference path="./src/linklengths.ts"/>
///<reference path="./src/powergraph.ts"/>
///<reference path="./src/pqueue.ts"/>
///<reference path="./src/rectangle.ts"/>
///<reference path="./src/shortestpaths.ts"/>
///<reference path="./src/vpsc.ts"/>
///<reference path="./src/rbtree.ts"/>

// Declare this a CommonJS environment. Environments such as Node, Webpack,
// Browserify, and React Native define the module module as such:
declare var require: {
    (id: string): any;
    resolve(id:string): string;
    cache: any;
    extensions: any;
    main: any;
};

declare var module: {
    exports: any;
    require(id: string): any;
    id: string;
    filename: string;
    loaded: boolean;
    parent: any;
    children: any[];
};

// Export cola as a CommonJS module. Note that we're bypassing TypeScript's external
// module system here. Because internal modules were written with the browser in mind,
// TypeScript's model is that the current context is the global context (i.e., window.cola
// === cola), so `export = cola` is transpiled as a no-op.
module.exports = cola;
