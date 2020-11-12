import {Calculator} from './shortestpaths'
import {Descent} from './descent'
import {Projection, GraphNode, Rectangle} from './rectangle'
import {Variable} from './vpsc'
import {jaccardLinkLengths, LinkLengthAccessor} from './linklengths'

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
    export class Node3D implements GraphNode {
        // if fixed, layout will not move the node from its specified starting position
        fixed: boolean;
        width: number;
        height: number;
        px: number;
        py: number;
        bounds: Rectangle;
        variable: Variable;
        constructor(
            public x: number = 0,
            public y: number = 0,
            public z: number = 0) { }
    }
    export class Layout3D {
        static dims = ['x', 'y', 'z'];
        static k = Layout3D.dims.length;
        result: number[][];
        constraints: any[] = null;

        constructor(public nodes: Node3D[], public links: Link3D[], public idealLinkLength: number = 1) {
            this.result = new Array(Layout3D.k);
            for (var i = 0; i < Layout3D.k; ++i) {
                this.result[i] = new Array(nodes.length);
            }
            nodes.forEach((v, i) => {
                for (var dim of Layout3D.dims) {
                    if (typeof v[dim] == 'undefined') v[dim] = Math.random();
                }
                this.result[0][i] = v.x;
                this.result[1][i] = v.y;
                this.result[2][i] = v.z;
            });
        };

        linkLength(l: Link3D): number {
            return l.actualLength(this.result);
        }

        useJaccardLinkLengths: boolean = true;

        descent: Descent;
        start(iterations: number = 100): Layout3D {
            const n = this.nodes.length;

            var linkAccessor = new LinkAccessor();

            if (this.useJaccardLinkLengths)
                jaccardLinkLengths(this.links, linkAccessor, 1.5);

            this.links.forEach(e => e.length *= this.idealLinkLength);

            // Create the distance matrix that Cola needs
            const distanceMatrix = (new Calculator(n, this.links,
                e=> e.source, e=> e.target, e => e.length)).DistanceMatrix();

            const D = Descent.createSquareMatrix(n, (i, j) => distanceMatrix[i][j]);

            // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
            // otherwise 2.
            var G = Descent.createSquareMatrix(n, function () { return 2 });
            this.links.forEach(({ source, target }) => G[source][target] = G[target][source] = 1);

            this.descent = new Descent(this.result, D);
            this.descent.threshold = 1e-3;
            this.descent.G = G;
            //let constraints = this.links.map(e=> <any>{
            //    axis: 'y', left: e.source, right: e.target, gap: e.length*1.5
            //});
            if (this.constraints)
                this.descent.project = new Projection(<GraphNode[]>this.nodes, null, null, this.constraints).projectFunctions();

            for (var i = 0; i < this.nodes.length; i++) {
                var v = this.nodes[i];
                if (v.fixed) {
                    this.descent.locks.add(i, [v.x, v.y, v.z]);
                }
            }

            this.descent.run(iterations);
            return this;
        }

        tick(): number {
            this.descent.locks.clear();
            for (var i = 0; i < this.nodes.length; i++) {
                var v = this.nodes[i];
                if (v.fixed) {
                    this.descent.locks.add(i, [v.x, v.y, v.z]);
                }
            }
            return this.descent.rungeKutta();
        }
    }

    class LinkAccessor implements LinkLengthAccessor<any> {
        getSourceIndex(e: any): number { return e.source; }
        getTargetIndex(e: any): number { return e.target; }
        getLength(e: any): number { return e.length; }
        setLength(e: any, l: number) { e.length = l; }
    }
