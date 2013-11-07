// Module
var Descent = (function () {
    function Descent(x, y, D) {
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
            this.ia[i] = new Array(n);
            this.ib[i] = new Array(n);
            this.xtmp[i] = new Array(n);
        }
    }
    Descent.prototype.offsetDir = function () {
        var _this = this;
        var u = new Array(this.k);
        var rand = function () {
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
        return u.map(function (x) {
            return x *= _this.minD / l;
        });
    };

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
                    var rd = this.offsetDir();
                    for (i = 0; i < this.k; ++i)
                        x[i][v] += rd[i];
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

    Descent.copy = function (x1, x2) {
        var m = x1.length, n = x1[0].length;
        for (var i = 0; i < m; ++i) {
            for (var j = 0; j < n; ++j) {
                x2[i][j] = x1[i][j];
            }
        }
    };

    Descent.prototype.computeNextPosition = function (x0, r) {
        Descent.copy(x0, r);
        this.computeDerivatives(r);
        var alpha = this.computeStepSize(this.g);
        this.takeDescentStep(r[0], this.g[0], alpha);
        if (this.xproject) {
            this.xproject(x0[0], r[0]);
        }
        this.takeDescentStep(r[1], this.g[1], alpha);
        if (this.yproject) {
            this.yproject(x0[1], r[1]);
        }
    };
    Descent.prototype.rungeKutta = function () {
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
    };

    Descent.mid = function (a, b, m) {
        var k = a.length, n = a[0].length;
        for (var i = 0; i < k; ++i) {
            for (var j = 0; j < n; ++j) {
                m[i][j] = a[i][j] + (b[i][j] - a[i][j]) / 2.0;
            }
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
                var rl = d - l;
                var d2 = d * d;
                stress += rl * rl / d2;
            }
        }
        return stress;
    };
    Descent.zeroDistance = 1e-10;
    return Descent;
})();
//# sourceMappingURL=descent.js.map
