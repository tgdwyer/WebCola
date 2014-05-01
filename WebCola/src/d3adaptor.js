/**
 * @module cola
 */
var cola;
(function (cola) {
    if (typeof vpsc === 'undefined') {
        vpsc = cola.vpsc;
    }

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
			running = false,
            nodes = [],
            groups = [],
            variables = [],
            rootGroup = null,
            links = [],
            constraints = [],
            distanceMatrix = null,
            descent = null,
            directedLinkConstraints = null,
            threshold = 1e-5,
            defaultNodeSize = 10,
            visibilityGraph = null;

        d3adaptor.tick = function () {
            if (alpha < threshold) {
                event.end({ type: "end", alpha: alpha = 0 });
                delete lastStress;
				running = false;
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
            if (s1 === 0) {
                alpha = 0;
            } else if (typeof lastStress !== 'undefined' && lastStress > s1 - threshold) {
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
         * the list of nodes.
         * If nodes has not been set, but links has, then we instantiate a nodes list here, of the correct size,
         * before returning it.
         * @property nodes {Array}
         * @default empty list
         */
        d3adaptor.nodes = function (v) {
            if (!arguments.length) {
                if (nodes.length === 0 && links.length > 0) {
                    var n = 0;
                    links.forEach(function (l) {
                        n = Math.max(n, l.source, l.target);
                    });
                    nodes = new Array(++n);
                    for (var i = 0; i < n; ++i) {
                        nodes[i] = {};
                    }
                }
                return nodes;
            }
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

        d3adaptor.powerGraphGroups = function (f) {
            var g = powergraph.getGroups(nodes, links, linkAccessor);
            this.groups(g.groups);
            f(g);
            return d3adaptor;
        }

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
         * @param minSeparation {number|link=>number} either a number specifying a minimum spacing required across all links or a function to return the minimum spacing for each link
         */
        d3adaptor.flowLayout = function (axis, minSeparation) {
            if (!arguments.length) axis = 'y';
            directedLinkConstraints = {
                axis: axis,
                getMinSeparation: typeof minSeparation === 'number' ?  function () { return minSeparation } : minSeparation
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

        /**
         * Default size (assume nodes are square so both width and height) to use in packing if node width/height are not specified.
         * @property defaultNodeSize
         * @type {Number}
         */
        d3adaptor.defaultNodeSize = function (x) {
            if (!arguments.length) return defaultNodeSize;
            defaultNodeSize = x;
            return d3adaptor;
        };

        d3adaptor.linkDistance = function (x) {
            if (!arguments.length) 
				return typeof linkDistance === "function" ? linkDistance() : linkDistance;
            linkDistance = typeof x === "function" ? x : +x;
            return d3adaptor;
        };

        d3adaptor.convergenceThreshold = function (x) {
            if (!arguments.length) return threshold;
            threshold = typeof x === "function" ? x : +x;
            return d3adaptor;
        };

        d3adaptor.alpha = function (x) {
            if (!arguments.length) return alpha;

            x = +x;
            if (alpha) { // if we're already running
                if (x > 0) alpha = x; // we might keep it hot
                else alpha = 0; // or, next tick will dispatch "end"
            } else if (x > 0) { // otherwise, fire it up!
				if (!running)
				{
					running = true;
                event.start({ type: "start", alpha: alpha = x });
                d3.timer(d3adaptor.tick);
            }
            }

            return d3adaptor;
        };

        function getLinkLength(link) {
            return typeof linkDistance === "function" ? +linkDistance.call(null, link) : linkDistance;
        }

        function setLinkLength(link, length) {
            link.length = length;
        }

        var linkAccessor = { getSourceIndex: getSourceIndex, getTargetIndex: getTargetIndex, setLength: setLinkLength };

        d3adaptor.symmetricDiffLinkLengths = function (idealLength, w) {
            cola.symmetricDiffLinkLengths(this.nodes().length, links, linkAccessor, w);
            this.linkDistance(function (l) { return idealLength * l.length });
            return d3adaptor;
        }

        d3adaptor.jaccardLinkLengths = function (idealLength, w) {
            cola.jaccardLinkLengths(this.nodes().length, links, linkAccessor, w);
            this.linkDistance(function (l) { return idealLength * l.length });
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
                n = this.nodes().length,
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
                distances = (new cola.shortestpaths.Calculator(N, links, getSourceIndex, getTargetIndex, getLinkLength)).DistanceMatrix();

                // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
                // otherwise 2. (
                G = cola.Descent.createSquareMatrix(N, function () { return 2 });
                links.forEach(function (e) {
                    G[getSourceIndex(e)][getTargetIndex(e)] = G[getTargetIndex(e)][getSourceIndex(e)] = 1;
                });
            }

            var D = cola.Descent.createSquareMatrix(N, function (i, j) {
                return distances[i][j];
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

            var curConstraints = constraints || [];
            if (directedLinkConstraints) {
                linkAccessor.getMinSeparation = directedLinkConstraints.getMinSeparation;
                curConstraints = curConstraints.concat(cola.generateDirectedEdgeConstraints(n, links, directedLinkConstraints.axis, linkAccessor));
            }

            
            var initialUnconstrainedIterations = arguments.length > 0 ? arguments[0] : 0;
            var initialUserConstraintIterations = arguments.length > 1 ? arguments[1] : 0;
            var initialAllConstraintsIterations = arguments.length > 2 ? arguments[2] : 0;
            this.avoidOverlaps(false);
            descent = new cola.Descent([x, y], D);
            descent.threshold = threshold;

            // apply initialIterations without user constraints or nonoverlap constraints
            descent.run(initialUnconstrainedIterations);

            // apply initialIterations with user constraints but no noverlap constraints
            if (curConstraints.length > 0) descent.project = new vpsc.Projection(nodes, groups, rootGroup, curConstraints).projectFunctions();
            descent.run(initialUserConstraintIterations);

            // subsequent iterations will apply all constraints
            this.avoidOverlaps(ao);
            if (ao) descent.project = new vpsc.Projection(nodes, groups, rootGroup, curConstraints, true).projectFunctions();

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
            if (!distanceMatrix && handleDisconnected) {
                cola.applyPacking(cola.separateGraphs(nodes, links), w, h, defaultNodeSize);

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

        d3adaptor.prepareEdgeRouting = function (nodeMargin) {
            visibilityGraph = new cola.geom.TangentVisibilityGraph(
                    nodes.map(function (v) {
                        return v.bounds.inflate(-nodeMargin).vertices();
                    }));
        }

        d3adaptor.routeEdge = function(d, draw) {
            var lineData = [];
            if (d.source.id === 10 && d.target.id === 11) {
                debugger;
            }
            var vg2 = new cola.geom.TangentVisibilityGraph(visibilityGraph.P, { V: visibilityGraph.V, E: visibilityGraph.E }),
                port1 = { x: d.source.x, y: d.source.y },
                port2 = { x: d.target.x, y: d.target.y },
                start = vg2.addPoint(port1, d.source.id),
                end = vg2.addPoint(port2, d.target.id);
            vg2.addEdgeIfVisible(port1, port2, d.source.id, d.target.id);
            if (typeof draw !== 'undefined') {
                draw(vg2);
            }
            var sourceInd = function(e) { return e.source.id }, targetInd = function(e) { return e.target.id }, length = function(e) { return e.length() }, 
                spCalc = new shortestpaths.Calculator(vg2.V.length, vg2.E, sourceInd, targetInd, length),
                shortestPath = spCalc.PathFromNodeToNode(start.id, end.id);
            if (shortestPath.length === 1 || shortestPath.length === vg2.V.length) {
                vpsc.makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
                lineData = [{ x: d.sourceIntersection.x, y: d.sourceIntersection.y }, { x: d.arrowStart.x, y: d.arrowStart.y }];
            } else {
                var n = shortestPath.length - 2,
                    p = vg2.V[shortestPath[n]].p,
                    q = vg2.V[shortestPath[0]].p,
                    lineData = [d.source.innerBounds.rayIntersection(p.x, p.y)];
                for (var i = n; i >= 0; --i) 
                    lineData.push(vg2.V[shortestPath[i]].p);
                lineData.push(vpsc.makeEdgeTo(q, d.target.innerBounds, 5));
            }
            lineData.forEach(function (v, i) {
                if (i > 0) {
                    var u = lineData[i - 1];
                    nodes.forEach(function (node) {
                        if (node.id === getSourceIndex(d) || node.id === getTargetIndex(d)) return;
                        var ints = node.innerBounds.lineIntersections(u.x, u.y, v.x, v.y);
                        if (ints.length > 0) {
                            debugger;
                        }
                    })
                }
            })
            return lineData;
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

        //The link source and target may be just a node index, or they may be references to nodes themselves.
        function getSourceIndex(e) {
            return typeof e.source === 'number' ? e.source : e.source.index;
        }

        //The link source and target may be just a node index, or they may be references to nodes themselves.
        function getTargetIndex(e) {
            return typeof e.target === 'number' ? e.target : e.target.index;
        }
        // Get a string ID for a given link.
        d3adaptor.linkId = function (e) {
            return getSourceIndex(e) + "-" + getTargetIndex(e);
        }

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
        d.fixed &= ~6; // unset bits 2 and 3
        //d.fixed = 0;
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