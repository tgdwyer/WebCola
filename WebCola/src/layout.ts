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
        /**
         * index in nodes array, this is initialized by Layout.start()
         */
        index?: number;
        /**
         * x and y will be computed by layout as the Node's centroid
         */
        x: number;
        /**
         * x and y will be computed by layout as the Node's centroid
         */
        y: number;
        /**
         * specify a width and height of the node's bounding box if you turn on avoidOverlaps
         */
        width?: number;
        /**
         * specify a width and height of the node's bounding box if you turn on avoidOverlaps
         */
        height?: number;
        /**
         * selective bit mask.  !=0 means layout will not move.
         */
        fixed: number;
    }
    
    export interface Group {
        bounds: vpsc.Rectangle;
        leaves: Node[];
        groups: Group[];
    }

    function isGroup(g: any): g is Group {
        return typeof g.leaves !== 'undefined' || typeof g.groups !== 'undefined';
    }
    
    export interface Link<NodeRefType> {
        source: NodeRefType;
        target: NodeRefType;

        // ideal length the layout should try to achieve for this link
        length?: number;

        // how hard we should try to satisfy this link's ideal length
        // must be in the range: 0 < weight <= 1
        // if unspecified 1 is the default
        weight?: number;
    }
    
    type LinkNumericPropertyAccessor = (t: Link<Node | number>) => number;

    interface LinkLengthTypeAccessor extends LinkLengthAccessor<Link<Node | number>> {
        getType: LinkNumericPropertyAccessor;
    }
    /**
     * Main interface to cola layout.  
     * @class Layout
     */
    export class Layout {
        private _canvasSize = [1, 1];
        private _linkDistance: number | LinkNumericPropertyAccessor = 20;
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
        private _rootGroup = null;
        private _links: Link<Node | number>[] = [];
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
        public on(e: EventType | string, listener: (event: Event) => void): Layout {
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
            const n = this._nodes.length,
                  m = this._links.length;
            let o, i;

            this._descent.locks.clear();
            for (i = 0; i < n; ++i) {
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

            let s1 = this._descent.rungeKutta();
            //var s1 = descent.reduceStress();
            if (s1 === 0) {
                this._alpha = 0;
            } else if (typeof this._lastStress !== 'undefined') {
                this._alpha = s1; //Math.abs(Math.abs(this._lastStress / s1) - 1);
            }
            this._lastStress = s1;

            this.updateNodePositions();

            this.trigger({ type: EventType.tick, alpha: this._alpha, stress: this._lastStress });
            return false;
        }

        // copy positions out of descent instance into each of the nodes' center coords
        private updateNodePositions(): void {
            const x = this._descent.x[0], y = this._descent.x[1];
            let o, i = this._nodes.length;
            while (i--) {
                o = this._nodes[i];
                o.x = x[i];
                o.y = y[i];
            }
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
                    // in this case the links are expected to be numeric indices for nodes in the range 0..n-1 where n is the number of nodes
                    var n = 0;
                    this._links.forEach(function (l) {
                        n = Math.max(n, <number>l.source, <number>l.target);
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
        groups(): Array<Group>
        groups(x: Array<Group>): Layout
        groups(x?: Array<Group>): any {
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
         * if true, the final step of the start method will be to nicely pack connected components of the graph.
         * works best if start() is called with a reasonable number of iterations specified and 
         * each node has a bounding box (defined by the width and height properties on nodes).
         * @property handleDisconnected
         * @type bool
         * @default true
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
        flowLayout(axis: string, minSeparation: number|((t: any)=>number)): Layout {
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
        linkDistance(): LinkNumericPropertyAccessor
        linkDistance(x: number): Layout
        linkDistance(x: LinkNumericPropertyAccessor): Layout
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

        getLinkLength(link: Link<Node | number>): number {
            return typeof this._linkDistance === "function" ? +((<LinkNumericPropertyAccessor>this._linkDistance)(link)) : <number>this._linkDistance;
        }

        static setLinkLength(link: Link<Node|number>, length: number) {
            link.length = length;
        }

        getLinkType(link: Link<Node | number>): number {
            return typeof this._linkType === "function" ? this._linkType(link) : 0;
        }

        linkAccessor: LinkLengthTypeAccessor = {
            getSourceIndex: Layout.getSourceIndex,
            getTargetIndex: Layout.getTargetIndex,
            setLength: Layout.setLinkLength,
            getType: l => typeof this._linkType === "function" ? this._linkType(l) : 0
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
         * @param [keepRunning=true] keep iterating asynchronously via the tick method
         */
        start(
            initialUnconstrainedIterations: number = 0,
            initialUserConstraintIterations: number = 0,
            initialAllConstraintsIterations: number = 0,
            gridSnapIterations: number = 0,
            keepRunning = true
        ): Layout {
            var i: number,
                j: number,
                n = (<Array<any>>this.nodes()).length,
                N = n + 2 * this._groups.length,
                m = this._links.length,
                w = this._canvasSize[0],
                h = this._canvasSize[1];

            var x = new Array(N), y = new Array(N);

            var G = null;

            var ao = this._avoidOverlaps;

            this._nodes.forEach((v, i) => {
                v.index = i;
                if (typeof v.x === 'undefined') {
                    v.x = w / 2, v.y = h / 2;
                }
                x[i] = v.x, y[i] = v.y;
            });

            if (this._linkLengthCalculator) this._linkLengthCalculator();

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
                G = cola.Descent.createSquareMatrix(N, () => 2);
                this._links.forEach(l => {
                    if (typeof l.source == "number") l.source = this._nodes[<number>l.source];
                    if (typeof l.target == "number") l.target = this._nodes[<number>l.target];
                });
                this._links.forEach(e => {
                    const u = Layout.getSourceIndex(e), v = Layout.getTargetIndex(e);
                    G[u][v] = G[v][u] = e.weight || 1;
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
            // if groups are specified, dummy nodes and edges will be added to untangle
            // with respect to group connectivity
            this.initialLayout(initialUnconstrainedIterations, x, y);

            // apply initialIterations with user constraints but no nonoverlap constraints
            if (curConstraints.length > 0) this._descent.project = new cola.vpsc.Projection(this._nodes, this._groups, this._rootGroup, curConstraints).projectFunctions();
            this._descent.run(initialUserConstraintIterations);
            this.separateOverlappingComponents(w, h);

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

            this.updateNodePositions();
            this.separateOverlappingComponents(w, h);
            return keepRunning ? this.resume() : this;
        }

        private initialLayout(iterations: number, x: number[], y: number[]) {
            if (this._groups.length > 0 && iterations > 0) {        
                // construct a flat graph with dummy nodes for the groups and edges connecting group dummy nodes to their children
                // todo: edges attached to groups are replaced with edges connected to the corresponding group dummy node
                var n = this._nodes.length;
                var edges = this._links.map(e => <any>{ source: (<Node>e.source).index, target: (<Node>e.target).index });
                var vs = this._nodes.map(v => <any>{ index: v.index });
                this._groups.forEach((g, i) => {
                    vs.push(<any>{ index: g.index = n + i });
                });
                this._groups.forEach((g, i) => {
                    if (typeof g.leaves !== 'undefined')
                        g.leaves.forEach(v => edges.push({ source: g.index, target: v.index }));
                    if (typeof g.groups !== 'undefined')
                        g.groups.forEach(gg => edges.push({ source: g.index, target: gg.index }));
                });

                // layout the flat graph with dummy nodes and edges
                new cola.Layout()
                    .size(this.size())
                    .nodes(vs)
                    .links(edges)
                    .avoidOverlaps(false)
                    .linkDistance(this.linkDistance())
                    .symmetricDiffLinkLengths(5)
                    .convergenceThreshold(1e-4)
                    .start(iterations, 0, 0, 0, false);

                this._nodes.forEach(v => {
                    x[v.index] = vs[v.index].x;
                    y[v.index] = vs[v.index].y;
                });
            } else {
                this._descent.run(iterations);
            }
        }
        
        // recalculate nodes position for disconnected graphs
        private separateOverlappingComponents(width: number, height: number): void {
            // recalculate nodes position for disconnected graphs
            if (!this._distanceMatrix && this._handleDisconnected) {
                let x = this._descent.x[0], y = this._descent.x[1];
                this._nodes.forEach(function (v, i) { v.x = x[i], v.y = y[i]; });
                var graphs = cola.separateGraphs(this._nodes, this._links);
                cola.applyPacking(graphs, width, height, this._defaultNodeSize);
                this._nodes.forEach((v, i) => {
                    this._descent.x[0][i] = v.x, this._descent.x[1][i] = v.y;
                    if (v.bounds) {
                        v.bounds.setXCentre(v.x);
                        v.bounds.setYCentre(v.y);
                    }
                });
            }
        }

        resume(): Layout {
            return this.alpha(0.1);
        }

        stop(): Layout {
            return this.alpha(0);
        }

        /// find a visibility graph over the set of nodes.  assumes all nodes have a
        /// bounds property (a rectangle) and that no pair of bounds overlaps.
        prepareEdgeRouting(nodeMargin: number = 0) {
            this._visibilityGraph = new cola.geom.TangentVisibilityGraph(
                this._nodes.map(function (v) {
                    return v.bounds.inflate(-nodeMargin).vertices();
                }));
        }

        /// find a route avoiding node bounds for the given edge.
        /// assumes the visibility graph has been created (by prepareEdgeRouting method)
        /// and also assumes that nodes have an index property giving their position in the
        /// node array.  This index property is created by the start() method.
        routeEdge(edge, draw) {
            var lineData = [];
            //if (d.source.id === 10 && d.target.id === 11) {
            //    debugger;
            //}
            var vg2 = new cola.geom.TangentVisibilityGraph(this._visibilityGraph.P, { V: this._visibilityGraph.V, E: this._visibilityGraph.E }),
                port1 = <geom.TVGPoint>{ x: edge.source.x, y: edge.source.y },
                port2 = <geom.TVGPoint>{ x: edge.target.x, y: edge.target.y },
                start = vg2.addPoint(port1, edge.source.index),
                end = vg2.addPoint(port2, edge.target.index);
            vg2.addEdgeIfVisible(port1, port2, edge.source.index, edge.target.index);
            if (typeof draw !== 'undefined') {
                draw(vg2);
            }
            var sourceInd = e => e.source.id, targetInd = e => e.target.id, length = e => e.length(),
                spCalc = new cola.shortestpaths.Calculator(vg2.V.length, vg2.E, sourceInd, targetInd, length),
                shortestPath = spCalc.PathFromNodeToNode(start.id, end.id);
            if (shortestPath.length === 1 || shortestPath.length === vg2.V.length) {
                let route = cola.vpsc.makeEdgeBetween(edge.source.innerBounds, edge.target.innerBounds, 5);
                lineData = [route.sourceIntersection, route.arrowStart];
            } else {
                var n = shortestPath.length - 2,
                    p = vg2.V[shortestPath[n]].p,
                    q = vg2.V[shortestPath[0]].p,
                    lineData = [edge.source.innerBounds.rayIntersection(p.x, p.y)];
                for (var i = n; i >= 0; --i)
                    lineData.push(vg2.V[shortestPath[i]].p);
                lineData.push(cola.vpsc.makeEdgeTo(q, edge.target.innerBounds, 5));
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
        static getSourceIndex(e: Link<Node | number>): number {
            return typeof e.source === 'number' ? <number>e.source : (<Node>e.source).index;
        }

        //The link source and target may be just a node index, or they may be references to nodes themselves.
        static getTargetIndex(e: Link<Node | number>): number {
            return typeof e.target === 'number' ? <number>e.target : (<Node>e.target).index;
        }

        // Get a string ID for a given link.
        static linkId(e: Link<Node | number>): string {
            return Layout.getSourceIndex(e) + "-" + Layout.getTargetIndex(e);
        }

        // The fixed property has three bits:
        // Bit 1 can be set externally (e.g., d.fixed = true) and show persist.
        // Bit 2 stores the dragging state, from mousedown to mouseup.
        // Bit 3 stores the hover state, from mouseover to mouseout.
        static dragStart(d: Node | Group) {
            if (isGroup(d)) {
                Layout.storeOffset(d, Layout.dragOrigin(d));
            } else {
                Layout.stopNode(d);
                d.fixed |= 2; // set bit 2
            }
        }

        // we clobber any existing desired positions for nodes
        // in case another tick event occurs before the drag
        private static stopNode(v: Node) {
            (<any>v).px = v.x;
            (<any>v).py = v.y;
        }

        // we store offsets for each node relative to the centre of the ancestor group 
        // being dragged in a pair of properties on the node
        private static storeOffset(d: Group, origin: { x: number, y: number }) {
            if (typeof d.leaves !== 'undefined') {
                d.leaves.forEach(v => {
                    v.fixed |= 2;
                    Layout.stopNode(v);
                    (<any>v)._dragGroupOffsetX = v.x - origin.x;
                    (<any>v)._dragGroupOffsetY = v.y - origin.y;
                });
            }
            if (typeof d.groups !== 'undefined') {
                d.groups.forEach(g => Layout.storeOffset(g, origin));
            }
        }

        // the drag origin is taken as the centre of the node or group
        static dragOrigin(d: Node | Group): { x: number, y: number } {
            if (isGroup(d)) {
                return {
                    x: d.bounds.cx(),
                    y: d.bounds.cy()
                };
            } else {
                return d;
            }
        }

        // for groups, the drag translation is propagated down to all of the children of
        // the group.
        static drag(d: Node | Group, position: { x: number, y: number }) {
            if (isGroup(d)) {
                if (typeof d.leaves !== 'undefined') {
                    d.leaves.forEach(v => {
                        d.bounds.setXCentre(position.x);
                        d.bounds.setYCentre(position.y);
                        (<any>v).px = (<any>v)._dragGroupOffsetX + position.x;
                        (<any>v).py = (<any>v)._dragGroupOffsetY + position.y;
                    });
                }
                if (typeof d.groups !== 'undefined') {
                    d.groups.forEach(g => Layout.drag(g, position));
                }
            } else {
                (<any>d).px = position.x;
                (<any>d).py = position.y;
            }
        }

        // we unset only bits 2 and 3 so that the user can fix nodes with another a different
        // bit such that the lock persists between drags 
        static dragEnd(d) {
            if (isGroup(d)) {
                if (typeof d.leaves !== 'undefined') {
                    d.leaves.forEach(v => {
                        Layout.dragEnd(v);
                        delete (<any>v)._dragGroupOffsetX;
                        delete (<any>v)._dragGroupOffsetY;
                    });
                }
                if (typeof d.groups !== 'undefined') {
                    d.groups.forEach(Layout.dragEnd);
                }
            } else {
                d.fixed &= ~6; // unset bits 2 and 3
                //d.fixed = 0;
            }
        }

        // in d3 hover temporarily locks nodes, currently not used in cola
        static mouseOver(d) {
            d.fixed |= 4; // set bit 3
            d.px = d.x, d.py = d.y; // set velocity to zero
        }
        
        // in d3 hover temporarily locks nodes, currently not used in cola
        static mouseOut(d) {
            d.fixed &= ~4; // unset bit 3
        }
    }
}
