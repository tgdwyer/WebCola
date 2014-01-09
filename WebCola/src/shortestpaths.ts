///<reference path="pqueue.ts"/>
module ShortestPaths {
    export declare class Edge {
        source: number;
        target: number;
        length: number;
    }

    export function dijkstra(n: number, es: Edge[], start: number): number[] {
        return dijkstraNeighbours(getNeighbours(n, es), start);
    }

    /**
     * compute shortest paths for graph over n nodes with edges an array of source/target pairs
     * edges may optionally have a length attribute.  1 is the default.
     * 
     * @method johnsons
     * @param n {number} number of nodes
     * @param es {Edge} an array of source/target pairs
     */
    export function johnsons(n: number, es: Edge[]): number[][] {
        var D = new Array(n), N = getNeighbours(n, es);
        for (var i = 0; i < n; ++i) {
            D[i] = dijkstraNeighbours(N, i);
        }
        return D;
    }

    class Neighbour {
        constructor(public id: number, public distance: number) {}
    }

    class Node {
        constructor(public id: number) {
            this.neighbours = [];
        }
        neighbours: Neighbour[];
        d: number;
        q: PairingHeap<Node>;
    }

    function getNeighbours(n: number, es: Edge[]): Node[] {
        var neighbours = new Array(n);
        var i = n; while (i--) neighbours[i] = new Node(i);

        i = es.length; while (i--) {
            var e = es[i];
            var u: number = e.source, v: number = e.target;
            var d = typeof e.length !== 'undefined' ? e.length : 1;
            neighbours[u].neighbours.push(new Neighbour(v, d));
            neighbours[v].neighbours.push(new Neighbour(u, d));
        }
        return neighbours;
    };

    function dijkstraNeighbours(neighbours: Node[], start: number): number[] {
        var q = new PriorityQueue<Node>((a, b) => a.d <= b.d),
            i = neighbours.length,
            d: number[] = new Array(i);
        while (i--) {
            var node: Node = neighbours[i];
            node.d = i === start ? 0 : Number.MAX_VALUE;
            node.q = q.push(node);
        }
        while (!q.empty()) {
            // console.log(q.toString(function (u) { return u.id + "=" + (u.d === Number.MAX_VALUE ? "\u221E" : u.d) }));
            var u = q.pop();
            d[u.id] = u.d;
            i = u.neighbours.length; while (i--) {
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
}