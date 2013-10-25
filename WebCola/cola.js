// to do:
//  - refactor x/yproject out of here
//  - in project functions use previous position as starting variable pos and descent pos as desired pos
//    o create variables with desired positions as previous positions and pass into solver constructor
//    o update desired positions for each var
//    o then call solve
//  - makefeasible:
//    o apply user constraints, then generated constraints
//  - autogenerate downward edge constraints with strongly connected components detection
//  - 3D! (add a third dimension to descent.ts and try out with three.js)
cola = function () {
    var cola = {};
    cola.d3adaptor = function () {
        var d3adaptor = {},
            event = d3.dispatch("start", "tick", "end"),
            size = [1, 1],
            linkDistance = 20,
            avoidOverlaps = false,
            drag,
            alpha,
            lastStress,
            nodes = [],
            links = [],
            constraints = [],
            distanceMatrix = [],
            distances = {},
            descent = {};

        d3adaptor.tick = function () {
            if (alpha < 0.00001) {
                event.end({ type: "end", alpha: alpha = 0 });
                delete lastStress;
                return true;
            }

            var n = nodes.length,
                m = links.length;

            var s1 = descent.rungeKutta();
            //var s1 = descent.reduceStress();
            if (typeof lastStress !== 'undefined' && lastStress > s1) {
                alpha = lastStress / s1 - 1;
            }
            lastStress = s1;

            for (var o, i = 0; i < n; ++i) {
                o = nodes[i];
                if (o.fixed) {
                    descent.x[0][i] = o.x = o.px;
                    descent.x[1][i] = o.y = o.py;
                } else {
                    o.x = descent.x[0][i];
                    o.y = descent.x[1][i];
                }
            }

            event.tick({ type: "tick", alpha: alpha });
        };

        d3adaptor.nodes = function (x) {
            if (!arguments.length) return nodes;
            nodes = x;
            return d3adaptor;
        };

        d3adaptor.avoidOverlaps = function (v) {
            if (!arguments.length) return avoidOverlaps;
            avoidOverlaps = v;
            return d3adaptor;
        }

        d3adaptor.links = function (x) {
            if (!arguments.length) return links;
            links = x;
            return d3adaptor;
        };

        d3adaptor.constraints = function (x) {
            if (!arguments.length) return constraints;
            constraints = x;
            return d3adaptor;
        }

        // the following does nothing, it's just here so that if people forget to remove the call when they switch from
        // d3 to cola, it does break the chaining.
        d3adaptor.charge = function (x) {
            if (!arguments.length) return 0;
            return d3adaptor;
        };

        d3adaptor.distanceMatrix = function (d) {
            if (!arguments.length) return distanceMatrix;
            distanceMatrix = d;
            return d3adaptor;
        }

        d3adaptor.size = function (x) {
            if (!arguments.length) return size;
            size = x;
            return d3adaptor;
        };

        d3adaptor.linkDistance = function (x) {
            if (!arguments.length) return linkDistance;
            linkDistance = typeof x === "function" ? x : +x;
            return d3adaptor;
        };

        d3adaptor.alpha = function (x) {
            if (!arguments.length) return alpha;

            x = +x;
            if (alpha) { // if we're already running
                if (x > 0) alpha = x; // we might keep it hot
                else alpha = 0; // or, next tick will dispatch "end"
            } else if (x > 0) { // otherwise, fire it up!
                event.start({ type: "start", alpha: alpha = x });
                d3.timer(d3adaptor.tick);
            }

            return d3adaptor;
        };

        var xbuffer;
        d3adaptor.xproject = function (x) {
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
        d3adaptor.yproject_disabled = function (y) {
            if (typeof constraints !== "undefined" && constraints.length > 0) {
                var vs = y.map(function (d, i) {
                    var w = 1;
                    if (nodes[i].fixed) {
                        w = 1000;
                        d = nodes[i].py;
                    }
                    return new vpsc.Variable(d, w);
                });
                var cs = constraints.filter(function (c) {
                    c.axis === "y"
                }).map(function (c) {
                    return new vpsc.Constraint(vs[c.left], vs[c.right], c.gap, c.equality);
                });
                solver = new vpsc.Solver(vs, cs);
                solver.solve();
                vs.forEach(function (v, i) {
                    y[i] = v.position();
                });
            }
        }

        d3adaptor.yproject = function (y) {
            var userConstraints = typeof constraints !== "undefined" && constraints.length > 0;
            if (!avoidOverlaps && !userConstraints) return;

            var x = xbuffer;
            var n = x.length;
            var rs = new Array(n);
            for (var i = 0; i < n; ++i) {
                var cx = x[i], cy = y[i];
                var v = nodes[i];
                var w2 = v.width / 2;
                var h2 = v.height / 2;
                rs[i] = new vpsc.Rectangle(cx - w2, cx + w2, cy - h2, cy + h2);
            }
            var vs = x.map(function (d, i) {
                var w = 1;
                if (nodes[i].fixed) {
                    w = 1000;
                    d = nodes[i].px;
                }
                return new vpsc.Variable(d, w);
            });
            var cs = avoidOverlaps ? vpsc.generateXConstraints(rs, vs) : [];
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

            var cs = [];
            if (typeof constraints !== "undefined" && constraints.length > 0) {
                cs = constraints.filter(function (c) {
                    return c.axis === "y"
                }).map(function (c) {
                    return new vpsc.Constraint(vs[c.left], vs[c.right], c.gap, c.equality);
                });
            }
            if (avoidOverlaps) {
                cs = cs.concat(vpsc.generateYConstraints(rs, vs));
            }
            solver = new vpsc.Solver(vs, cs);
            solver.solve();
            vs.forEach(function (v, i) {
                y[i] = v.position();
            });
        }
        function unionCount(a, b) {
            var u = {};
            for (var i in a) u[i] = {};
            for (var i in b) u[i] = {};
            return Object.keys(u).length;
        }

        function intersectionCount(a, b) {
            var n = 0;
            for (var i in a) if (typeof b[i] !== 'undefined') ++n;
            return n;
        }

        d3adaptor.symmetricDiffLinkLengths = function () {
            var w = 1;
            if (arguments.length > 0) {
                w = arguments[0];
            }
            computeLinkLengths(w, function (a, b) {
                return Math.sqrt(unionCount(a, b) - intersectionCount(a, b));
            });
            return d3adaptor;
        }

        d3adaptor.jaccardLinkLengths = function () {
            var w = 1;
            if (arguments.length > 0) {
                w = arguments[0];
            }
            computeLinkLengths(w, function (a, b) {
                if (Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1) return 0;
                return intersectionCount(a, b) / unionCount(a, b);
            });
            return d3adaptor;
        }

        computeLinkLengths = function (w, f) {
            var n = nodes.length;
            var neighbours = new Array(n);
            for (var i = 0; i < n; ++i) {
                neighbours[i] = {};
            }
            links.forEach(function (e) {
                neighbours[e.source][e.target] = {};
                neighbours[e.target][e.source] = {};
            });
            links.forEach(function (l) {
                var a = neighbours[l.source];
                var b = neighbours[l.target];
                //var jaccard = intersectionCount(a, b) / unionCount(a, b);
                //if (Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1) {
                //    jaccard = 0;
                //}
                //l.length = 1 + w * jaccard;
                l.length = 1 + w * f(a,b);
            });
            return d3adaptor;
        }

        d3adaptor.start = function () {
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

            if (distanceMatrix.length != n) {
                var edges = links.map(function (e, i) {
                    return {
                        source: typeof e.source === 'number' ? e.source : e.source.index,
                        target: typeof e.target === 'number' ? e.target : e.target.index,
                        length: typeof e.length !== 'undefined' ? e.length : 1
                    };
                });
                distanceMatrix = ShortestPaths.johnsons(n, edges);
            }

            var D = new Array(n);
            for (var i = 0; i < n; ++i) {
                D[i] = new Array(n);
                for (var j = 0; j < n; ++j) {
                    D[i][j] = distanceMatrix[i][j] * linkDistance;
                }
            }
            var x = new Array(n), y = new Array(n);

            for (var i = 0; i < n; ++i) {
                var v = nodes[i];
                if (typeof v.x === 'undefined') {
                    v.x = w / 2;
                    v.y = h / 2;
                }
                x[i] = v.x;
                y[i] = v.y;
            }
            descent = new Descent(x, y, D);
            descent.xproject = d3adaptor.xproject;
            descent.yproject = d3adaptor.yproject;
            var initialIterations = arguments.length > 0 ? arguments[0] : 0;
            for (i = 0; i < initialIterations; ++i) {
                descent.rungeKutta();
            }
            for (i = 0; i < m; ++i) {
                o = links[i];
                if (typeof o.source == "number") o.source = nodes[o.source];
                if (typeof o.target == "number") o.target = nodes[o.target];
            }
            return d3adaptor.resume();
        };

        d3adaptor.resume = function () {
            return d3adaptor.alpha(.1);
        };

        d3adaptor.stop = function () {
            return d3adaptor.alpha(0);
        };

        function d3_identity(d) {
            return d;
        }

        // use `node.call(d3adaptor.drag)` to make nodes draggable
        d3adaptor.drag = function () {
            if (!drag) drag = d3.behavior.drag()
                .origin(d3_identity)
                .on("dragstart.d3adaptor", colaDragstart)
                .on("drag.d3adaptor", dragmove)
                .on("dragend.d3adaptor", colaDragend);

            if (!arguments.length) return drag;

            this.on("mouseover.d3adaptor", colaMouseover)
                .on("mouseout.d3adaptor", colaMouseout)
                .call(drag);
        };

        function dragmove(d) {
            d.px = d3.event.x, d.py = d3.event.y;
            d3adaptor.resume(); // restart annealing
        }

        return d3.rebind(d3adaptor, event, "on");
    };

    // The fixed property has three bits:
    // Bit 1 can be set externally (e.g., d.fixed = true) and show persist.
    // Bit 2 stores the dragging state, from mousedown to mouseup.
    // Bit 3 stores the hover state, from mouseover to mouseout.
    // Dragend is a special case: it also clears the hover state.

    function colaDragstart(d) {
        d.fixed |= 2; // set bit 2
    }

    function colaDragend(d) {
        d.fixed &= ~6; // unset bits 2 and 3
    }

    function colaMouseover(d) {
        d.fixed |= 4; // set bit 3
        d.px = d.x, d.py = d.y; // set velocity to zero
    }

    function colaMouseout(d) {
        d.fixed &= ~4; // unset bit 3
    }
    return cola;
}();