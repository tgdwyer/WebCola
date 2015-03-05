///<reference path="../extern/d3.d.ts"/>
///<reference path="layout.ts"/>

module cola {
    export class D3StyleLayoutAdaptor extends Layout {
        event = d3.dispatch(EventType[EventType.start], EventType[EventType.tick], EventType[EventType.end]);

        trigger(e: Event) {
            var d3event = { type: EventType[e.type], alpha: e.alpha, stress: e.stress };
            this.event[d3event.type](d3event); // via d3 dispatcher, e.g. event.start(e);
        }

        // iterate layout using a d3.timer, which queues calls to tick repeatedly until tick returns true
        kick() {
            d3.timer(() => super.tick());
        }
        
        // a function to allow for dragging of nodes
        drag: () => any;
        
        constructor() {
            super();
            // bit of trickyness remapping 'this' so we can reference it in the function body.
            var d3layout = this;
            this.drag = function () {
                var drag = d3.behavior.drag()
                    .origin(function (d) { return d; })
                    .on("dragstart.d3adaptor", Layout.dragStart)
                    .on("drag.d3adaptor",(d) => {
                    d.px = d3.event.x, d.py = d3.event.y;
                    d3layout.resume(); // restart annealing
                })
                    .on("dragend.d3adaptor", Layout.dragEnd);

                if (!arguments.length) return drag;

                // this is the context of the function, i.e. the d3 selection
                this//.on("mouseover.adaptor", colaMouseover)
                //.on("mouseout.adaptor", colaMouseout)
                    .call(drag);
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
    export function d3adaptor(): D3StyleLayoutAdaptor {
        return new D3StyleLayoutAdaptor();
    }
}
