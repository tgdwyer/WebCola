// compute the size of the union of two sets a and b
function unionCount(a, b) {
    var u = {};
    for (var i in a)
        u[i] = {};
    for (var i in b)
        u[i] = {};
    return Object.keys(u).length;
}
// compute the size of the intersection of two sets a and b
function intersectionCount(a, b) {
    var n = 0;
    for (var i in a)
        if (typeof b[i] !== 'undefined')
            ++n;
    return n;
}
function getNeighbours(links, la) {
    var neighbours = {};
    var addNeighbours = function (u, v) {
        if (typeof neighbours[u] === 'undefined')
            neighbours[u] = {};
        neighbours[u][v] = {};
    };
    links.forEach(function (e) {
        var u = la.getSourceIndex(e), v = la.getTargetIndex(e);
        addNeighbours(u, v);
        addNeighbours(v, u);
    });
    return neighbours;
}
// modify the lengths of the specified links by the result of function f weighted by w
function computeLinkLengths(links, w, f, la) {
    var neighbours = getNeighbours(links, la);
    links.forEach(function (l) {
        var a = neighbours[la.getSourceIndex(l)];
        var b = neighbours[la.getTargetIndex(l)];
        la.setLength(l, 1 + w * f(a, b));
    });
}
/** modify the specified link lengths based on the symmetric difference of their neighbours
 * @class symmetricDiffLinkLengths
 */
function symmetricDiffLinkLengths(links, la, w) {
    if (w === void 0) { w = 1; }
    computeLinkLengths(links, w, function (a, b) { return Math.sqrt(unionCount(a, b) - intersectionCount(a, b)); }, la);
}
exports.symmetricDiffLinkLengths = symmetricDiffLinkLengths;
/** modify the specified links lengths based on the jaccard difference between their neighbours
 * @class jaccardLinkLengths
 */
function jaccardLinkLengths(links, la, w) {
    if (w === void 0) { w = 1; }
    computeLinkLengths(links, w, function (a, b) { return Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1 ? 0 : intersectionCount(a, b) / unionCount(a, b); }, la);
}
exports.jaccardLinkLengths = jaccardLinkLengths;
/** generate separation constraints for all edges unless both their source and sink are in the same strongly connected component
 * @class generateDirectedEdgeConstraints
 */
function generateDirectedEdgeConstraints(n, links, axis, la) {
    var components = stronglyConnectedComponents(n, links, la);
    var nodes = {};
    components.filter(function (c) { return c.length > 1; }).forEach(function (c) { return c.forEach(function (v) { return nodes[v] = c; }); });
    var constraints = [];
    links.forEach(function (l) {
        var ui = la.getSourceIndex(l), vi = la.getTargetIndex(l), u = nodes[ui], v = nodes[vi];
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
exports.generateDirectedEdgeConstraints = generateDirectedEdgeConstraints;
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
function stronglyConnectedComponents(numVertices, edges, la) {
    var adjList = new Array(numVertices);
    var index = new Array(numVertices);
    var lowValue = new Array(numVertices);
    var active = new Array(numVertices);
    for (var i = 0; i < numVertices; ++i) {
        adjList[i] = [];
        index[i] = -1;
        lowValue[i] = 0;
        active[i] = false;
    }
    for (var i = 0; i < edges.length; ++i) {
        adjList[la.getSourceIndex(edges[i])].push(la.getTargetIndex(edges[i]));
    }
    var count = 0;
    var S = [];
    var components = [];
    function strongConnect(v) {
        index[v] = count;
        lowValue[v] = count;
        active[v] = true;
        count += 1;
        S.push(v);
        var e = adjList[v];
        for (var i = 0; i < e.length; ++i) {
            var u = e[i];
            if (index[u] < 0) {
                strongConnect(u);
                lowValue[v] = Math.min(lowValue[v], lowValue[u]) | 0;
            }
            else if (active[u]) {
                lowValue[v] = Math.min(lowValue[v], lowValue[u]);
            }
        }
        if (lowValue[v] === index[v]) {
            var component = [];
            for (var i = S.length - 1; i >= 0; --i) {
                var w = S[i];
                active[w] = false;
                component.push(w);
                if (w === v) {
                    S.length = i;
                    break;
                }
            }
            components.push(component);
        }
    }
    for (var i = 0; i < numVertices; ++i) {
        if (index[i] < 0) {
            strongConnect(i);
        }
    }
    return components;
}
