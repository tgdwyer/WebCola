///<reference path="pqueue.ts"/>
/**
* @module shortestpaths
*/
var shortestpaths;
(function (shortestpaths) {
    

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

    /**
    * calculates all-pairs shortest paths or shortest paths from a single node
    * @class Calculator
    * @constructor
    * @param n {number} number of nodes
    * @param es {Edge[]} array of edges
    */
    var Calculator = (function () {
        function Calculator(n, es) {
            this.n = n;
            this.es = es;
            this.neighbours = new Array(this.n);
            var i = this.n;
            while (i--)
                this.neighbours[i] = new Node(i);

            i = this.es.length;
            while (i--) {
                var e = this.es[i];
                var u = e.source, v = e.target;
                var d = typeof e.length !== 'undefined' ? e.length : 1;
                this.neighbours[u].neighbours.push(new Neighbour(v, d));
                this.neighbours[v].neighbours.push(new Neighbour(u, d));
            }
        }
        /**
        * compute shortest paths for graph over n nodes with edges an array of source/target pairs
        * edges may optionally have a length attribute.  1 is the default.
        * Uses Johnson's algorithm.
        *
        * @method GetDistanceMatrix
        * @return the distance matrix
        */
        Calculator.prototype.DistanceMatrix = function () {
            var D = new Array(this.n);
            for (var i = 0; i < this.n; ++i) {
                D[i] = this.dijkstraNeighbours(i);
            }
            return D;
        };

        /**
        * get shortest paths from a specified start node
        * @method GetDistancesFromNode
        * @param start node index
        * @return array of path lengths
        */
        Calculator.prototype.DistancesFromNode = function (start) {
            return this.dijkstraNeighbours(start);
        };

        Calculator.prototype.dijkstraNeighbours = function (start) {
            var q = new PriorityQueue(function (a, b) {
                return a.d <= b.d;
            }), i = this.neighbours.length, d = new Array(i);
            while (i--) {
                var node = this.neighbours[i];
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
                    var v = this.neighbours[neighbour.id];
                    var t = u.d + neighbour.distance;
                    if (u.d !== Number.MAX_VALUE && v.d > t) {
                        v.d = t;
                        v.q = q.reduceKey(v.q, v);
                    }
                }
            }
            return d;
        };
        return Calculator;
    })();
    shortestpaths.Calculator = Calculator;
})(shortestpaths || (shortestpaths = {}));
//# sourceMappingURL=shortestpaths.js.map
