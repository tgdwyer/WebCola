//import "../behavior/drag";
//import "../core/identity";
//import "../core/rebind";
//import "../event/event";
//import "../event/dispatch";
//import "../event/timer";
//import "../geom/quadtree";
//import "layout";

d3.layout.cola = function() {
    var cola = {},
        event = d3.dispatch("start", "tick", "end"),
        size = [1, 1],
        drag,
        alpha,
        lastStress,
        nodes = [],
        links = [],
        constraints = [],
        distances,
        strengths,
        charges;

    cola.tick = function() {
        if (alpha < 0.00001) {
            event.end({ type: "end", alpha: alpha = 0 });
            delete lastStress;
            return true;
        }

        var n = nodes.length,
            m = links.length;

        var s1 = descent.rungeKutta();
        if (typeof lastStress !== 'undefined' && lastStress > s1) {
            alpha = lastStress / s1 - 1;
        }
        lastStress = s1;

        for (var o, i = 0; i < n; ++i) {
            o = nodes[i];
            if (o.fixed) {
                descent.x[i] = o.x = o.px;
                descent.y[i] = o.y = o.py;
            } else {
                o.x = descent.x[i];
                o.y = descent.y[i];
            }
        }

        event.tick({type: "tick", alpha: alpha});
    };

    cola.nodes = function(x) {
        if (!arguments.length) return nodes;
        nodes = x;
        return cola;
    };

    cola.links = function(x) {
        if (!arguments.length) return links;
        links = x;
        return cola;
    };

    cola.constraints = function (x) {
        if (!arguments.length) return constraints;
        constraints = x;
        return cola;
    }

    cola.size = function(x) {
        if (!arguments.length) return size;
        size = x;
        return cola;
    };

    cola.alpha = function(x) {
        if (!arguments.length) return alpha;

        x = +x;
        if (alpha) { // if we're already running
            if (x > 0) alpha = x; // we might keep it hot
            else alpha = 0; // or, next tick will dispatch "end"
        } else if (x > 0) { // otherwise, fire it up!
            event.start({type: "start", alpha: alpha = x});
            d3.timer(cola.tick);
        }

        return cola;
    };

    var xbuffer;
    cola.xproject = function (x) {
        //var vs = x.map(function (d, i) {
        //    var w = 1;
        //    if (nodes[i].fixed) {
        //        w = 1000;
        //        d = nodes[i].px;
        //    }
        //    return new vpsc.Variable(d, w);
        //});
        //var solver = new vpsc.Solver(vs, cs);
        //solver.solve();
        //vs.forEach(function (v, i) {
        //    x[i] = v.position();
        //});
        xbuffer = x;
    }
    cola.yproject = function (y) {
        var vs = y.map(function (d, i) {
            var w = 1;
            if (nodes[i].fixed) {
                w = 1000;
                d = nodes[i].py;
            }
            return new vpsc.Variable(d, w);
        });
        var cs = constraints.map(function (c) {
            return new vpsc.Constraint(vs[c.left], vs[c.right], c.gap, c.equality);
        });
        solver = new vpsc.Solver(vs, cs);
        solver.solve();
        vs.forEach(function (v, i) {
            y[i] = v.position();
        });
    }

    cola.yproject_disabled = function (y) {
        var x = xbuffer;
        var n = x.length;
        var rs = new Array(n);
        for (var i = 0; i < n; ++i) {
            var cx = x[i], cy = y[i];
            rs[i] = new vpsc.Rectangle(cx - 5, cx + 5, cy - 5, cy + 5);
        }
        var vs = x.map(function (d, i) {
            var w = 1;
            if (nodes[i].fixed) {
                w = 1000;
                d = nodes[i].px;
            }
            return new vpsc.Variable(d, w);
        });
        var cs = vpsc.generateXConstraints(rs, vs);
        var solver = new vpsc.Solver(vs, cs);
        solver.solve();
        vs.forEach(function (v, i) {
            var pos = v.position();
            rs[i].setXCentre(pos);
            x[i] = pos;
        });
        var vs = y.map(function (d, i) {
            var w = 1;
            if (nodes[i].fixed) {
                w = 1000;
                d = nodes[i].py;
            }
            return new vpsc.Variable(d, w);
        });
        var cs = constraints.map(function (c) {
            return new vpsc.Constraint(vs[c.left], vs[c.right], c.gap, c.equality);
        });
        cs = cs.concat(vpsc.generateYConstraints(rs, vs));
        solver = new vpsc.Solver(vs, cs);
        solver.solve();
        vs.forEach(function (v, i) {
            y[i] = v.position();
        });
    }

    cola.start = function() {
        var i,
            j,
            n = nodes.length,
            m = links.length,
            w = size[0],
            h = size[1],
            o;

        for (i = 0; i < n; ++i) {
            (o = nodes[i]).index = i;
            o.weight = 0;
        }

        var D = ShortestPaths.johnsons(n, links);
        for (var i = 0; i < n; ++i) {
            for (var j = 0; j < n; ++j) {
                D[i][j] *= 20;
            }
        }
        var x = new Array(n), y = new Array(n);
        for (var i = 0; i < n; ++i) {
            var v = nodes[i];
            x[i] = v.x = w / 2;
            y[i] = v.y = h / 2;
        }
        descent = new Descent(x, y, D);
        descent.xproject = cola.xproject;
        descent.yproject = cola.yproject;
        for (i = 0; i < m; ++i) {
            o = links[i];
            if (typeof o.source == "number") o.source = nodes[o.source];
            if (typeof o.target == "number") o.target = nodes[o.target];
        }


        return cola.resume();
    };

    cola.resume = function() {
        return cola.alpha(.1);
    };

    cola.stop = function() {
        return cola.alpha(0);
    };

    function d3_identity(d) {
        return d;
    }

    // use `node.call(cola.drag)` to make nodes draggable
    cola.drag = function() {
        if (!drag) drag = d3.behavior.drag()
            .origin(d3_identity)
            .on("dragstart.cola", d3_layout_forceDragstart)
            .on("drag.cola", dragmove)
            .on("dragend.cola", d3_layout_forceDragend);

        if (!arguments.length) return drag;

        this.on("mouseover.cola", d3_layout_forceMouseover)
            .on("mouseout.cola", d3_layout_forceMouseout)
            .call(drag);
    };

    function dragmove(d) {
        d.px = d3.event.x, d.py = d3.event.y;
        cola.resume(); // restart annealing
    }

    return d3.rebind(cola, event, "on");
};

// The fixed property has three bits:
// Bit 1 can be set externally (e.g., d.fixed = true) and show persist.
// Bit 2 stores the dragging state, from mousedown to mouseup.
// Bit 3 stores the hover state, from mouseover to mouseout.
// Dragend is a special case: it also clears the hover state.

function d3_layout_forceDragstart(d) {
    d.fixed |= 2; // set bit 2
}

function d3_layout_forceDragend(d) {
    d.fixed &= ~6; // unset bits 2 and 3
}

function d3_layout_forceMouseover(d) {
    d.fixed |= 4; // set bit 3
    d.px = d.x, d.py = d.y; // set velocity to zero
}

function d3_layout_forceMouseout(d) {
    d.fixed &= ~4; // unset bit 3
}