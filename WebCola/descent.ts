// Module
class Descent {
    public D: number[][];
    public H: number[][][];
    public g: number[][];
    public x: number[][];
    public n: number;
    public k: number;

    private static zeroDistance: number = 1e-10;
    private minD: number;

    // pool of arrays of size n used internally, allocated in constructor
    private Hd: number[][];
    private a: number[][];
    private b: number[][];
    private c: number[][];
    private d: number[][];
    private ia: number[][];
    private ib: number[][];
    private xtmp: number[][];
    
    public xproject: (x: number[]) => void;
    public yproject: (y: number[]) => void;

    constructor(x: number[], y: number[], D: number[][]) {
        this.D = D;
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
        this.ia = new Array(this.k);
        this.ib = new Array(this.k);
        this.xtmp = new Array(this.k);
        this.minD = Number.MAX_VALUE;
        var i = this.k;
        while (i--) {
            this.g[i] = new Array(n);
            this.H[i] = new Array(n);
            var j = n;
            while (j--) {
                this.H[i][j] = new Array(n);
                var d = D[i][j];
                if (d > 0 && d < this.minD) {
                    this.minD = d;
                }
            }
            this.Hd[i] = new Array(n);
            this.a[i] = new Array(n);
            this.b[i] = new Array(n);
            this.c[i] = new Array(n);
            this.d[i] = new Array(n);
            this.ia[i] = new Array(n);
            this.ib[i] = new Array(n);
            this.xtmp[i] = new Array(n);
        }
    }

    private offsetDir(): number[] {
        var u = new Array(this.k);
        var rand = () => {
            var r = 0;
            while (r * r < 1) {
                var r = Math.random() - 0.5;
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
        return u.map(x=> x *= this.minD/l);
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
                if (!isFinite(D)) {
                    for (i = 0; i < this.k; ++i) this.H[i][u][v] = 0;
                    continue;
                }
                var D2: number = D * D;
                var gs: number = (l - D) / (D2 * l);
                var hs: number = -1 / (D2 * l * l * l);
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

    private static copy(x1: number[][], x2: number[][]): void {
        var m = x1.length, n = x1[0].length;
        for (var i = 0; i < m; ++i) {
            for (var j = 0; j < n; ++j) {
                x2[i][j] = x1[i][j];
            }
        }
    }

    private computeNextPosition(x0: number[][], r: number[][]): void {
        Descent.copy(x0, r);
        this.computeDerivatives(r);
        var alpha = this.computeStepSize(this.g)
        this.takeDescentStep(r[0], this.g[0], alpha);
        if (this.xproject) {
            this.xproject(r[0]);
        }
        this.takeDescentStep(r[1], this.g[1], alpha);
        if (this.yproject) {
            this.yproject(r[1]);
        }
    }
    private rungeKutta(): number {
        this.computeNextPosition(this.x, this.a);
        Descent.mid(this.x, this.a, this.ia);
        this.computeNextPosition(this.ia, this.b);
        Descent.mid(this.x, this.b, this.ib);
        this.computeNextPosition(this.ib, this.c);
        this.computeNextPosition(this.c, this.d);
        for (var i = 0; i < this.k; ++i) {
            for (var j = 0; j < this.n; ++j) {
                this.x[i][j] = (this.a[i][j] + 2.0 * this.b[i][j] + 2.0 * this.c[i][j] + this.d[i][j]) / 6.0;
            }
        }
        return this.computeStress();
    }

    private static mid(a: number[][], b: number[][], m: number[][]): void {
        var k = a.length, n = a[0].length;
        for (var i = 0; i < k; ++i) {
            for (var j = 0; j < n; ++j) {
                m[i][j] = a[i][j] + (b[i][j] - a[i][j]) / 2.0;
            }
        }
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