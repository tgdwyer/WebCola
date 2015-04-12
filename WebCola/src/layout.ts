///<reference path="handledisconnected.ts"/>
///<reference path="geom.ts"/>
///<reference path="descent.ts"/>
///<reference path="powergraph.ts"/>
///<reference path="linklengths.ts"/>
///<reference path="shortestpaths.ts"/>
/**
 * @module cola
 */
module cola {
    /**
     * The layout process fires three events:
     *  - start: layout iterations started
     *  - tick: fired once per iteration, listen to this to animate
     *  - end: layout converged, you might like to zoom-to-fit or something at notification of this event
     */
    export enum EventType { start, tick, end };
    export interface Event {
        type: EventType;
        alpha: number;
        stress?: number;
        listener?: () => void;
    }
    export interface Node {
        x: number;
        y: number;
    }
    export interface Link<NodeType> {
        source: NodeType;
        target: NodeType;
        length?: number;
    }
    
    /**
     * Main interface to cola layout.  
     * @class Layout
     */
    export class Layout {
        private _canvasSize = [1, 1];
        private _linkDistance: number | ((any) => number) = 20;
        private _defaultNodeSize: number = 10;
        private _linkLengthCalculator = null;
        private _linkType = null;
        private _avoidOverlaps = false;
        private _handleDisconnected = true;
        private _alpha;
        private _lastStress;
        private _running = false;
        private _nodes = [];
        private _groups = [];
        private _variables = [];
        private _rootGroup = null;
        private _links = [];
        private _constraints = [];
        private _distanceMatrix = null;
        private _descent: Descent = null;
        private _directedLinkConstraints = null;
        private _threshold = 0.01;
        private _visibilityGraph = null;
        private _groupCompactness = 1e-6;
        
        // sub-class and override this property to replace with a more sophisticated eventing mechanism
        protected event = null;

        // subscribe a listener to an event
        // sub-class and override this method to replace with a more sophisticated eventing mechanism
        public on(e: EventType | string, listener: (Event) => void): Layout {
            // override me!
            if (!this.event) this.event = {};
            if (typeof e === 'string') {
                this.event[EventType[e]] = listener;
            } else {
                this.event[e] = listener;
            }
            return this;
        }

        // a function that is notified of events like "tick"
        // sub-class and override this method to replace with a more sophisticated eventing mechanism
        protected trigger(e: Event) { 
            if (this.event && typeof this.event[e.type] !== 'undefined') {
                this.event[e.type](e);
            }
        }

        // a function that kicks off the iteration tick loop
        // it calls tick() repeatedly until tick returns true (is converged)
        // subclass and override it with something fancier (e.g. dispatch tick on a timer)
        protected kick() {
            while (!this.tick());
        }

        /**
         * iterate the layout.  Returns true when layout converged.
         */
        protected tick(): boolean {
            if (this._alpha < this._threshold) {
                this._running = false;
                this.trigger({ type: EventType.end, alpha: this._alpha = 0, stress: this._lastStress });
                return true;
            }

            var n = this._nodes.length,
                m = this._links.length,
                o;

            this._descent.locks.clear();
            for (var i = 0; i < n; ++i) {
                o = this._nodes[i];
                if (o.fixed) {
                    if (typeof o.px === 'undefined' || typeof o.py === 'undefined') {
                        o.px = o.x;
                        o.py = o.y;
                    }
                    var p = [o.px, o.py];
                    this._descent.locks.add(i, p);
                }
            }

            var s1 = this._descent.rungeKutta();
            //var s1 = descent.reduceStress();
            if (s1 === 0) {
                this._alpha = 0;
            } else if (typeof this._lastStress !== 'undefined') {
                this._alpha = s1; //Math.abs(Math.abs(this._lastStress / s1) - 1);
            }
            this._lastStress = s1;

            for (var i = 0; i < n; ++i) {
                o = this._nodes[i];
                if (o.fixed) {
                    o.x = o.px;
                    o.y = o.py;
                } else {
                    o.x = this._descent.x[0][i];
                    o.y = this._descent.x[1][i];
                }
            }

            this.trigger({ type: EventType.tick, alpha: this._alpha, stress: this._lastStress });
            return false;
        }

