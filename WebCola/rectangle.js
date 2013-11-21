///<reference path="vpsc.ts"/>
///<reference path="rbtree.d.ts"/>
var vpsc;
(function (vpsc) {
    function computeGroupBounds(g) {
        g.bounds = g.leaves.reduce(function (r, c) {
            return c.bounds.union(r);
        }, Rectangle.empty());
        if (typeof g.groups !== "undefined")
            g.bounds = g.groups.reduce(function (r, c) {
                return computeGroupBounds(c).union(r);
            }, g.bounds);
        return g.bounds;
    }
    vpsc.computeGroupBounds = computeGroupBounds;

    var Rectangle = (function () {
        function Rectangle(x, X, y, Y) {
            this.x = x;
            this.X = X;
            this.y = y;
            this.Y = Y;
        }
        Rectangle.empty = function () {
            return new Rectangle(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);
        };

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

        Rectangle.prototype.width = function () {
            return this.X - this.x;
        };

        Rectangle.prototype.height = function () {
            return this.Y - this.y;
        };

        Rectangle.prototype.union = function (r) {
            return new Rectangle(Math.min(this.x, r.x), Math.max(this.X, r.X), Math.min(this.y, r.y), Math.max(this.Y, r.Y));
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

    var xRect = {
        getCentre: function (r) {
            return r.cx();
        },
        getOpen: function (r) {
            return r.y;
        },
        getClose: function (r) {
            return r.Y;
        },
        getSize: function (r) {
            return r.width();
        },
        makeRect: function (open, close, center, size) {
            return new Rectangle(center - size / 2, center + size / 2, open, close);
        },
        findNeighbours: findXNeighbours
    };

    var yRect = {
        getCentre: function (r) {
            return r.cy();
        },
        getOpen: function (r) {
            return r.x;
        },
        getClose: function (r) {
            return r.X;
        },
        getSize: function (r) {
            return r.height();
        },
        makeRect: function (open, close, center, size) {
            return new Rectangle(open, close, center - size / 2, center + size / 2);
        },
        findNeighbours: findYNeighbours
    };

    function generateGroupConstraints(root, rect, minSep, isContained) {
        if (typeof isContained === "undefined") { isContained = false; }
        var padding = typeof root.padding === 'undefined' ? 1 : root.padding;
        var childConstraints = [];
        var gn = typeof root.groups !== 'undefined' ? root.groups.length : 0, ln = typeof root.leaves !== 'undefined' ? root.leaves.length : 0;
        if (gn)
            root.groups.forEach(function (g) {
                childConstraints = childConstraints.concat(generateGroupConstraints(g, rect, minSep, true));
            });
        var n = (isContained ? 2 : 0) + ln + gn;
        var vs = new Array(n);
        var rs = new Array(n);
        var i = 0;
        if (isContained) {
            var c = rect.getCentre(root.bounds), s = rect.getSize(root.bounds) / 2, open = rect.getOpen(root.bounds), close = rect.getClose(root.bounds);
            rs[i] = root.minRect = rect.makeRect(open, close, c - s, padding);
            root.minVar.desiredPosition = rect.getCentre(root.minRect);
            vs[i++] = root.minVar;
            rs[i] = root.maxRect = rect.makeRect(open, close, c + s, padding);
            root.minVar.desiredPosition = rect.getCentre(root.maxRect);
            vs[i++] = root.maxVar;
        }
        if (ln)
            root.leaves.forEach(function (l) {
                rs[i] = l.bounds;
                vs[i++] = l.variable;
            });
        if (gn)
            root.groups.forEach(function (g) {
                rs[i] = g.minRect = rect.makeRect(rect.getOpen(g.bounds), rect.getClose(g.bounds), rect.getCentre(g.bounds), rect.getSize(g.bounds));
                vs[i++] = g.minVar;
            });
        var cs = generateConstraints(rs, vs, rect, minSep);
        if (gn) {
            vs.forEach(function (v) {
                v.cOut = [], v.cIn = [];
            });
            cs.forEach(function (c) {
                c.left.cOut.push(c), c.right.cIn.push(c);
            });
            root.groups.forEach(function (g) {
                var gapAdjustment = (padding - rect.getSize(g.bounds)) / 2;
                g.minVar.cIn.forEach(function (c) {
                    return c.gap += gapAdjustment;
                });
                g.minVar.cOut.forEach(function (c) {
                    c.left = g.maxVar;
                    c.gap += gapAdjustment;
                });
            });
        }
        return childConstraints.concat(cs);
    }

    function generateConstraints(rs, vars, rect, minSep) {
        var i, n = rs.length;
        var N = 2 * n;
        console.assert(vars.length >= n);
        var events = new Array(N);
        for (i = 0; i < n; ++i) {
            var r = rs[i];
            var v = new Node(vars[i], r, rect.getCentre(r));
            events[i] = new Event(true, v, rect.getOpen(r));
            events[i + n] = new Event(false, v, rect.getClose(r));
        }
        events.sort(compareEvents);
        var cs = new Array();
        var scanline = makeRBTree();
        for (i = 0; i < N; ++i) {
            var e = events[i];
            var v = e.v;
            if (e.isOpen) {
                scanline.insert(v);
                rect.findNeighbours(v, scanline);
            } else {
                // close event
                scanline.remove(v);
                var makeConstraint = function (l, r) {
                    var sep = (rect.getSize(l.r) + rect.getSize(r.r)) / 2 + minSep;
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
        return generateConstraints(rs, vars, xRect, 1e-6);
    }
    vpsc.generateXConstraints = generateXConstraints;

    function generateYConstraints(rs, vars) {
        return generateConstraints(rs, vars, yRect, 1e-6);
    }
    vpsc.generateYConstraints = generateYConstraints;

    function generateXGroupConstraints(root) {
        return generateGroupConstraints(root, xRect, 1e-6);
    }
    vpsc.generateXGroupConstraints = generateXGroupConstraints;

    function generateYGroupConstraints(root) {
        return generateGroupConstraints(root, yRect, 1e-6);
    }
    vpsc.generateYGroupConstraints = generateYGroupConstraints;

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
//# sourceMappingURL=rectangle.js.map
