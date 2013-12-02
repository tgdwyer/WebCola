// to do:
//  - refactor x/yproject out of here
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
            groups = [],
            variables = [],
            rootGroup = null,
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

        d3adaptor.groups = function (x) {
            if (!arguments.length) return groups;
            groups = x;
            rootGroup = {};
            groups.forEach(function (g) {
                if (typeof g.leaves !== "undefined")
                    g.leaves.forEach(function (v, i) { (g.leaves[i] = nodes[v]).parent = g });
                if (typeof g.groups !== "undefined")
                    g.groups.forEach(function (gi, i) { (g.groups[i] = groups[gi]).parent = g });
            });
            rootGroup.leaves = nodes.filter(function (v) { return typeof v.parent === 'undefined'; });
            rootGroup.groups = groups.filter(function (g) { return typeof g.parent === 'undefined'; });
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
                N = n + 2 * groups.length,
                m = links.length,
                w = size[0],
                h = size[1];

            var x = new Array(N), y = new Array(N);
            variables = new Array(N);

            var makeVariable = function (i, w) {
                var v = variables[i] = new vpsc.Variable(0, w);
                v.index = i;
                return v;
            }

            var G = null;

            var ao = this.avoidOverlaps();

            nodes.forEach(function (v, i) {
                v.index = i;
                if (typeof v.x === 'undefined') {
                    v.x = w / 2, v.y = h / 2;
                }
                x[i] = v.x, y[i] = v.y;
            });

            if (distanceMatrix.length != N) {
                var edges = links.map(function (e, i) {
                    return {
                        source: typeof e.source === 'number' ? e.source : e.source.index,
                        target: typeof e.target === 'number' ? e.target : e.target.index,
                        length: typeof e.length !== 'undefined' ? e.length : 1
                    };
                });
                distanceMatrix = ShortestPaths.johnsons(N, edges);
                var G = Descent.createSquareMatrix(N, function () { return 2 });
                edges.forEach(function (e) {
                    G[e.source][e.target] = G[e.target][e.source] = 1;
                });
            }

            var D = Descent.createSquareMatrix(N, function (i, j) {
                return distanceMatrix[i][j] * linkDistance;
            });

            if (rootGroup && typeof rootGroup.groups !== 'undefined') {
                var i = n;
                groups.forEach(function(g) {
                    G[i][i + 1] = G[i + 1][i] = 1e-6;
                    D[i][i + 1] = D[i + 1][i] = 0.1;
                    x[i] = 0, y[i++] = 0;
                    x[i] = 0, y[i++] = 0;
                });
            } else {
                rootGroup = { leaves: nodes };
            }
            
            var initialUnconstrainedIterations = arguments.length > 0 ? arguments[0] : 0;
            var initialUserConstraintIterations = arguments.length > 1 ? arguments[1] : 0;
            var initialAllConstraintsIterations = arguments.length > 2 ? arguments[2] : 0;
            this.avoidOverlaps(false);
            descent = new Descent(x, y, D);
            // apply initialIterations without user constraints or nonoverlap constraints
            for (i = 0; i < initialUnconstrainedIterations; ++i) {
                descent.rungeKutta();
            }
            // apply initialIterations with user constraints but no noverlap constraints
            if (constraints.length > 0) {
                projection = new vpsc.Projection(nodes, groups, rootGroup, constraints);
                descent.xproject = function (x0, y0, x) { projection.xProject(x0, y0, x) };
                descent.yproject = function (x0, y0, y) { projection.yProject(x0, y0, y) };
            }
            for (i = 0; i < initialUserConstraintIterations; ++i) {
                descent.rungeKutta();
            }
            // subsequent iterations will apply all constraints
            this.avoidOverlaps(ao);
            if (ao) {
                projection = new vpsc.Projection(nodes, groups, rootGroup, constraints, ao);
                descent.xproject = function (x0, y0, x) { projection.xProject(x0, y0, x) };
                descent.yproject = function (x0, y0, y) { projection.yProject(x0, y0, y) };
            }
            // allow not immediately connected nodes to relax apart (p-stress)
            descent.G = G;
            for (i = 0; i < initialAllConstraintsIterations; ++i) {
                descent.rungeKutta();
            }

            links.forEach(function (l) {
                if (typeof l.source == "number") l.source = nodes[l.source];
                if (typeof l.target == "number") l.target = nodes[l.target];
            });
            nodes.forEach(function (v, i) {
                v.x = x[i], v.y = y[i];
            });

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