        /**
         * the list of nodes.
         * If nodes has not been set, but links has, then we instantiate a nodes list here, of the correct size,
         * before returning it.
         * @property nodes {Array}
         * @default empty list
         */
        nodes(): Array<Node>
        nodes(v: Array<Node>): Layout
        nodes(v?: any): any {
            if (!v) {
                if (this._nodes.length === 0 && this._links.length > 0) {
                    // if we have links but no nodes, create the nodes array now with empty objects for the links to point at.
                    var n = 0;
                    this._links.forEach(function (l) {
                        n = Math.max(n, l.source, l.target);
                    });
                    this._nodes = new Array(++n);
                    for (var i = 0; i < n; ++i) {
                        this._nodes[i] = {};
                    }
                }
                return this._nodes;
            }
            this._nodes = v;
            return this;
        }

        /**
         * a list of hierarchical groups defined over nodes
         * @property groups {Array}
         * @default empty list
         */
        groups(): Array<any>
        groups(x: Array<any>): Layout
        groups(x?: Array<any>): any {
            if (!x) return this._groups;
            this._groups = x;
            this._rootGroup = {};
            this._groups.forEach(g => {
                if (typeof g.padding === "undefined")
                    g.padding = 1;
                if (typeof g.leaves !== "undefined")
                    g.leaves.forEach((v, i) => { (g.leaves[i] = this._nodes[v]).parent = g });
                if (typeof g.groups !== "undefined")
                    g.groups.forEach((gi, i) => { (g.groups[i] = this._groups[gi]).parent = g });
            });
            this._rootGroup.leaves = this._nodes.filter(v => typeof v.parent === 'undefined');
            this._rootGroup.groups = this._groups.filter(g => typeof g.parent === 'undefined');
            return this;
        }

        powerGraphGroups(f: Function): Layout {
            var g = cola.powergraph.getGroups(this._nodes, this._links, this.linkAccessor, this._rootGroup);
            this.groups(g.groups);
            f(g);
            return this;
        }

        /**
         * if true, the layout will not permit overlaps of the node bounding boxes (defined by the width and height properties on nodes)
         * @property avoidOverlaps
         * @type bool
         * @default false
         */
        avoidOverlaps(): boolean
        avoidOverlaps(v: boolean): Layout
        avoidOverlaps(v?: boolean): any {
            if (!arguments.length) return this._avoidOverlaps;
            this._avoidOverlaps = v;
            return this;
        }

        /**
         * if true, the layout will not permit overlaps of the node bounding boxes (defined by the width and height properties on nodes)
         * @property avoidOverlaps
         * @type bool
         * @default false
         */
        handleDisconnected(): boolean
        handleDisconnected(v: boolean): Layout 
        handleDisconnected(v?: boolean): any {
            if (!arguments.length) return this._handleDisconnected;
            this._handleDisconnected = v;
            return this;
        }

        /**
         * causes constraints to be generated such that directed graphs are laid out either from left-to-right or top-to-bottom.
         * a separation constraint is generated in the selected axis for each edge that is not involved in a cycle (part of a strongly connected component)
         * @param axis {string} 'x' for left-to-right, 'y' for top-to-bottom
         * @param minSeparation {number|link=>number} either a number specifying a minimum spacing required across all links or a function to return the minimum spacing for each link
         */
        flowLayout(axis: string, minSeparation: number|((any)=>number)): Layout {
            if (!arguments.length) axis = 'y';
            this._directedLinkConstraints = {
                axis: axis,
                getMinSeparation: typeof minSeparation === 'number' ? function () { return minSeparation } : minSeparation
            };
            return this;
        }

        /**
         * links defined as source, target pairs over nodes
         * @property links {array}
         * @default empty list
         */
        links(): Array<Link<Node|number>>
        links(x: Array<Link<Node|number>>): Layout
        links(x?: Array<Link<Node|number>>): any {
            if (!arguments.length) return this._links;
            this._links = x;
            return this;
        }

        /**
         * list of constraints of various types
         * @property constraints
         * @type {array} 
         * @default empty list
         */
        constraints(): Array<any>
        constraints(c: Array<any>): Layout
        constraints(c?: Array<any>): any {
            if (!arguments.length) return this._constraints;
            this._constraints = c;
            return this;
        }

