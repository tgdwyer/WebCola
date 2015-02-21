///<reference path="../extern/d3.d.ts"/>
///<reference path="layout.ts"/>

module cola {
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
    export function d3adaptor() {
        var event = d3.dispatch("start", "tick", "end");
        var layout;
        var trigger = function (e) {
            event[e.type](e); // via d3 dispatcher, e.g. event.start(e);
        };
        var on = function (eventType, listener) {
            event.on(eventType, listener);
            return layout;
        };
        var kick = function (tick) {
            d3.timer(function () { return layout.tick(); });
        };
        var drag = function () {
            var drag = d3.behavior.drag()
                .origin(function (d) { return d; })
                .on("dragstart.d3adaptor", Layout.dragStart)
                .on("drag.d3adaptor", function (d) {
                d.px = d3.event.x, d.py = d3.event.y;
                layout.resume(); // restart annealing
            })
                .on("dragend.d3adaptor", Layout.dragEnd);

            if (!arguments.length) return drag;

            this//.on("mouseover.adaptor", colaMouseover)
            //.on("mouseout.adaptor", colaMouseout)
                .call(drag);
        };
        return layout = new Layout(trigger, on, kick, drag);
    }
}
