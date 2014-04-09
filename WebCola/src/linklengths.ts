/**
 * @module cola
 */
module cola {

    // compute the size of the union of two sets a and b
    function unionCount(a: number[], b: number[]): number {
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

    function getNeighbours(n: number, links: any[], getSourceIndex: (any)=>number, getTargetIndex: (any)=>number): any[] {
        var neighbours = new Array(n);
        for (var i = 0; i < n; ++i) {
            neighbours[i] = {};
        }
        links.forEach(e => {
            neighbours[getSourceIndex(e)][getTargetIndex(e)] = {};
            neighbours[getTargetIndex(e)][getSourceIndex(e)] = {};
        });
        return neighbours;
    }

    // modify the lengths of the specified links by the result of function f weighted by w
    function computeLinkLengths(n: number, links: any[], w: number, f: (a: number[], b: number[]) => number, getSourceIndex: (any) => number, getTargetIndex: (any) => number) {
        var neighbours = getNeighbours(n, links, getSourceIndex, getTargetIndex);
        links.forEach(l => {
            var a = neighbours[getSourceIndex(l)];
            var b = neighbours[getTargetIndex(l)];
            //var jaccard = intersectionCount(a, b) / unionCount(a, b);
            //if (Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1) {
            //    jaccard = 0;
            //}
            //l.length = 1 + w * jaccard;
            l.length = 1 + w * f(a, b);
        });
    }

    /** modify the specified link lengths based on the symmetric difference of their neighbours
     * @class symmetricDiffLinkLengths
     */
    export function symmetricDiffLinkLengths(n: number, links: any[], getSourceIndex: (any) => number, getTargetIndex: (any) => number, w: number = 1) {
        computeLinkLengths(n, links, w, function (a, b) {
            return Math.sqrt(unionCount(a, b) - intersectionCount(a, b));
        }, getSourceIndex, getTargetIndex);
    }

    /** modify the specified links lengths based on the jaccard difference between their neighbours
     * @class jaccardLinkLengths
     */
    export function jaccardLinkLengths(n: number, links: any[], getSourceIndex: (any) => number, getTargetIndex: (any) => number, w: number = 1) {
        computeLinkLengths(n, links, w, (a, b) =>
            Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1 ? 0 : intersectionCount(a, b) / unionCount(a, b)
            , getSourceIndex, getTargetIndex);
    }

    export interface IConstraint {
        left: number;
        right: number;
        gap: number;
    }

    export interface DirectedEdgeConstraints {
        axis: string;
        gap: number;
    }

    /** generate separation constraints for all edges unless both their source and sink are in the same strongly connected component
     * @class generateDirectedEdgeConstraints
     */
    export function generateDirectedEdgeConstraints(n: number, links: any[], axis: string,
        getMinSeparation: (l: any) => number, getSourceIndex: (any) => number, getTargetIndex: (any) => number): IConstraint[]
    {
        var components = stronglyConnectedComponents(n, links, getSourceIndex, getTargetIndex);
        var nodes = {};
        components.filter(c => c.length > 1).forEach(c =>
            c.forEach(v => nodes[v] = c)
        );
        var constraints: any[] = [];
        links.forEach(l => {
            var u = nodes[l.source.index], v = nodes[l.target.index];
            if (!u || !v || u.component !== v.component) {
                constraints.push({
                    axis: axis,
                    left: getSourceIndex(l),
                    right: getTargetIndex(l),
                    gap: getMinSeparation(l)
                });
            }
        });
        return constraints;
    }

    /*
    Following function based on: https://github.com/mikolalysenko/strongly-connected-components

    The MIT License (MIT)

    Copyright (c) 2013 Mikola Lysenko

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
    */
    function stronglyConnectedComponents(numVertices: number, edges: any[], getSourceIndex: (any) => number, getTargetIndex: (any) => number): number[][] {
        var adjList: number[][] = new Array(numVertices)
        var index: number[] = new Array(numVertices)
        var lowValue: number[] = new Array(numVertices)
        var active: boolean[] = new Array(numVertices)

        //Initialize tables
        for (var i = 0; i < numVertices; ++i) {
            adjList[i] = []
            index[i] = -1
            lowValue[i] = 0
            active[i] = false
        }

        //Build adjacency list representation
        for (var i = 0; i < edges.length; ++i) {
            adjList[getSourceIndex(edges[i])].push(getTargetIndex(edges[i]))
        }

        var count = 0
        var S: number[] = []
        var components: number[][] = []

        function strongConnect(v) {
            index[v] = count
            lowValue[v] = count
            active[v] = true
            count += 1
            S.push(v)
            var e = adjList[v]
            for (var i = 0; i < e.length; ++i) {
                var u = e[i]
                if (index[u] < 0) {
                    strongConnect(u)
                    lowValue[v] = Math.min(lowValue[v], lowValue[u]) | 0
                } else if (active[u]) {
                    lowValue[v] = Math.min(lowValue[v], lowValue[u])
                }
            }
            if (lowValue[v] === index[v]) {
                var component = []
                for (var i = S.length - 1; i >= 0; --i) {
                    var w = S[i]
                    active[w] = false
                    component.push(w)
                    if (w === v) {
                        S.length = i
                        break
                    }
                }
                components.push(component)
            }
        }

        //Run strong connect starting from each vertex
        for (var i = 0; i < numVertices; ++i) {
            if (index[i] < 0) {
                strongConnect(i)
            }
        }

        return components
    }
}