        /**
         * Matrix of ideal distances between all pairs of nodes.
         * If unspecified, the ideal distances for pairs of nodes will be based on the shortest path distance between them.
         * @property distanceMatrix
         * @type {Array of Array of Number}
         * @default null
         */
        distanceMatrix(): Array<Array<number>>
        distanceMatrix(d: Array<Array<number>>): Layout
        distanceMatrix(d?: any): any {
            if (!arguments.length) return this._distanceMatrix;
            this._distanceMatrix = d;
            return this;
        }

        /**
         * Size of the layout canvas dimensions [x,y]. Currently only used to determine the midpoint which is taken as the starting position
         * for nodes with no preassigned x and y.
         * @property size
         * @type {Array of Number}
         */
        size(): Array<number>
        size(x: Array<number>): Layout
        size(x?: Array<number>): any {
            if (!x) return this._canvasSize;
            this._canvasSize = x;
            return this;
        }

        /**
         * Default size (assume nodes are square so both width and height) to use in packing if node width/height are not specified.
         * @property defaultNodeSize
         * @type {Number}
         */
        defaultNodeSize(): number
        defaultNodeSize(x: number): Layout
        defaultNodeSize(x?: any): any {
            if (!x) return this._defaultNodeSize;
            this._defaultNodeSize = x;
            return this;
        }

        /**
         * The strength of attraction between the group boundaries to each other.
         * @property defaultNodeSize
         * @type {Number}
         */
        groupCompactness(): number
        groupCompactness(x: number): Layout
        groupCompactness(x?: any): any {
            if (!x) return this._groupCompactness;
            this._groupCompactness = x;
            return this;
        }

        /**
         * links have an ideal distance, The automatic layout will compute layout that tries to keep links (AKA edges) as close as possible to this length.
         */
        linkDistance(): number
        linkDistance(): (any) => number
        linkDistance(x: number): Layout
        linkDistance(x: (any) => number): Layout
        linkDistance(x?: any): any {
            if (!x) {
                return this._linkDistance;
            }
            this._linkDistance = typeof x === "function" ? x : +x;
            this._linkLengthCalculator = null;
            return this;
        }

        linkType(f: Function | number): Layout {
            this._linkType = f;
            return this;
        }

        convergenceThreshold(): number
        convergenceThreshold(x: number): Layout 
        convergenceThreshold(x?: number): any {
            if (!x) return this._threshold;
            this._threshold = typeof x === "function" ? x : +x;
            return this;
        }

        alpha(): number
        alpha(x: number): Layout
        alpha(x?: number): any {
            if (!arguments.length) return this._alpha;
            else {
                x = +x;
                if (this._alpha) { // if we're already running
                    if (x > 0) this._alpha = x; // we might keep it hot
                    else this._alpha = 0; // or, next tick will dispatch "end"
                } else if (x > 0) { // otherwise, fire it up!
                    if (!this._running) {
                        this._running = true;
                        this.trigger({ type: EventType.start, alpha: this._alpha = x});
                        this.kick();
                    }
                }
                return this;
            }
        }

        getLinkLength(link: any): number {
            return typeof this._linkDistance === "function" ? +<number>((<any>this._linkDistance)(link)) : <number>this._linkDistance;
        }

        static setLinkLength(link: any, length: number) {
            link.length = length;
        }

        getLinkType(link: any): number {
            return typeof this._linkType === "function" ? this._linkType(link) : 0;
        }

        linkAccessor = {
            getSourceIndex: Layout.getSourceIndex, getTargetIndex: Layout.getTargetIndex, setLength: Layout.setLinkLength,
            getType: (l) => typeof this._linkType === "function" ? this._linkType(l) : 0
        };

