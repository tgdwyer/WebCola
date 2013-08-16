(function () {
    dijkstra = function (n, es, start) {
        var d = new Array(n);
        dijkstraNeighbours(getNeighbours(n, es), start, d);
        return d;
    };
    johnsons = function (n, es) {
        var D = new Array(n);
        var N = getNeighbours(n, es);
        for (var i = 0; i < n; ++i) {
            D[i] = new Array(n);
            dijkstraNeighbours(N, i, D[i]);
        }
        return D;
    };
    var getNeighbours = function (n, es) {
        var neighbours = new Array(n);
        var i;
        for (i = 0; i < n; ++i) {
            var node = [];
            node.id = i;
            neighbours[i] = node;
        }
        var m = es.length;
        for (i = 0; i < m; ++i) {
            var e = es[i];
            var u = e.source;
            var v = e.target;
            neighbours[u].push(v);
            neighbours[v].push(u);
        }
        return neighbours;
    };
    var dijkstraNeighbours = function (neighbours, start, d) {
        var n = neighbours.length, i;
        var q = new PriorityQueue(function (a, b) { return a.d <= b.d; });
        for (i = 0; i < n; ++i) {
            var node = neighbours[i];
            node.d = i === start ? 0 : Number.MAX_VALUE;
            node.q = q.push(node);
        }
        while (!q.empty()) {
            // console.log(q.toString(function (u) { return u.id + "=" + (u.d === Number.MAX_VALUE ? "\u221E" : u.d) }));
            var u = q.pop();
            d[u.id] = u.d;
            var ul = u.length;
            for (i = 0; i < ul; ++i) {
                var v = neighbours[u[i]];
                var w = 1;
                var t = u.d + w;
                if (u.d !== Number.MAX_VALUE && v.d > t) {
                    v.d = t;
                    v.q = q.reduceKey(v.q, v);
                }
            }
        }
    };
})();