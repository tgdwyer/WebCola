import * as d3v3 from './d3v3adaptor'
import * as d3v4 from './d3v4adaptor'
import { Layout, EventType, Event } from './layout';

export interface D3v3Context { version:string };

export interface ID3StyleLayoutAdaptor {
    trigger(e: Event): void;
    kick(): void;
    drag: () => any;

    on(eventType: EventType | string, listener: () => void): ID3StyleLayoutAdaptor;
}


/**
 * provides an interface for use with d3:
 * Correct way to create way to construct the d3 cola object is to pass the d3 object into the adaptor function, like so:
 * 
 *   `var d3cola = cola.d3adaptor(d3);`
 * 
 * Internally, it will figure out if d3 is version 3 or 4 from the version tag and set up the right event forwarding. Defaults to version 3 if the d3 object is not passed.
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
export function d3adaptor(d3Context?: d3v4.D3Context | D3v3Context): Layout & ID3StyleLayoutAdaptor {
    if (!d3Context || isD3V3(d3Context)) {
        return new d3v3.D3StyleLayoutAdaptor();
    }
    return new d3v4.D3StyleLayoutAdaptor(d3Context);
}

function isD3V3(d3Context: d3v4.D3Context | D3v3Context): d3Context is D3v3Context {
    const v3exp = /^3\./;
    return (<any>d3Context).version && (<any>d3Context).version.match(v3exp) !== null;
}
