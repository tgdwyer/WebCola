module cola {
    export class Descent {
        public threshold: number = 0.00001;
        public H: number[][][];
        public g: number[][];
        public x: number[][];
        public k: number;
        public n: number;

        private static zeroDistance: number = 1e-10;
        private minD: number;

        // pool of arrays of size n used internally, allocated in constructor
        private Hd: number[][];
        private a: number[][];
        private b: number[][];
        private c: number[][];
        private d: number[][];
        private e: number[][];
        private ia: number[][];
        private ib: number[][];
        private xtmp: number[][];

        private random = new PseudoRandom();

        public project: { (x0: number[], y0: number[], r: number[]): void }[] = null;

        constructor(x: number[], y: number[], public D: number[][], public G: number[][]= null) {
            this.x = [x, y];
            this.k = 2;
            var n = this.n = x.length;
            this.H = new Array(this.k);
            this.g = new Array(this.k);
            this.Hd = new Array(this.k);
            this.a = new Array(this.k);
            this.b = new Array(this.k);
            this.c = new Array(this.k);
            this.d = new Array(this.k);
            this.e = new Array(this.k);
            this.ia = new Array(this.k);
            this.ib = new Array(this.k);
            this.xtmp = new Array(this.k);
            this.minD = Number.MAX_VALUE;
            var i = n, j;
            while (i--) {
                j = n;
                while (--j > i) {
                    var d = D[i][j];
                    if (d > 0 && d < this.minD) {
                        this.minD = d;
                    }
                }
            }
            if (this.minD === Number.MAX_VALUE) this.minD = 1;
            i = this.k;
            while (i--) {
                this.g[i] = new Array(n);
                this.H[i] = new Array(n);
                j = n;
                while (j--) {
                    this.H[i][j] = new Array(n);
                }
                this.Hd[i] = new Array(n);
                this.a[i] = new Array(n);
                this.b[i] = new Array(n);
                this.c[i] = new Array(n);
                this.d[i] = new Array(n);
                this.e[i] = new Array(n);
                this.ia[i] = new Array(n);
                this.ib[i] = new Array(n);
                this.xtmp[i] = new Array(n);
            }
        }

        public static createSquareMatrix(n: number, f: (i: number, j: number) => number): number[][] {
            var M = new Array(n);
            for (var i = 0; i < n; ++i) {
                M[i] = new Array(n);
                for (var j = 0; j < n; ++j) {
                    M[i][j] = f(i, j);
                }
            }
            return M;
        }

        private offsetDir(): number[] {
            var u = new Array(this.k);
            var rand = () => {
                var r = 0;
                while (r * r < 1) {
                    var r = this.random.getNext() - 0.5;
                    r *= 100;
                }
                return r;
            };
            var l = 0;
            for (var i = 0; i < this.k; ++i) {
                var x = u[i] = rand();
                l += x * x;
            }
            l = Math.sqrt(l);
            return u.map(x=> x *= this.minD / l);
        }

        public computeDerivatives(x: number[][]) {
            var n = this.n;
            if (n <= 1) return;
            var i;
            var d: number[] = new Array(this.k);
            var d2: number[] = new Array(this.k);
            var Huu: number[] = new Array(this.k);
            for (var u: number = 0; u < n; ++u) {
                for (i = 0; i < this.k; ++i) Huu[i] = this.g[i][u] = 0;
                for (var v = 0; v < n; ++v) {
                    if (u === v) continue;
                    while (true) {
                        var sd2 = 0;
                        for (i = 0; i < this.k; ++i) {
                            var dx = d[i] = x[i][u] - x[i][v];
                            sd2 += d2[i] = dx * dx;
                        }
                        if (sd2 > 1e-9) break;
                        var rd = this.offsetDir();
                        for (i = 0; i < this.k; ++i) x[i][v] += rd[i];
                    }
                    var l: number = Math.sqrt(sd2);
                    var D: number = this.D[u][v];
                    var weight = this.G != null ? this.G[u][v] : 1;
                    if (weight > 1 && l > D || !isFinite(D)) {
                        for (i = 0; i < this.k; ++i) this.H[i][u][v] = 0;
                        continue;
                    }
                    var D2: number = D * D;
                    var gs: number = weight * (l - D) / (D2 * l);
                    var hs: number = -weight / (D2 * l * l * l);
                    if (!isFinite(gs))
                        console.log(gs);
                    for (i = 0; i < this.k; ++i) {
                        this.g[i][u] += d[i] * gs;
                        Huu[i] -= this.H[i][u][v] = hs * (D * (d2[i] - sd2) + l * sd2);
                    }
                }
                for (i = 0; i < this.k; ++i) this.H[i][u][u] = Huu[i];
            }
        }

        private static dotProd(a: number[], b: number[]): number {
            var x = 0, i = a.length;
            while (i--) x += a[i] * b[i];
            return x;
        }

        // result r = matrix m * vector v
        private static rightMultiply(m: number[][], v: number[], r: number[]) {
            var i = m.length;
            while (i--) r[i] = Descent.dotProd(m[i], v);
        }

        public computeStepSize(d: number[][]): number {
            var numerator = 0, denominator = 0;
            for (var i = 0; i < 2; ++i) {
                numerator += Descent.dotProd(this.g[i], d[i]);
                Descent.rightMultiply(this.H[i], d[i], this.Hd[i]);
                denominator += Descent.dotProd(d[i], this.Hd[i]);
            }
            if (denominator === 0 || !isFinite(denominator)) return 0;
            return numerator / denominator;
        }

        public reduceStress(): number {
            this.computeDerivatives(this.x);
            var alpha = this.computeStepSize(this.g);
            for (var i = 0; i < this.k; ++i) {
                this.takeDescentStep(this.x[i], this.g[i], alpha);
            }
            return this.computeStress();
        }

        private static copy(a: number[][], b: number[][]): void {
            var m = a.length, n = b[0].length;
            for (var i = 0; i < m; ++i) {
                for (var j = 0; j < n; ++j) {
                    b[i][j] = a[i][j];
                }
            }
        }

        private stepAndProject(x0: number[][], r: number[][], d: number[][], stepSize: number) {
            Descent.copy(x0, r);
            this.takeDescentStep(r[0], d[0], stepSize);
            if (this.project) this.project[0](x0[0], x0[1], r[0]);
            this.takeDescentStep(r[1], d[1], stepSize);
            if (this.project) this.project[1](r[0], x0[1], r[1]);
        }

        private static mApply(m: number, n: number, f: (i: number, j: number) => any) {
            var i = m; while (i-- > 0) {
                var j = n; while (j-- > 0) f(i, j);
            }
        }
        private matrixApply(f: (i: number, j: number) => any) {
            Descent.mApply(this.k, this.n, f);
        }

        private computeNextPosition(x0: number[][], r: number[][]): void {
            this.computeDerivatives(x0);
            var alpha = this.computeStepSize(this.g);
            this.stepAndProject(x0, r, this.g, alpha);

            if (this.project) {
                this.matrixApply((i, j) => this.e[i][j] = x0[i][j] - r[i][j]);
                var beta = this.computeStepSize(this.e);
                beta = Math.max(0.2, Math.min(beta, 1));
                this.stepAndProject(x0, r, this.e, beta);
            }
        }

        run(iterations: number): number {
            var stress = Number.MAX_VALUE, converged = false;
            while (!converged && iterations-- > 0) {
                var s = this.rungeKutta();
                converged = Math.abs(stress / s - 1) < this.threshold;
                stress = s;
            }
            return stress;
        }

        rungeKutta(): number {
            this.computeNextPosition(this.x, this.a);
            Descent.mid(this.x, this.a, this.ia);
            this.computeNextPosition(this.ia, this.b);
            Descent.mid(this.x, this.b, this.ib);
            this.computeNextPosition(this.ib, this.c);
            this.computeNextPosition(this.c, this.d);
            this.matrixApply((i, j) => this.x[i][j] = (this.a[i][j] + 2.0 * this.b[i][j] + 2.0 * this.c[i][j] + this.d[i][j]) / 6.0);
            return this.computeStress();
        }

        private static mid(a: number[][], b: number[][], m: number[][]): void {
            Descent.mApply(a.length, a[0].length, (i, j) =>
                m[i][j] = a[i][j] + (b[i][j] - a[i][j]) / 2.0);
        }

        public takeDescentStep(x: number[], d: number[], stepSize: number): void {
            for (var i = 0; i < this.n; ++i) {
                x[i] = x[i] - stepSize * d[i];
            }
        }

        public computeStress(): number {
            var stress = 0;
            for (var u = 0, nMinus1 = this.n - 1; u < nMinus1; ++u) {
                for (var v = u + 1, n = this.n; v < n; ++v) {
                    var l = 0;
                    for (var i = 0; i < this.k; ++i) {
                        var dx = this.x[i][u] - this.x[i][v];
                        l += dx * dx;
                    }
                    l = Math.sqrt(l);
                    var d = this.D[u][v];
                    if (!isFinite(d)) continue;
                    var rl = d - l;
                    var d2 = d * d;
                    stress += rl * rl / d2;
                }
            }
            return stress;
        }
    }

    // Linear congruential pseudo random number generator
    export class PseudoRandom {
        private a: number = 214013;
        private c: number = 2531011;
        private m: number = 2147483648;
        private range: number = 32767;
        constructor(public seed: number = 1) { }
        getNext(): number {
            this.seed = (this.seed * this.a + this.c) % this.m;
            return (this.seed >> 16) / this.range;
        }
    }
}