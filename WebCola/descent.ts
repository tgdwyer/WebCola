// Module
class Descent {
    public D: number[][];
    public Hx: number[][];
    public Hy: number[][];
    public gx: number[];
    public gy: number[];
    public x: number[];
    public y: number[];
    public n: number;

    private static zeroDistance: number = 1e-10;

    // pool of arrays of size n used internally, allocated in constructor
    private Hdx: number[];
    private Hdy: number[];
    private x0: number[];
    private a: number[];
    private b: number[];
    private c: number[];
    private d: number[];
    private ia: number[];
    private ib: number[];
    private xtmp: number[];
    private ytmp: number[];
    
    public xproject: (x: number[]) => void;
    public yproject: (y: number[]) => void;

    constructor(x: number[], y: number[], D: number[][]) {
        this.D = D;
        this.x = x;
        this.y = y;
        var n = this.n = x.length;
        this.Hx = new Array(n);
        this.Hy = new Array(n);
        for (var i = 0; i < n; ++i) {
            this.Hx[i] = new Array(n);
            this.Hy[i] = new Array(n);
        }
        this.gx = new Array(n);
        this.gy = new Array(n);
        this.Hdx = new Array(n);
        this.Hdy = new Array(n);
        this.x0 = new Array(2 * n);
        this.a = new Array(2 * n);
        this.b = new Array(2 * n);
        this.c = new Array(2 * n);
        this.d = new Array(2 * n);
        this.ia = new Array(2 * n);
        this.ib = new Array(2 * n);
        this.xtmp = new Array(n);
        this.ytmp = new Array(n);
    }

    public computeDerivatives(x: number[], y: number[]) {
        var n = this.n;
        if (n <= 1) return;
        for (var u: number = 0; u < n; ++u) {
            var Huux: number = this.gx[u] = 0;
            var Huuy: number = this.gy[u] = 0;
            for (var v = 0; v < n; ++v) {
                if (u === v) continue;
                var dx: number, dy: number;
                while (true) {
                    dx = x[u] - x[v];
                    dy = y[u] - y[v];
                    if (dx === 0 && dy === 0) {
                        x[v] += Math.random();
                        y[v] += Math.random();
                    } else break;
                }
                var dx2 = dx * dx;
                var dy2 = dy * dy;
                var l: number = Math.sqrt(dx2 + dy2);
                var d: number = this.D[u][v];
                if (!isFinite(d)) {
                    this.Hy[u][v] = this.Hx[u][v] = 0;
                    continue;
                }
                var d2: number = d * d;
                var gs: number = (l - d) / (d2 * l);
                this.gx[u] += dx * gs;
                this.gy[u] += dy * gs;
                var hs: number = d / (l * l * l);
                Huux -= this.Hx[u][v] = (hs * dy2  - 1) / d2;
                Huuy -= this.Hy[u][v] = (hs * dx2  - 1) / d2;
            }
            this.Hx[u][u] = Huux;
            this.Hy[u][u] = Huuy;
        }
    }

    private static dotProd(a: number[], b: number[]): number {
        var x = 0;
        for (var i = 0, n = a.length; i < n; ++i) {
            x += a[i] * b[i];
        }
        return x;
    }

    // result r = matrix m * vector v
    private static rightMultiply(m: number[][], v: number[], r: number[]){
        for (var i = 0, n = m.length; i < n; ++i) {
            r[i] = Descent.dotProd(m[i], v);
        }
    }

    public computeStepSize(dx: number[], dy: number[]): number {
        var numerator = Descent.dotProd(this.gx, dx) + Descent.dotProd(this.gy, dy);
        Descent.rightMultiply(this.Hx, dx, this.Hdx);
        Descent.rightMultiply(this.Hy, dy, this.Hdy);
        var denominator = Descent.dotProd(dx, this.Hdx) + Descent.dotProd(dy, this.Hdy);
        if (denominator === 0 || !isFinite(denominator)) return 0;
        return numerator / denominator;
    }

    public reduceStress(): number {
        this.computeDerivatives(this.x, this.y);
        var alpha = this.computeStepSize(this.gx, this.gy)
        this.takeDescentStep(this.x, this.gx, alpha);
        this.takeDescentStep(this.y, this.gy, alpha);
        return this.computeStress();
    }

    // copies the first half of x into a, the second half into b
    private static split(x: number[], a: number[], b: number[]): void {
        for (var i = 0, n = a.length; i < n; ++i) {
            a[i] = x[i];
            b[i] = x[i + n];
        }
    }
    // copies x and y into r
    private static unsplit(x: number[], y: number[], r: number[]): void {
        for (var i = 0, n = x.length; i < n; ++i) {
            r[i] = x[i];
            r[i + n] = y[i];
        }
    }

    private computeNextPosition(x0: number[], r: number[]): void {
        Descent.split(x0, this.xtmp, this.ytmp);
        this.computeDerivatives(this.xtmp, this.ytmp);
        var alpha = this.computeStepSize(this.gx, this.gy)
        this.takeDescentStep(this.xtmp, this.gx, alpha);
        if (this.xproject) {
            this.xproject(this.xtmp);
        }
        this.takeDescentStep(this.ytmp, this.gy, alpha);
        if (this.yproject) {
            this.yproject(this.ytmp);
        }
        Descent.unsplit(this.xtmp, this.ytmp, r);
    }
    private rungeKutta(): number {
        Descent.unsplit(this.x, this.y, this.x0);
        this.computeNextPosition(this.x0, this.a);
        Descent.mid(this.x0, this.a, this.ia);
        this.computeNextPosition(this.ia, this.b);
        Descent.mid(this.x0, this.b, this.ib);
        this.computeNextPosition(this.ib, this.c);
        this.computeNextPosition(this.c, this.d);
        for (var i = 0; i < this.n; ++i) {
            this.x[i] = (this.a[i] + 2.0 * this.b[i] + 2.0 * this.c[i] + this.d[i]) / 6.0;
            var j = i + this.n;
            this.y[i] = (this.a[j] + 2.0 * this.b[j] + 2.0 * this.c[j] + this.d[j]) / 6.0;
        }
        return this.computeStress();
    }

    private static mid(a: number[], b: number[], m: number[]): void {
        var n = a.length;
        for (var i = 0; i < n; ++i) {
            m[i] = a[i] + (b[i] - a[i]) / 2.0;
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
                var dx = this.x[u] - this.x[v], dy = this.y[u] - this.y[v];
                var l = Math.sqrt(dx * dx + dy * dy);
                var d = this.D[u][v];
                if (!isFinite(d)) continue;
                var d2 = d * d;
                var rl = d - l;
                stress += rl * rl / d2;
            } 
        }
        return stress;
    }
}