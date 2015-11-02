var cola;
(function (cola) {
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

    // modify the lengths of the specified links by the result of function f weighted by w
    function computeLinkLengths(nodes, links, w, f) {
        var n = nodes.length, neighbours = new Array(n);
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
            l.length = 1 + w * f(a, b);
        });
    }

    // modify the specified link lengths based on the symmetric difference of their neighbours
    function symmetricDiffLinkLengths(nodes, links, w) {
        if (typeof w === "undefined") { w = 1; }
        computeLinkLengths(nodes, links, w, function (a, b) {
            return Math.sqrt(unionCount(a, b) - intersectionCount(a, b));
        });
    }
    cola.symmetricDiffLinkLengths = symmetricDiffLinkLengths;

    // modify the specified links lengths based on the jaccard difference between their neighbours
    function jaccardLinkLengths(nodes, links, w) {
        if (typeof w === "undefined") { w = 1; }
        computeLinkLengths(nodes, links, w, function (a, b) {
            return Math.min(Object.keys(a).length, Object.keys(b).length) < 1.1 ? 0 : intersectionCount(a, b) / unionCount(a, b);
        });
    }
    cola.jaccardLinkLengths = jaccardLinkLengths;
})(cola || (cola = {}));
//# sourceMappingURL=linklengths.js.map
