///<reference path="../extern/d3.d.ts"/>
///<reference path="adaptor.ts"/>

module cola {
    export function d3adaptor() {
        var event = d3.dispatch("start", "tick", "end");
        var adaptor = new cola.adaptor({
            trigger: function (e) {
                event[e.type](e); // via d3 dispatcher, e.g. event.start(e);
            },

            on: function (type, listener) {
                event.on(type, listener);
                return adaptor;
            },

            kick: function (tick) {
                d3.timer(function () { return adaptor.tick(); });
            },

            // use `node.call(adaptor.drag)` to make nodes draggable
            drag: function () {
                var drag = d3.behavior.drag()
                    .origin(function (d) { return d; })
                    .on("dragstart.d3adaptor", colaDragstart)
                    .on("drag.d3adaptor", function (d) {
                    d.px = d3.event.x, d.py = d3.event.y;
                    adaptor.resume(); // restart annealing
                })
                    .on("dragend.d3adaptor", colaDragend);

                if (!arguments.length) return drag;

                this//.on("mouseover.adaptor", colaMouseover)
                //.on("mouseout.adaptor", colaMouseout)
                    .call(drag);
            }
        });

        return adaptor;
    };
}
