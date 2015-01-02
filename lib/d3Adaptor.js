var d3 = require('d3');

var Adaptor = require('./adaptor')

module.exports = function () {
  var event = d3.dispatch("start", "tick", "end");

  var adaptor  = Adaptor({
    trigger: function (e) {
        event[e.type](e); // via d3 dispatcher, e.g. event.start(e);
    },

    on: function(type, listener){
        return event.on(type, listener);
    },

    kick: function (tick) {
        d3.timer(tick);
    },

    // use `node.call(adaptor.drag)` to make nodes draggable
    drag: function () {
        var drag = d3.behavior.drag()
            .origin(function(d){ return d; })
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
}

