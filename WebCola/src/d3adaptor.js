// to do:
//  - autogenerate downward edge constraints with strongly connected components detection
//  - 3D! (add a third dimension to descent.ts and try out with three.js)
/**
 * @module cola
 */
var cola;
(function (cola) {
    /**
     * @class d3adaptor
     */
    cola.d3adaptor = function () {
        var d3adaptor = {},
            event = d3.dispatch("start", "tick", "end"),
            size = [1, 1],
            linkDistance = 20,
            avoidOverlaps = false,
            handleDisconnected = true,
            drag,
            alpha,
            lastStress,
            nodes = [],
            groups = [],
            variables = [],
            rootGroup = null,
            links = [],
            constraints = [],
            distanceMatrix = null,
            descent = null,
            directedLinkConstraints = null;

        d3adaptor.tick = function () {
            if (alpha < descent.threshold) {
                event.end({ type: "end", alpha: alpha = 0 });
                delete lastStress;
                return true;
            }

            var n = nodes.length,
                m = links.length,
                o;

            descent.locks.clear();
            for (i = 0; i < n; ++i) {
                o = nodes[i];
                if (o.fixed) {
                    if (typeof o.px === 'undefined' || typeof o.py === 'undefined') {
                        o.px = o.x;
                        o.py = o.y;
                    }
                    var p = [o.px, o.py];
                    descent.locks.add(i, p);
                }
            }

            var s1 = descent.rungeKutta();
            //var s1 = descent.reduceStress();
            if (typeof lastStress !== 'undefined' && lastStress > s1 - descent.threshold) {
                alpha = lastStress / s1 - 1;
            }
            lastStress = s1;

            for (i = 0; i < n; ++i) {
                o = nodes[i];
                if (o.fixed) {
                    o.x = o.px;
                    o.y = o.py;
                } else {
                    o.x = descent.x[0][i];
                    o.y = descent.x[1][i];
                }
            }

            event.tick({ type: "tick", alpha: alpha });
        };

        /**
         * a list of nodes
         * @property nodes {Array}
         * @default empty list
         */
        d3adaptor.nodes = function (v) {
            if (!arguments.length) return nodes;
            nodes = v;
            return d3adaptor;
        };

        /**
         * a list of hierarchical groups defined over nodes
         * @property groups {Array}
         * @default empty list
         */
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

        /**
         * if true, the layout will not permit overlaps of the node bounding boxes (defined by the width and height properties on nodes)
         * @property avoidOverlaps
         * @type bool
         * @default false
         */
        d3adaptor.avoidOverlaps = function (v) {
            if (!arguments.length) return avoidOverlaps;
            avoidOverlaps = v;
            return d3adaptor;
        }

        /**
         * if true, the layout will not permit overlaps of the node bounding boxes (defined by the width and height properties on nodes)
         * @property avoidOverlaps
         * @type bool
         * @default false
         */
        d3adaptor.handleDisconnected = function (v) {
            if (!arguments.length) return handleDisconnected;
            handleDisconnected = v;
            return d3adaptor;
        }


        /**
         * causes constraints to be generated such that directed graphs are laid out either from left-to-right or top-to-bottom.
         * a separation constraint is generated in the selected axis for each edge that is not involved in a cycle (part of a strongly connected component)
         * @param axis {string} 'x' for left-to-right, 'y' for top-to-bottom
         * @param minSeparation {number} minimum spacing required across edges
         */
        d3adaptor.flowLayout = function (axis, minSeparation) {
            if (!arguments.length) axis = 'y';
            directedLinkConstraints = {
                axis: axis,
                getMinSep: arguments.length > 1 ? function () { return minSeparation } : d3adaptor.linkDistance
            };
            return d3adaptor;
        }

        /**
         * links defined as source, target pairs over nodes
         * @property links {array}
         * @default empty list
         */
        d3adaptor.links = function (x) {
            if (!arguments.length) return links;
            links = x;
            return d3adaptor;
        };

        /**
         * list of constraints of various types
         * @property constraints
         * @type {array} 
         * @default empty list
         */
        d3adaptor.constraints = function (c) {
            if (!arguments.length) return constraints;
            constraints = c;
            return d3adaptor;
        }

        /**
         * Matrix of ideal distances between all pairs of nodes.
         * If unspecified, the ideal distances for pairs of nodes will be based on the shortest path distance between them.
         * @property distanceMatrix
         * @type {Array of Array of Number}
         * @default null
         */
        d3adaptor.distanceMatrix = function (d) {
            if (!arguments.length) return distanceMatrix;
            distanceMatrix = d;
            return d3adaptor;
        }

        /**
         * Size of the layout canvas dimensions [x,y]. Currently only used to determine the midpoint which is taken as the starting position
         * for nodes with no preassigned x and y.
         * @property size
         * @type {Array of Number}
         */
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

        d3adaptor.symmetricDiffLinkLengths = function (w) {
            cola.symmetricDiffLinkLengths(nodes.length, links, w);
            return d3adaptor;
        }

        d3adaptor.jaccardLinkLengths = function (w) {
            cola.jaccardLinkLengths(nodes.length, links, w)
            return d3adaptor;
        }

        /**
         * start the layout process
         * @method start
         * @param {number} [initialUnconstrainedIterations=0] unconstrained initial layout iterations 
         * @param {number} [initialUserConstraintIterations=0] initial layout iterations with user-specified constraints
         * @param {number} [initialAllConstraintsIterations=0] initial layout iterations with all constraints including non-overlap
         */
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

            var distances;
            if (distanceMatrix) {
                // use the user specified distanceMatrix
                distances = distanceMatrix;
            } else {
                // construct an n X n distance matrix based on shortest paths through graph (with respect to edge.length).
                var edges = links.map(function (e, i) {
                    return {
                        source: typeof e.source === 'number' ? e.source : e.source.index,
                        target: typeof e.target === 'number' ? e.target : e.target.index,
                        length: typeof e.length !== 'undefined' ? e.length : 1
                    };
                });
                distances = (new shortestpaths.Calculator(N, edges)).DistanceMatrix();

                // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
                // otherwise 2. (
                G = cola.Descent.createSquareMatrix(N, function () { return 2 });
                edges.forEach(function (e) {
                    G[e.source][e.target] = G[e.target][e.source] = 1;
                });
            }

            var D = cola.Descent.createSquareMatrix(N, function (i, j) {
                return distances[i][j] * linkDistance;
            });

            if (rootGroup && typeof rootGroup.groups !== 'undefined') {
                var i = n;
                groups.forEach(function(g) {
                    G[i][i + 1] = G[i + 1][i] = 1e-6;
                    D[i][i + 1] = D[i + 1][i] = 0.1;
                    x[i] = 0, y[i++] = 0;
                    x[i] = 0, y[i++] = 0;
                });
            } else rootGroup = { leaves: nodes, groups: [] };

            if (directedLinkConstraints) {
                constraints = (constraints || []).concat(cola.generateDirectedEdgeConstraints(n, links, directedLinkConstraints.axis, directedLinkConstraints.getMinSep()));
            }

            
            var initialUnconstrainedIterations = arguments.length > 0 ? arguments[0] : 0;
            var initialUserConstraintIterations = arguments.length > 1 ? arguments[1] : 0;
            var initialAllConstraintsIterations = arguments.length > 2 ? arguments[2] : 0;
            this.avoidOverlaps(false);
            descent = new cola.Descent([x, y], D);

            // apply initialIterations without user constraints or nonoverlap constraints
            descent.run(initialUnconstrainedIterations);

            // apply initialIterations with user constraints but no noverlap constraints
            if (constraints.length > 0) descent.project = new vpsc.Projection(nodes, groups, rootGroup, constraints).projectFunctions();
            descent.run(initialUserConstraintIterations);

            // subsequent iterations will apply all constraints
            this.avoidOverlaps(ao);
            if (ao) descent.project = new vpsc.Projection(nodes, groups, rootGroup, constraints, true).projectFunctions();

            // allow not immediately connected nodes to relax apart (p-stress)
            descent.G = G;
            descent.run(initialAllConstraintsIterations);

            links.forEach(function (l) {
                if (typeof l.source == "number") l.source = nodes[l.source];
                if (typeof l.target == "number") l.target = nodes[l.target];
            });
            nodes.forEach(function (v, i) {
                v.x = x[i], v.y = y[i];
            });

            // recalculate nodes position for disconnected graphs
            if (handleDisconnected === true){
                applyPacking(separateGraphs(nodes, links), w, h);

                nodes.forEach(function (v, i) {
                    descent.x[0][i] = v.x, descent.x[1][i] = v.y;
                });
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

            this//.on("mouseover.d3adaptor", colaMouseover)
                //.on("mouseout.d3adaptor", colaMouseout)
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
        d.px = d.x, d.py = d.y; // set velocity to zero
    }

    function colaDragend(d) {
        //d.fixed &= ~6; // unset bits 2 and 3
        d.fixed = 0;
    }

    function colaMouseover(d) {
        d.fixed |= 4; // set bit 3
        d.px = d.x, d.py = d.y; // set velocity to zero
    }

    function colaMouseout(d) {
        d.fixed &= ~4; // unset bit 3
    }
    return cola;
})(cola || (cola = {}));