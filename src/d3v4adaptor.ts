import {dispatch} from 'd3-dispatch'
import {timer} from 'd3-timer'
import {drag as d3drag} from 'd3-drag'
import {Layout, EventType, Event} from './layout'
import {ID3StyleLayoutAdaptor} from './d3adaptor'

export interface D3Context {
    timer: typeof timer; 
    drag: typeof d3drag; 
    dispatch: typeof dispatch;
    event: any;
}

export class D3StyleLayoutAdaptor extends Layout implements ID3StyleLayoutAdaptor {
    event:any;
    trigger(e: Event) {
        var d3event = { type: EventType[e.type], alpha: e.alpha, stress: e.stress };
        // the dispatcher is actually expecting something of type EventTarget as the second argument
        // so passing the thing above is totally abusing the pattern... not sure what to do about this yet
        this.event.call(d3event.type, <any>d3event); // via d3 dispatcher, e.g. event.start(e);
    }

    // iterate layout using a d3.timer, which queues calls to tick repeatedly until tick returns true
    kick() {
        var t = this.d3Context.timer(() => super.tick() && t.stop());
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
    on(eventType: EventType | string, listener: () => void): this {
        if (typeof eventType === 'string') {
            this.event.on(eventType, listener);
        } else {
            this.event.on(EventType[eventType], listener);
        }
        return this;
    }
}
