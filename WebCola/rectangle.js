///<reference path="vpsc.ts"/>
///<reference path="rbtree.d.ts"/>
var vpsc;
(function (vpsc) {
    var Rectangle = (function () {
        function Rectangle(x, X, y, Y) {
            this.x = x;
            this.X = X;
            this.y = y;
            this.Y = Y;
        }
        Rectangle.prototype.cx = function () {
            return (this.x + this.X) / 2;
        };

        Rectangle.prototype.cy = function () {
            return (this.y + this.Y) / 2;
        };

        Rectangle.prototype.overlapX = function (r) {
            var ux = this.cx(), vx = r.cx();
            if (ux <= vx && r.x < this.X)
                return this.X - r.x;
            if (vx <= ux && this.x < r.X)
                return r.X - this.x;
            return 0;
        };

        Rectangle.prototype.overlapY = function (r) {
            var uy = this.cy(), vy = r.cy();
            if (uy <= vy && r.y < this.Y)
                return this.Y - r.y;
            if (vy <= uy && this.y < r.Y)
                return r.Y - this.y;
            return 0;
        };

        Rectangle.prototype.setXCentre = function (cx) {
            var dx = cx - this.cx();
            this.x += dx;
            this.X += dx;
        };

        Rectangle.prototype.setYCentre = function (cy) {
            var dy = cy - this.cy();
            this.y += dy;
            this.Y += dy;
        };
        return Rectangle;
    })();
    vpsc.Rectangle = Rectangle;

    var Node = (function () {
        function Node(v, r, p) {
            this.v = v;
            this.r = r;
            this.pos = p;
            this.prev = makeRBTree();
            this.next = makeRBTree();
        }
        return Node;
    })();

    var Event = (function () {
        function Event(isOpen, v, p) {
            this.isOpen = isOpen;
            this.v = v;
            this.pos = p;
        }
        return Event;
    })();

    function compareEvents(a, b) {
        if (a.pos > b.pos) {
            return 1;
        }
        if (a.pos < b.pos) {
            return -1;
        }
        if (a.isOpen) {
            // open must come before close
            return -1;
        }
        return 0;
    }

    function makeRBTree() {
        return new RBTree(function (a, b) {
            return a.pos - b.pos;
        });
    }

    function generateConstraints(rs, vars, minSep, getCentre, getOpen, getClose, getSize, findNeighbours) {
        var i, n = rs.length;
        var N = 2 * n;
        console.assert(vars.length >= n);
        var events = new Array(N);
        for (i = 0; i < n; ++i) {
            var r = rs[i];
            var v = new Node(vars[i], r, getCentre(r));
            events[i] = new Event(true, v, getOpen(r));
            events[i + n] = new Event(false, v, getClose(r));
        }
        events.sort(compareEvents);
        var cs = new Array();
        var scanline = makeRBTree();
        for (i = 0; i < N; ++i) {
            var e = events[i];
            var v = e.v;
            if (e.isOpen) {
                scanline.insert(v);
                findNeighbours(v, scanline);
            } else {
                // close event
                scanline.remove(v);
                var makeConstraint = function (l, r) {
                    var sep = (getSize(l.r) + getSize(r.r)) / 2 + minSep;
                    cs.push(new vpsc.Constraint(l.v, r.v, sep));
                };
                var visitNeighbours = function (forward, reverse, mkcon) {
                    var u, it = v[forward].iterator();
                    while ((u = it[forward]()) !== null) {
                        mkcon(u, v);
                        u[reverse].remove(v);
                    }
                };
                visitNeighbours("prev", "next", function (u, v) {
                    return makeConstraint(u, v);
                });
                visitNeighbours("next", "prev", function (u, v) {
                    return makeConstraint(v, u);
                });
            }
        }
        console.assert(scanline.size === 0);
        return cs;
    }

    function findXNeighbours(v, scanline) {
        var f = function (forward, reverse) {
            var it = scanline.findIter(v);
            var u;
            while ((u = it[forward]()) !== null) {
                var uovervX = u.r.overlapX(v.r);
                if (uovervX <= 0 || uovervX <= u.r.overlapY(v.r)) {
                    v[forward].insert(u);
                    u[reverse].insert(v);
                }
                if (uovervX <= 0) {
                    break;
                }
            }
        };
        f("next", "prev");
        f("prev", "next");
    }

    function findYNeighbours(v, scanline) {
        var f = function (forward, reverse) {
            var u = scanline.findIter(v)[forward]();
            if (u !== null && u.r.overlapX(v.r) > 0) {
                v[forward].insert(u);
                u[reverse].insert(v);
            }
        };
        f("next", "prev");
        f("prev", "next");
    }

    function generateXConstraints(rs, vars) {
        return generateConstraints(rs, vars, 1e-6, function (r) {
            return r.cx();
        }, function (r) {
            return r.y;
        }, function (r) {
            return r.Y;
        }, function (r) {
            return r.X - r.x;
        }, findXNeighbours);
    }
    vpsc.generateXConstraints = generateXConstraints;

    function generateYConstraints(rs, vars) {
        return generateConstraints(rs, vars, 1e-6, function (r) {
            return r.cy();
        }, function (r) {
            return r.x;
        }, function (r) {
            return r.X;
        }, function (r) {
            return r.Y - r.y;
        }, findYNeighbours);
    }
    vpsc.generateYConstraints = generateYConstraints;

    function removeOverlaps(rs) {
        var vs = rs.map(function (r) {
            return new vpsc.Variable(r.cx());
        });
        var cs = vpsc.generateXConstraints(rs, vs);
        var solver = new vpsc.Solver(vs, cs);
        solver.solve();
        vs.forEach(function (v, i) {
            return rs[i].setXCentre(v.position());
        });
        vs = rs.map(function (r) {
            return new vpsc.Variable(r.cy());
        });
        cs = vpsc.generateYConstraints(rs, vs);
        solver = new vpsc.Solver(vs, cs);
        solver.solve();
        vs.forEach(function (v, i) {
            return rs[i].setYCentre(v.position());
        });
    }
    vpsc.removeOverlaps = removeOverlaps;
})(vpsc || (vpsc = {}));
