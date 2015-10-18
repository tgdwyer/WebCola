///<reference path="pqueue.ts"/>
/**
 * @module shortestpaths
 */
module cola.shortestpaths {
    class Neighbour {
        constructor(public id: number, public distance: number) { }
    }

    class Node {
        constructor(public id: number) {
            this.neighbours = [];
        }
        neighbours: Neighbour[];
        d: number;
        prev: Node;
        q: PairingHeap<Node>;
    }

    class QueueEntry {
        constructor(public node: Node, public prev: QueueEntry, public d: number) {}
    }

    /**
     * calculates all-pairs shortest paths or shortest paths from a single node
     * @class Calculator
     * @constructor
     * @param n {number} number of nodes
     * @param es {Edge[]} array of edges
     */
    export class Calculator<Link> {
        private neighbours: Node[];

        constructor(public n: number, public es: Link[], getSourceIndex: (l: Link) => number, getTargetIndex: (l: Link) => number, getLength: (l: Link) => number) {
            this.neighbours = new Array(this.n);
            var i = this.n; while (i--) this.neighbours[i] = new Node(i);

            i = this.es.length; while (i--) {
                var e = this.es[i];
                var u: number = getSourceIndex(e), v: number = getTargetIndex(e);
                var d = getLength(e);
                this.neighbours[u].neighbours.push(new Neighbour(v, d));
                this.neighbours[v].neighbours.push(new Neighbour(u, d));
            }
        }

        /**
         * compute shortest paths for graph over n nodes with edges an array of source/target pairs
         * edges may optionally have a length attribute.  1 is the default.
         * Uses Johnson's algorithm.
         * 
         * @method DistanceMatrix
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
         * @method DistancesFromNode
         * @param start node index
         * @return array of path lengths
         */
        DistancesFromNode(start: number): number[] {
            return this.dijkstraNeighbours(start);
        }

        PathFromNodeToNode(start: number, end: number): number[] {
            return this.dijkstraNeighbours(start, end);
        }

        // find shortest path from start to end, with the opportunity at 
        // each edge traversal to compute a custom cost based on the 
        // previous edge.  For example, to penalise bends.
        PathFromNodeToNodeWithPrevCost(
            start: number, 
            end: number, 
            prevCost: (u:number,v:number,w:number)=>number): number[]
        {
            var q = new PriorityQueue<QueueEntry>((a, b) => a.d <= b.d),
                u: Node = this.neighbours[start],
                qu: QueueEntry = new QueueEntry(u,null,0),
                visitedFrom = {};
            q.push(qu);
            while(!q.empty()) {
                qu = q.pop();
                u = qu.node;
                if (u.id === end) {
                    break;
                }
                var i = u.neighbours.length; while (i--) {
                    var neighbour = u.neighbours[i],
                        v = this.neighbours[neighbour.id];

                    // don't double back
                    if (qu.prev && v.id === qu.prev.node.id) continue;                    

                    // don't retraverse an edge if it has already been explored
                    // from a lower cost route
                    var viduid = v.id + ',' + u.id;
                    if(viduid in visitedFrom && visitedFrom[viduid] <= qu.d) 
                        continue;

                    var cc = qu.prev ? prevCost(qu.prev.node.id, u.id, v.id) : 0,
                        t = qu.d + neighbour.distance + cc;

                    // store cost of this traversal
                    visitedFrom[viduid] = t;
                    q.push(new QueueEntry(v, qu, t));
                }
            }
            var path:number[] = [];
            while (qu.prev) {
                qu = qu.prev;
                path.push(qu.node.id);
            }
            return path;
        }

        private dijkstraNeighbours(start: number, dest: number = -1): number[] {
            var q = new PriorityQueue<Node>((a, b) => a.d <= b.d),
                i = this.neighbours.length,
                d: number[] = new Array(i);
            while (i--) {
                var node: Node = this.neighbours[i];
                node.d = i === start ? 0 : Number.POSITIVE_INFINITY;
                node.q = q.push(node);
            }
            while (!q.empty()) {
                // console.log(q.toString(function (u) { return u.id + "=" + (u.d === Number.POSITIVE_INFINITY ? "\u221E" : u.d.toFixed(2) )}));
                var u = q.pop();
                d[u.id] = u.d;
                if (u.id === dest) {
                    var path: number[] = [];
                    var v = u;
                    while (typeof v.prev !== 'undefined') {
                        path.push(v.prev.id);
                        v = v.prev;
                    }
                    return path;
                }
                i = u.neighbours.length; while (i--) {
                    var neighbour = u.neighbours[i];
                    var v = this.neighbours[neighbour.id];
                    var t = u.d + neighbour.distance;
                    if (u.d !== Number.MAX_VALUE && v.d > t) {
                        v.d = t;
                        v.prev = u;
                        q.reduceKey(v.q, v, (e,q)=>e.q = q);
                    }
                }
            }
            return d;
        }
    }
}