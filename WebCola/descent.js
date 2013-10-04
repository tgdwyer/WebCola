// Module
var Descent = (function () {
    function Descent(x, y, D) {
        this.D = D;
        this.x = [x, y];
        this.k = 2;
        var n = this.n = x.length;
        this.H = new Array(this.k);
        var i = this.k;
        while (i--) {
            this.H[i] = new Array(n);
            var j = n;
            while (j--)
                this.H[i][j] = new Array(n);
        }
        this.g = [new Array(n), new Array(n)];
        this.Hd = [new Array(n), new Array(n)];
        this.x0 = new Array(this.k * n);
        this.a = new Array(this.k * n);
        this.b = new Array(this.k * n);
        this.c = new Array(this.k * n);
        this.d = new Array(this.k * n);
        this.ia = new Array(this.k * n);
        this.ib = new Array(this.k * n);
        this.xtmp = new Array(n);
        this.ytmp = new Array(n);
    }
    Descent.prototype.computeDerivatives = function (x) {
        var n = this.n;
        if (n <= 1)
            return;
        var i;
        var d = new Array(this.k);
        var d2 = new Array(this.k);
        var Huu = new Array(this.k);
        for (var u = 0; u < n; ++u) {
            for (i = 0; i < this.k; ++i)
                Huu[i] = this.g[i][u] = 0;
            for (var v = 0; v < n; ++v) {
                if (u === v)
                    continue;
                while (true) {
                    var sd2 = 0;
                    for (i = 0; i < this.k; ++i) {
                        var dx = d[i] = x[i][u] - x[i][v];
                        sd2 += d2[i] = dx * dx;
                    }
                    if (sd2 > 1e-9)
                        break;
                    for (i = 0; i < this.k; ++i)
                        x[i][v] += Math.random();
                }
                var l = Math.sqrt(sd2);
                var D = this.D[u][v];
                if (!isFinite(D)) {
                    for (i = 0; i < this.k; ++i)
                        this.H[i][u][v] = 0;
                    continue;
                }
                var D2 = D * D;
                var gs = (l - D) / (D2 * l);
                var hs = -1 / (D2 * l * l * l);
                if (!isFinite(gs))
                    console.log(gs);
                for (i = 0; i < this.k; ++i) {
                    this.g[i][u] += d[i] * gs;
                    Huu[i] -= this.H[i][u][v] = hs * (D * (d2[i] - sd2) + l * sd2);
                }
            }
            for (i = 0; i < this.k; ++i)
                this.H[i][u][u] = Huu[i];
        }
    };

    Descent.dotProd = function (a, b) {
        var x = 0, i = a.length;
        while (i--)
            x += a[i] * b[i];
        return x;
    };

    Descent.rightMultiply = // result r = matrix m * vector v
    function (m, v, r) {
        var i = m.length;
        while (i--)
            r[i] = Descent.dotProd(m[i], v);
    };

    Descent.prototype.computeStepSize = function (d) {
        var numerator = 0, denominator = 0;
        for (var i = 0; i < 2; ++i) {
            numerator += Descent.dotProd(this.g[i], d[i]);
            Descent.rightMultiply(this.H[i], d[i], this.Hd[i]);
            denominator += Descent.dotProd(d[i], this.Hd[i]);
        }
        if (denominator === 0 || !isFinite(denominator))
            return 0;
        return numerator / denominator;
    };

    Descent.prototype.reduceStress = function () {
        this.computeDerivatives(this.x);
        var alpha = this.computeStepSize(this.g);
        for (var i = 0; i < this.k; ++i) {
            this.takeDescentStep(this.x[i], this.g[i], alpha);
        }
        return this.computeStress();
    };

    Descent.split = // copies the first half of x into a, the second half into b
    function (x, a, b) {
        for (var i = 0, n = a.length; i < n; ++i) {
            a[i] = x[i];
            b[i] = x[i + n];
        }
    };

    Descent.unsplit = // copies x and y into r
    function (x, y, r) {
        for (var i = 0, n = x.length; i < n; ++i) {
            r[i] = x[i];
            r[i + n] = y[i];
        }
    };

    Descent.prototype.computeNextPosition = function (x0, r) {
        Descent.split(x0, this.xtmp, this.ytmp);
        this.computeDerivatives([this.xtmp, this.ytmp]);
        var alpha = this.computeStepSize(this.g);
        this.takeDescentStep(this.xtmp, this.g[0], alpha);
        if (this.xproject) {
            this.xproject(this.xtmp);
        }
        this.takeDescentStep(this.ytmp, this.g[1], alpha);
        if (this.yproject) {
            this.yproject(this.ytmp);
        }
        Descent.unsplit(this.xtmp, this.ytmp, r);
    };
    Descent.prototype.rungeKutta = function () {
        Descent.unsplit(this.x[0], this.x[1], this.x0);
        this.computeNextPosition(this.x0, this.a);
        Descent.mid(this.x0, this.a, this.ia);
        this.computeNextPosition(this.ia, this.b);
        Descent.mid(this.x0, this.b, this.ib);
        this.computeNextPosition(this.ib, this.c);
        this.computeNextPosition(this.c, this.d);
        for (var i = 0; i < this.n; ++i) {
            this.x[0][i] = (this.a[i] + 2.0 * this.b[i] + 2.0 * this.c[i] + this.d[i]) / 6.0;
            var j = i + this.n;
            this.x[1][i] = (this.a[j] + 2.0 * this.b[j] + 2.0 * this.c[j] + this.d[j]) / 6.0;
        }
        return this.computeStress();
    };

    Descent.mid = function (a, b, m) {
        var n = a.length;
        for (var i = 0; i < n; ++i) {
            m[i] = a[i] + (b[i] - a[i]) / 2.0;
        }
    };

    Descent.prototype.takeDescentStep = function (x, d, stepSize) {
        for (var i = 0; i < this.n; ++i) {
            x[i] = x[i] - stepSize * d[i];
        }
    };

    Descent.prototype.computeStress = function () {
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
                if (!isFinite(d))
                    continue;
                var d2 = d * d;
                var rl = d - l;
                stress += rl * rl / d2;
            }
        }
        return stress;
    };
    Descent.zeroDistance = 1e-10;
    return Descent;
})();
//@ sourceMappingURL=descent.js.map