        /**
         * compute an ideal length for each link based on the graph structure around that link.
         * you can use this (for example) to create extra space around hub-nodes in dense graphs.
         * In particular this calculation is based on the "symmetric difference" in the neighbour sets of the source and target:
         * i.e. if neighbours of source is a and neighbours of target are b then calculation is: sqrt(|a union b| - |a intersection b|)
         * Actual computation based on inspection of link structure occurs in start(), so links themselves
         * don't have to have been assigned before invoking this function.
         * @param {number} [idealLength] the base length for an edge when its source and start have no other common neighbours (e.g. 40)
         * @param {number} [w] a multiplier for the effect of the length adjustment (e.g. 0.7)
         */
        symmetricDiffLinkLengths(idealLength: number, w: number = 1): Layout {
            this.linkDistance(l => idealLength * l.length);
            this._linkLengthCalculator = () => cola.symmetricDiffLinkLengths(this._links, this.linkAccessor, w);
            return this;
        }

        /**
         * compute an ideal length for each link based on the graph structure around that link.
         * you can use this (for example) to create extra space around hub-nodes in dense graphs.
         * In particular this calculation is based on the "symmetric difference" in the neighbour sets of the source and target:
         * i.e. if neighbours of source is a and neighbours of target are b then calculation is: |a intersection b|/|a union b|
         * Actual computation based on inspection of link structure occurs in start(), so links themselves
         * don't have to have been assigned before invoking this function.
         * @param {number} [idealLength] the base length for an edge when its source and start have no other common neighbours (e.g. 40)
         * @param {number} [w] a multiplier for the effect of the length adjustment (e.g. 0.7)
         */
        jaccardLinkLengths(idealLength: number, w: number = 1): Layout {
            this.linkDistance(l => idealLength * l.length);
            this._linkLengthCalculator = () => cola.jaccardLinkLengths(this._links, this.linkAccessor, w);
            return this;
        }

