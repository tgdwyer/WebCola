import * as d3v3 from './d3v3adaptor'
import * as d3v4 from './d3v4adaptor'

interface D3v3Context { version:string };

/**
 * provides an interface for use with d3:
 * - uses the d3 event system to dispatch layout events such as:
 *   o "start" (start layout process)
 *   o "tick" (after each layout iteration)
 *   o "end" (layout converged and complete).
 * - uses the d3 timer to queue layout iterations.
 * - sets up d3.behavior.drag to drag nodes
 *   o use `node.call(<the returned instance of Layout>.drag)` to make nodes draggable
 * returns an instance of the cola.Layout itself with which the user
 * can interact directly.
 */
export function d3adaptor(d3Context?: d3v4.D3Context | D3v3Context): d3v4.D3StyleLayoutAdaptor | d3v3.D3StyleLayoutAdaptor {
    if (!d3Context || isD3V3(d3Context)) {
        return new d3v3.D3StyleLayoutAdaptor();
    }
    return new d3v4.D3StyleLayoutAdaptor(d3Context);
}

function isD3V3(d3Context: d3v4.D3Context | D3v3Context): d3Context is D3v3Context {
    const v3exp = /^3\./;
    return (<any>d3Context).version && (<any>d3Context).version.match(v3exp) !== null;
}
