///<reference path="pqueue.ts"/>
/**
 * @module shortestpaths
 */
module shortestpaths {
    /**
     * Edges passed into Calculator constructor must have the following properties:
     * @class Edge
     */
    export declare class Edge {
        /**
         * index of source node
         * @property source {number}
         */
        source: number;
        /**
         * index of target node
         * @property target {number}
         */
        target: number;
        /**
         * length of edge
         * @property length {number}
         */
        length: number;
    }


    class Neighbour {
        constructor(public id: number, public distance: number) { }
    }

    class Node {
        constructor(public id: number) {
            this.neighbours = [];
        }
        neighbours: Neighbour[];
        d: number;
        q: PairingHeap<Node>;
    }

    /**
     * calculates all-pairs shortest paths or shortest paths from a single node
     * @class Calculator
     * @constructor
     * @param n {number} number of nodes
     * @param es {Edge[]} array of edges
     */
    export class Calculator {
        private neighbours: Node[];

        constructor(public n: number, public es: Edge[]) {
            this.neighbours = new Array(this.n);
            var i = this.n; while (i--) this.neighbours[i] = new Node(i);

            i = this.es.length; while (i--) {
                var e = this.es[i];
                var u: number = e.source, v: number = e.target;
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
        DistanceMatrix(): number[][] {
            var D = new Array(this.n);
            for (var i = 0; i < this.n; ++i) {
                D[i] = this.dijkstraNeighbours(i);
            }
            return D;
        }

        /**
         * get shortest paths from a specified start node
         * @method GetDistancesFromNode
         * @param start node index
         * @return array of path lengths
         */
        DistancesFromNode(start: number): number[] {
            return this.dijkstraNeighbours(start);
        }

        private dijkstraNeighbours(start: number): number[] {
            var q = new PriorityQueue<Node>((a, b) => a.d <= b.d),
                i = this.neighbours.length,
                d: number[] = new Array(i);
            while (i--) {
                var node: Node = this.neighbours[i];
                node.d = i === start ? 0 : Number.MAX_VALUE;
                node.q = q.push(node);
            }
            while (!q.empty()) {
                // console.log(q.toString(function (u) { return u.id + "=" + (u.d === Number.MAX_VALUE ? "\u221E" : u.d) }));
                var u = q.pop();
                d[u.id] = u.d;
                i = u.neighbours.length; while (i--) {
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
        }
    }
}