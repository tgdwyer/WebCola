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

export interface IConstraint {
    left: number;
    right: number;
    gap: number;
}

export interface DirectedEdgeConstraints {
    axis: string;
    gap: number;
}

export interface LinkSepAccessor<Link> extends LinkAccessor<Link> {
    getMinSeparation(l: Link): number;
}

/** generate separation constraints for all edges unless both their source and sink are in the same strongly connected component
 * @class generateDirectedEdgeConstraints
 */
export function generateDirectedEdgeConstraints<Link>(n: number, links: Link[], axis: string,
    la: LinkSepAccessor<Link>): IConstraint[]
{
    var components = stronglyConnectedComponents(n, links, la);
    var nodes = {};
    components.filter(c => c.length > 1).forEach(c =>
        c.forEach(v => nodes[v] = c)
    );
    var constraints: any[] = [];
    links.forEach(l => {
        var ui = la.getSourceIndex(l), vi = la.getTargetIndex(l),
            u = nodes[ui], v = nodes[vi];
        if (!u || !v || u.component !== v.component) {
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
function stronglyConnectedComponents<Link>(numVertices: number, edges: Link[], la: LinkAccessor<Link>): number[][] {
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
        adjList[la.getSourceIndex(edges[i])].push(la.getTargetIndex(edges[i]))
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