        /**
         * start the layout process
         * @method start
         * @param {number} [initialUnconstrainedIterations=0] unconstrained initial layout iterations 
         * @param {number} [initialUserConstraintIterations=0] initial layout iterations with user-specified constraints
         * @param {number} [initialAllConstraintsIterations=0] initial layout iterations with all constraints including non-overlap
         * @param {number} [gridSnapIterations=0] iterations of "grid snap", which pulls nodes towards grid cell centers - grid of size node[0].width - only really makes sense if all nodes have the same width and height
         */
        start(
            initialUnconstrainedIterations: number = 0,
            initialUserConstraintIterations: number = 0,
            initialAllConstraintsIterations: number = 0,
            gridSnapIterations: number = 0
        ): Layout {
            var i: number,
                j: number,
                n = (<Array<any>>this.nodes()).length,
                N = n + 2 * this._groups.length,
                m = this._links.length,
                w = this._canvasSize[0],
                h = this._canvasSize[1];

            if (this._linkLengthCalculator) this._linkLengthCalculator();

            var x = new Array(N), y = new Array(N);
            this._variables = new Array(N);

            var makeVariable = (i, w) => this._variables[i] = new vpsc.IndexedVariable(i, w);

            var G = null;

            var ao = this._avoidOverlaps;

            this._nodes.forEach((v, i) => {
                v.index = i;
                if (typeof v.x === 'undefined') {
                    v.x = w / 2, v.y = h / 2;
                }
                x[i] = v.x, y[i] = v.y;
            });
            //should we do this to clearly label groups?
            //this._groups.forEach((g, i) => g.groupIndex = i);

            var distances;
            if (this._distanceMatrix) {
                // use the user specified distanceMatrix
                distances = this._distanceMatrix;
            } else {
                // construct an n X n distance matrix based on shortest paths through graph (with respect to edge.length).
                distances = (new cola.shortestpaths.Calculator(N, this._links, Layout.getSourceIndex, Layout.getTargetIndex, l=> this.getLinkLength(l))).DistanceMatrix();

                // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
                // otherwise 2. (
                G = cola.Descent.createSquareMatrix(N,() => 2);
                this._links.forEach(e => {
                    var u = Layout.getSourceIndex(e), v = Layout.getTargetIndex(e);
                    G[u][v] = G[v][u] = 1;
                });
            }

            var D = cola.Descent.createSquareMatrix(N, function (i, j) {
                return distances[i][j];
            });

            if (this._rootGroup && typeof this._rootGroup.groups !== 'undefined') {
                var i = n;
                var addAttraction = (i, j, strength, idealDistance) => {
                    G[i][j] = G[j][i] = strength;
                    D[i][j] = D[j][i] = idealDistance;
                };
                this._groups.forEach(g => {
                    addAttraction(i, i + 1, this._groupCompactness, 0.1);

                    // todo: add terms here attracting children of the group to the group dummy nodes
                    //if (typeof g.leaves !== 'undefined')
                    //    g.leaves.forEach(l => {
                    //        addAttraction(l.index, i, 1e-4, 0.1);
                    //        addAttraction(l.index, i + 1, 1e-4, 0.1);
                    //    });
                    //if (typeof g.groups !== 'undefined')
                    //    g.groups.forEach(g => {
                    //        var gid = n + g.groupIndex * 2;
                    //        addAttraction(gid, i, 0.1, 0.1);
                    //        addAttraction(gid + 1, i, 0.1, 0.1);
                    //        addAttraction(gid, i + 1, 0.1, 0.1);
                    //        addAttraction(gid + 1, i + 1, 0.1, 0.1);
                    //    });
                    
                    x[i] = 0, y[i++] = 0;
                    x[i] = 0, y[i++] = 0;
                });
            } else this._rootGroup = { leaves: this._nodes, groups: [] };

            var curConstraints = this._constraints || [];
            if (this._directedLinkConstraints) {
                (<any>this.linkAccessor).getMinSeparation = this._directedLinkConstraints.getMinSeparation;
                curConstraints = curConstraints.concat(cola.generateDirectedEdgeConstraints(n, this._links, this._directedLinkConstraints.axis, <any>(this.linkAccessor)));
                
                // todo: add containment constraints between group dummy nodes and their children
            }

            this.avoidOverlaps(false);
            this._descent = new cola.Descent([x, y], D);

            this._descent.locks.clear();
            for (var i = 0; i < n; ++i) {
                var o = this._nodes[i];
                if (o.fixed) {
                    o.px = o.x;
                    o.py = o.y;
                    var p = [o.x, o.y];
                    this._descent.locks.add(i, p);
                }
            }
            this._descent.threshold = this._threshold;

            // apply initialIterations without user constraints or nonoverlap constraints
            this._descent.run(initialUnconstrainedIterations);

            // apply initialIterations with user constraints but no nonoverlap constraints
            if (curConstraints.length > 0) this._descent.project = new cola.vpsc.Projection(this._nodes, this._groups, this._rootGroup, curConstraints).projectFunctions();
            this._descent.run(initialUserConstraintIterations);

            // subsequent iterations will apply all constraints
            this.avoidOverlaps(ao);
            if (ao) {
                this._nodes.forEach(function (v, i) { v.x = x[i], v.y = y[i]; });
                this._descent.project = new cola.vpsc.Projection(this._nodes, this._groups, this._rootGroup, curConstraints, true).projectFunctions();
                this._nodes.forEach(function (v, i) { x[i] = v.x, y[i] = v.y; });
            }

            // allow not immediately connected nodes to relax apart (p-stress)
            this._descent.G = G;
            this._descent.run(initialAllConstraintsIterations);

            if (gridSnapIterations) {
                this._descent.snapStrength = 1000;
                this._descent.snapGridSize = this._nodes[0].width;
                this._descent.numGridSnapNodes = n;
                this._descent.scaleSnapByMaxH = n != N; // if we have groups then need to scale hessian so grid forces still apply
                var G0 = cola.Descent.createSquareMatrix(N,(i, j) => {
                    if (i >= n || j >= n) return G[i][j];
                    return 0
                });
                this._descent.G = G0;
                this._descent.run(gridSnapIterations);
            }

            this._links.forEach(l => {
                if (typeof l.source == "number") l.source = this._nodes[l.source];
                if (typeof l.target == "number") l.target = this._nodes[l.target];
            });
            this._nodes.forEach(function (v, i) {
                v.x = x[i], v.y = y[i];
            });

            // recalculate nodes position for disconnected graphs
            if (!this._distanceMatrix && this._handleDisconnected) {
                var graphs = cola.separateGraphs(this._nodes, this._links);
                cola.applyPacking(graphs, w, h, this._defaultNodeSize);

                this._nodes.forEach((v, i) => {
                    this._descent.x[0][i] = v.x, this._descent.x[1][i] = v.y;
                });
            }

            return this.resume();
        }

