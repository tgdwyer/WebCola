///<reference path="pqueue.ts"/>
module ShortestPaths {
    export declare class Edge {
        source: number;
        target: number;
    }

    export function dijkstra(n: number, es: Edge[], start: number): number[] {
        var d = new Array(n);
        dijkstraNeighbours(getNeighbours(n, es), start, d);
        return d;
    }

    export function johnsons(n: number, es: Edge[]): number[][] {
        var D = new Array(n);
        var N = getNeighbours(n, es);
        for (var i = 0; i < n; ++i) {
            var d = D[i] = new Array(n);
            dijkstraNeighbours(N, i, d);
        }
        return D;
    }

    class Node {
        constructor(id: number) {
            this.id = id;
            this.neighbours = [];
        }
        id: number;
        neighbours: Node[];
        d: number;
        q: PairingHeap<Node>;
    }

    function getNeighbours(n: number, es: Edge[]): Node[] {
        var neighbours = new Array(n);
        var i = n; while (i--) neighbours[i] = new Node(i);

        i = es.length; while (i--) {
            var e = es[i];
            var u = e.source, v = e.target;
            neighbours[u].neighbours.push(v);
            neighbours[v].neighbours.push(u);
        }
        return neighbours;
    };

    function dijkstraNeighbours(neighbours: Node[], start: number, d: number[]): void {
        var n = neighbours.length, i;
        var q = new PriorityQueue<Node>((a, b)=> a.d <= b.d);
        for (i = 0; i < n; ++i) {
            var node: Node = neighbours[i];
            node.d = i === start ? 0 : Number.MAX_VALUE;
            node.q = q.push(node);
        }
        while (!q.empty()) {
            // console.log(q.toString(function (u) { return u.id + "=" + (u.d === Number.MAX_VALUE ? "\u221E" : u.d) }));
            var u = q.pop();
            d[u.id] = u.d;
            var ul = u.neighbours.length;
            for (i = 0; i < ul; ++i) {
                var v = neighbours[u.neighbours[i]];
                var w = 1;
                var t = u.d + w;
                if (u.d !== Number.MAX_VALUE && v.d > t) {
                    v.d = t;
                    v.q = q.reduceKey(v.q, v);
                }
            }
        }
    };
}