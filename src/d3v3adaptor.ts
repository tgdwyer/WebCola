////<reference path="../extern/d3v3.d.ts"/>
////commented out the reference, because the path ended up in the typings, which
////makes it impossible import in other projects.
// declare const d3;


import {Layout, EventType, Event} from './layout';
import {ID3StyleLayoutAdaptor} from './d3adaptor'

    /**
     * @internal
     */
    export class D3StyleLayoutAdaptor extends Layout implements ID3StyleLayoutAdaptor {
        protected readonly event: any;

        trigger(e: Event) {
            var d3event = { type: EventType[e.type], alpha: e.alpha, stress: e.stress };
            this.event[d3event.type](d3event); // via d3 dispatcher, e.g. event.start(e);
        }

        // iterate layout using a d3.timer, which queues calls to tick repeatedly until tick returns true
        kick() {
            this.d3Context.timer(() => super.tick());
        }

        // a function to allow for dragging of nodes
        drag: () => any;

        private d3Context: any;

        constructor(d3Context: any = self.d3) {
            super();
            this.d3Context = d3Context;
            this.event = d3Context.dispatch(EventType[EventType.start], EventType[EventType.tick], EventType[EventType.end]);
            // bit of trickyness remapping 'this' so we can reference it in the function body.
            var d3layout = this;
            var drag;
            this.drag = function () {
                if (!drag) {
                    var drag = d3Context.behavior.drag()
                        .origin(Layout.dragOrigin)
                        .on("dragstart.d3adaptor", Layout.dragStart)
                        .on("drag.d3adaptor", d => {
                            Layout.drag(d, <any>d3layout.d3Context.event);
                            d3layout.resume(); // restart annealing
                        })
                        .on("dragend.d3adaptor", Layout.dragEnd);
                }

                if (!arguments.length) return drag;

                // this is the context of the function, i.e. the d3 selection
                this//.on("mouseover.adaptor", colaMouseover)
                //.on("mouseout.adaptor", colaMouseout)
                    .call(drag);
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