        resume(): Layout {
            return this.alpha(0.1);
        }

        stop(): Layout {
            return this.alpha(0);
        }

        prepareEdgeRouting(nodeMargin: number = 0) {
            this._visibilityGraph = new cola.geom.TangentVisibilityGraph(
                this._nodes.map(function (v) {
                    return v.bounds.inflate(-nodeMargin).vertices();
                }));
        }

        routeEdge(d, draw) {
            var lineData = [];
            //if (d.source.id === 10 && d.target.id === 11) {
            //    debugger;
            //}
            var vg2 = new cola.geom.TangentVisibilityGraph(this._visibilityGraph.P, { V: this._visibilityGraph.V, E: this._visibilityGraph.E }),
                port1 = <geom.TVGPoint>{ x: d.source.x, y: d.source.y },
                port2 = <geom.TVGPoint>{ x: d.target.x, y: d.target.y },
                start = vg2.addPoint(port1, d.source.id),
                end = vg2.addPoint(port2, d.target.id);
            vg2.addEdgeIfVisible(port1, port2, d.source.id, d.target.id);
            if (typeof draw !== 'undefined') {
                draw(vg2);
            }
            var sourceInd = e => e.source.id, targetInd = e => e.target.id, length = e => e.length(),
                spCalc = new cola.shortestpaths.Calculator(vg2.V.length, vg2.E, sourceInd, targetInd, length),
                shortestPath = spCalc.PathFromNodeToNode(start.id, end.id);
            if (shortestPath.length === 1 || shortestPath.length === vg2.V.length) {
                cola.vpsc.makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
                lineData = [{ x: d.sourceIntersection.x, y: d.sourceIntersection.y }, { x: d.arrowStart.x, y: d.arrowStart.y }];
            } else {
                var n = shortestPath.length - 2,
                    p = vg2.V[shortestPath[n]].p,
                    q = vg2.V[shortestPath[0]].p,
                    lineData = [d.source.innerBounds.rayIntersection(p.x, p.y)];
                for (var i = n; i >= 0; --i)
                    lineData.push(vg2.V[shortestPath[i]].p);
                lineData.push(cola.vpsc.makeEdgeTo(q, d.target.innerBounds, 5));
            }
            //lineData.forEach((v, i) => {
            //    if (i > 0) {
            //        var u = lineData[i - 1];
            //        this._nodes.forEach(function (node) {
            //            if (node.id === getSourceIndex(d) || node.id === getTargetIndex(d)) return;
            //            var ints = node.innerBounds.lineIntersections(u.x, u.y, v.x, v.y);
            //            if (ints.length > 0) {
            //                debugger;
            //            }
            //        })
            //    }
            //})
            return lineData;
        }

        //The link source and target may be just a node index, or they may be references to nodes themselves.
        static getSourceIndex(e) {
            return typeof e.source === 'number' ? e.source : e.source.index;
        }

        //The link source and target may be just a node index, or they may be references to nodes themselves.
        static getTargetIndex(e) {
            return typeof e.target === 'number' ? e.target : e.target.index;
        }
        // Get a string ID for a given link.
        static linkId(e) {
            return Layout.getSourceIndex(e) + "-" + Layout.getTargetIndex(e);
        }

        // The fixed property has three bits:
        // Bit 1 can be set externally (e.g., d.fixed = true) and show persist.
        // Bit 2 stores the dragging state, from mousedown to mouseup.
        // Bit 3 stores the hover state, from mouseover to mouseout.
        // Dragend is a special case: it also clears the hover state.

        static dragStart(d) {
            d.fixed |= 2; // set bit 2
            d.px = d.x, d.py = d.y; // set velocity to zero
        }

        static dragEnd(d) {
            d.fixed &= ~6; // unset bits 2 and 3
            //d.fixed = 0;
        }

        static mouseOver(d) {
            d.fixed |= 4; // set bit 3
            d.px = d.x, d.py = d.y; // set velocity to zero
        }

        static mouseOut(d) {
            d.fixed &= ~4; // unset bit 3
        }
    }
}