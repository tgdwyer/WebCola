    export interface LinkAccessor<Link> {
        getSourceIndex(l: Link): number;
        getTargetIndex(l: Link): number;
    }

    export interface LinkLengthAccessor<Link> extends LinkAccessor<Link> {
        setLength(l: Link, value: number): void;
    }

    // compute the size of the union of two sets a and b
    function unionCount(a: any, b: any): number {
        var u = {};
        for (var i in a) u[i] = {};
        for (var i in b) u[i] = {};
        return Object.keys(u).length;
    }

    // compute the size of the intersection of two sets a and b
    function intersectionCount(a: number[], b: number[]): number {
        var n = 0;
        for (var i in a) if (typeof b[i] !== 'undefined') ++n;
        return n;
    }

    function getNeighbours<Link>(links: Link[], la: LinkAccessor<Link>): any {
        var neighbours = {};
        var addNeighbours = (u, v) => {
            if (typeof neighbours[u] === 'undefined')
                neighbours[u] = {};
            neighbours[u][v] = {};
        };
        links.forEach(e => {
            var u = la.getSourceIndex(e), v = la.getTargetIndex(e);
            addNeighbours(u, v);
            addNeighbours(v, u);
        });
        return neighbours;
    }

    // modify the lengths of the specified links by the result of function f weighted by w
    function computeLinkLengths<Link>(links: Link[], w: number, f: (a: any, b: any) => number, la: LinkLengthAccessor<Link>) {
        var neighbours = getNeighbours(links, la);
        links.forEach(l => {
            var a = neighbours[la.getSourceIndex(l)];
            var b = neighbours[la.getTargetIndex(l)];
            la.setLength(l, 1 + w * f(a, b));
        });
    }

    /** modify the specified link lengths based on the symmetric difference of their neighbours
     * @class symmetricDiffLinkLengths
     */
    export function symmetricDiffLinkLengths<Link>(links: Link[], la: LinkLengthAccessor<Link>, w: number = 1) {
        computeLinkLengths(links, w, (a, b) => Math.sqrt(unionCount(a, b) - intersectionCount(a, b)), la);
    }

    /** modify the specified links lengths based on the jaccard difference between their neighbours
     * @class jaccardLinkLengths
     */
    export function jaccardLinkLengths<Link>(links: Link[], la: LinkLengthAccessor<Link>, w: number = 1) {
        computeLinkLengths(links, w, (a, b) =>
            Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1 ? 0 : intersectionCount(a, b) / unionCount(a, b)
            , la);
    }

    export type Axis = 'x'|'y'
    export interface IConstraint {
        /**
         * The type of this constraint. Optional for separation constraints, but mandatory for alignment constraints.
         */
        type?: string
        /**
         * The axis along which this constraint should be applied.
         */
        axis: Axis,
        /**
         * You may add additional data to the constraint definition.
         */
        [additionalProperyName: number]: unknown,
        /**
         * You may add additional data to the constraint definition.
         */
        [additionalPropertyName: string]: unknown
    }
    export interface SeparationConstraint extends IConstraint {
        /**
         * The type of this constraint. Optional for separation constraints, but mandatory for alignment constraints.
         */
        type?: 'separation',
        /**
         * Index of the node on the left-hand-side of the constraint equation.
         * This node will be forced to be left of (if {@link axis} is set to 'x') / above (if {@link axis} is set to 'y') the other node.
         */
        left: number,
        /**
         * Index of the node on the right-hand-side of the constraint equation.
         * This node will be forced to be right of (if {@link axis} is set to 'x') / below (if {@link axis} is set to 'y') the other node.
         */
        right: number,
        /**
         * Size of the gap between the nodes.
         */
        gap?: number,
        /**
         * Is this an equality separation constraint (does the distance between the nodes have to match exactly?)
         * or an inequality constraint (is the set distance a minimum distance and may be bigger if necessary?)
         * @default false
         */
        equality?: boolean
    }
    interface AlignmentSpecification{
        /** Index of the target node in the nodes array. */
        node: number,
        /**
         * Offset from the node's center.
         * @default 0
         */
        offset?: number
    }
    export interface AlignmentConstraint extends IConstraint {
        /**
         * The type of this constraint. Optional for separation constraints, but mandatory for alignment constraints.
         */
        type: 'alignment',
        /**
         * List of nodes to be aligned along the specified {@link axis}.
         */
        offsets: Array<AlignmentSpecification>
    }

    export interface LinkSepAccessor<Link> extends LinkAccessor<Link> {
        getMinSeparation(l: Link): number;
    }

    /** generate separation constraints for all edges unless both their source and sink are in the same strongly connected component
     * @class generateDirectedEdgeConstraints
     */
    export function generateDirectedEdgeConstraints<Link>(n: number, links: Link[], axis: Axis,
        la: LinkSepAccessor<Link>): SeparationConstraint[]
    {
        var components = stronglyConnectedComponents(n, links, la);
        var nodes = {};
        components.forEach((c,i) =>
            c.forEach(v => nodes[v] = i)
        );
        var constraints: SeparationConstraint[] = [];
        links.forEach(l => {
            var ui = la.getSourceIndex(l), vi = la.getTargetIndex(l),
                u = nodes[ui], v = nodes[vi];
            if (u !== v) {
                constraints.push({
                    axis: axis,
                    left: ui,
                    right: vi,
                    gap: la.getMinSeparation(l)
                });
            }
        });
        return constraints;
    }

    /**
     * Tarjan's strongly connected components algorithm for directed graphs
     * returns an array of arrays of node indicies in each of the strongly connected components.
     * a vertex not in a SCC of two or more nodes is it's own SCC.
     * adaptation of https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
     */
    export function stronglyConnectedComponents<Link>(numVertices: number, edges: Link[], la: LinkAccessor<Link>): number[][]{
        var nodes = [];
        var index = 0;
        var stack = [];
        var components = [];
        function strongConnect(v) {
            // Set the depth index for v to the smallest unused index
            v.index = v.lowlink = index++;
            stack.push(v);
            v.onStack = true;

            // Consider successors of v
            for (var w of v.out) {
                if (typeof w.index === 'undefined') {
                    // Successor w has not yet been visited; recurse on it
                    strongConnect(w);
                    v.lowlink = Math.min(v.lowlink, w.lowlink);
                } else if (w.onStack) {
                    // Successor w is in stack S and hence in the current SCC
                    v.lowlink = Math.min(v.lowlink, w.index);
                }
            }

            // If v is a root node, pop the stack and generate an SCC
            if (v.lowlink === v.index) {
                // start a new strongly connected component
                var component = [];
                while (stack.length) {
                    w = stack.pop();
                    w.onStack = false;
                    //add w to current strongly connected component
                    component.push(w);
                    if (w === v) break;
                }
                // output the current strongly connected component
                components.push(component.map(v => v.id));
            }
        }
        for (var i = 0; i < numVertices; i++) {
            nodes.push({id: i, out: []});
        }
        for (var e of edges) {
            let v = nodes[la.getSourceIndex(e)],
                w = nodes[la.getTargetIndex(e)];
            v.out.push(w);
        }
        for (var v of nodes) if (typeof v.index === 'undefined') strongConnect(v);
        return components;
    }
