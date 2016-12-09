import {dispatch} from 'd3-dispatch'
import {timer} from 'd3-timer'
import {drag as d3drag} from 'd3-drag'
import {Layout, EventType, Event} from './layout'

interface D3Context {
    timer: typeof timer; 
    drag: typeof d3drag; 
    dispatch: typeof dispatch;
    event: any;
}

export class D3StyleLayoutAdaptor extends Layout {
    event:any;
    trigger(e: Event) {
        var d3event = { type: EventType[e.type], alpha: e.alpha, stress: e.stress };
        // the dispatcher is actually expecting something of type EventTarget as the second argument
        // so passing the thing above is totally abusing the pattern... not sure what to do about this yet
        this.event.call(d3event.type, <any>d3event); // via d3 dispatcher, e.g. event.start(e);
    }

    // iterate layout using a d3.timer, which queues calls to tick repeatedly until tick returns true
    kick() {
        this.d3Context.timer(() => super.tick());
    }

    // a function to allow for dragging of nodes
    drag: () => any;

    constructor(private d3Context: D3Context) {
        super();
        this.event = d3Context.dispatch(EventType[EventType.start], EventType[EventType.tick], EventType[EventType.end]);

        // bit of trickyness remapping 'this' so we can reference it in the function body.
        var d3layout = this;
        var drag;
        this.drag = function () {
            if (!drag) {
                var drag = d3Context.drag()
                    .subject(Layout.dragOrigin)
                    .on("start.d3adaptor", Layout.dragStart)
                    .on("drag.d3adaptor", d => {
                        Layout.drag(<any>d, d3Context.event);
                        d3layout.resume(); // restart annealing
                    })
                    .on("end.d3adaptor", Layout.dragEnd);
            }

            if (!arguments.length) return drag;

            // this is the context of the function, i.e. the d3 selection
            //this//.on("mouseover.adaptor", colaMouseover)
            //.on("mouseout.adaptor", colaMouseout)
            arguments[0].call(drag);
        }
    }

    // a function for binding to events on the adapter
    on(eventType: EventType | string, listener: () => void): D3StyleLayoutAdaptor {
        if (typeof eventType === 'string') {
            this.event.on(eventType, listener);
        } else {
            this.event.on(EventType[eventType], listener);
        }
        return this;
    }
}

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
export function d3adaptor(d3Context: D3Context): D3StyleLayoutAdaptor {
    return new D3StyleLayoutAdaptor(d3Context);
}
