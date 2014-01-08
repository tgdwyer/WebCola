///<reference path="pqueue.ts"/>
var ShortestPaths;
(function (ShortestPaths) {
    function dijkstra(n, es, start) {
        return dijkstraNeighbours(getNeighbours(n, es), start);
    }
    ShortestPaths.dijkstra = dijkstra;

    function johnsons(n, es) {
        var D = new Array(n), N = getNeighbours(n, es);
        for (var i = 0; i < n; ++i) {
            D[i] = dijkstraNeighbours(N, i);
        }
        return D;
    }
    ShortestPaths.johnsons = johnsons;

    var Neighbour = (function () {
        function Neighbour(id, distance) {
            this.id = id;
            this.distance = distance;
        }
        return Neighbour;
    })();

    var Node = (function () {
        function Node(id) {
            this.id = id;
            this.neighbours = [];
        }
        return Node;
    })();

    function getNeighbours(n, es) {
        var neighbours = new Array(n);
        var i = n;
        while (i--)
            neighbours[i] = new Node(i);

        i = es.length;
        while (i--) {
            var e = es[i];
            var u = e.source, v = e.target;
            var d = typeof e.length !== 'undefined' ? e.length : 1;
            neighbours[u].neighbours.push(new Neighbour(v, d));
            neighbours[v].neighbours.push(new Neighbour(u, d));
        }
        return neighbours;
    }
    ;

    function dijkstraNeighbours(neighbours, start) {
        var q = new PriorityQueue(function (a, b) {
            return a.d <= b.d;
        }), i = neighbours.length, d = new Array(i);
        while (i--) {
            var node = neighbours[i];
            node.d = i === start ? 0 : Number.MAX_VALUE;
            node.q = q.push(node);
        }
        while (!q.empty()) {
            // console.log(q.toString(function (u) { return u.id + "=" + (u.d === Number.MAX_VALUE ? "\u221E" : u.d) }));
            var u = q.pop();
            d[u.id] = u.d;
            i = u.neighbours.length;
            while (i--) {
                var neighbour = u.neighbours[i];
                var v = neighbours[neighbour.id];
                var t = u.d + neighbour.distance;
                if (u.d !== Number.MAX_VALUE && v.d > t) {
                    v.d = t;
                    v.q = q.reduceKey(v.q, v);
                }
            }
        }
        return d;
    }
})(ShortestPaths || (ShortestPaths = {}));
//# sourceMappingURL=shortestpaths.js.map
