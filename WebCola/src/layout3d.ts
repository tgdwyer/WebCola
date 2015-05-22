/**
 * Use cola to do a layout in 3D!! Yay.
 * Pretty simple for the moment.
 */
module cola {
    export class Link3D {
        length: number;
        constructor(public source: number, public target: number) { }
        actualLength(x: number[][]) {
            return Math.sqrt(
                x.reduce((c: number, v: number[]) => {
                    const dx = v[this.target] - v[this.source];
                    return c + dx * dx;
                }, 0));
        }
    }
    export class Node3D {
        lockPosition: number[];
        constructor(
            public x: number = 0,
            public y: number = 0,
            public z: number = 0) { }
    }
    export class Layout3D {
        x: number[][];
        constructor(public nodes: Node3D[], public links: Link3D[], public idealLinkLength: number) {
            // 3d positions vector
            var k = 3;
            this.x = new Array(k);
            for (var i = 0; i < k; ++i) {
                this.x[i] = new Array(nodes.length);
            }
            nodes.forEach((v, i) => {
                for (var dim of ['x', 'y', 'z']) {
                    if (typeof v[dim] == 'undefined') v[dim] = Math.random();
                }
                this.x[0][i] = v.x;
                this.x[1][i] = v.y;
                this.x[2][i] = v.z;
            });
        };

        linkLength(l: Link3D): number {
            return l.actualLength(this.x);
        }
        descent: cola.Descent;
        start(iterations: number): Layout3D {
            const n = this.nodes.length;

            var linkAccessor = new LinkAccessor();
            cola.jaccardLinkLengths(this.links, linkAccessor, 1.5);
            this.links.forEach(e => e.length *= this.idealLinkLength);

            // Create the distance matrix that Cola needs
            const distanceMatrix = (new cola.shortestpaths.Calculator(n, this.links,
                e=> e.source, e=> e.target, e => e.length)).DistanceMatrix();

            const D = cola.Descent.createSquareMatrix(n, (i, j) => distanceMatrix[i][j]);

            // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
            // otherwise 2. (
            var G = cola.Descent.createSquareMatrix(n, function () { return 2 });
            this.links.forEach(({ source, target }) => G[source][target] = G[target][source] = 1);

            this.descent = new cola.Descent(this.x, D);
            this.descent.threshold = 1e-3;
            this.descent.G = G;
            for (var i = 0; i < this.nodes.length; i++) {
                var v = this.nodes[i];
                if (v.lockPosition) {
                    this.descent.locks.add(i, v.lockPosition);
                }
            }
            this.descent.run(iterations);
            return this;
        }

        tick(): number {
            return this.descent.rungeKutta();
        }
    }

    class LinkAccessor implements cola.LinkLengthAccessor<any> {
        getSourceIndex(e: any): number { return e.source; }
        getTargetIndex(e: any): number { return e.target; }
        getLength(e: any): number { return e.length; }
        setLength(e: any, l: number) { e.length = l; }
    }
}