/// <reference path="d3.v3.min.js"/>
/// <reference path="../src/d3adaptor.js"/>
/// <reference path="../src/shortestpaths.js"/>
/// <reference path="../src/descent.js"/>
/// <reference path="../src/cola.vpsc.js"/>
/// <reference path="../src/rectangle.js"/>
/// <reference path="../src/geom.js"/>
/// <reference path="../src/powergraph.js"/>

asyncTest("small power-graph", function () {
    d3.json("../examples/graphdata/n7e23.json", function (error, graph) {
        var n = graph.nodes.length;
        ok(n == 7);
        var c = new cola.powergraph.Configuration(n, graph.links);
        ok(c.modules.length == 7);
        var es;
        ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);
        var m = c.merge(c.modules[0], c.modules[4]);
        ok(0 in m.children);
        ok(4 in m.children);
        ok(1 in m.outgoing);
        ok(3 in m.outgoing);
        ok(5 in m.outgoing);
        ok(6 in m.outgoing);
        ok(2 in m.incoming);
        ok(5 in m.incoming);
        ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);
        m = c.merge(c.modules[2], c.modules[3]);
        ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);

        c = new cola.powergraph.Configuration(n, graph.links);
        var lastR = c.R;
        while (c.greedyMerge()) {
            ok(c.R < lastR);
            lastR = c.R;
        }
        var finalEdges = [];
        var groups = c.getGroupHierarchy(finalEdges);
        ok(groups.length == 4);
        start();
    });
    ok(true);
});

asyncTest("all-pairs shortest paths", function () {
    var d3cola = cola.d3adaptor();

    d3.json("../examples/graphdata/triangle.json", function (error, graph) {
        d3cola
            .nodes(graph.nodes)
            .links(graph.links);
        var n = d3cola.nodes().length;
        equal(n, 4);
        var D = (new cola.shortestpaths.Calculator(n, d3cola.links())).DistanceMatrix();
        deepEqual(D, [
            [0, 1, 1, 2],
            [1, 0, 1, 2],
            [1, 1, 0, 1],
            [2, 2, 1, 0],
        ]);
        var x = [0, 0, 1, 1], y = [1, 0, 0, 1];
        var descent = new cola.Descent([x, y], D);
        var s0 = descent.reduceStress();
        var s1 = descent.reduceStress();
        ok(s1 < s0);
        var s2 = descent.reduceStress();
        ok(s2 < s1);
        d3cola.start(0,0,10);
        var lengths = graph.links.map(function (l) {
            var u = l.source, v = l.target,
                dx = u.x - v.x, dy = u.y - v.y;
            return Math.sqrt(dx*dx + dy*dy);
        }), avg = function (a) { return a.reduce(function (u, v) { return u + v }) / a.length },
            mean = avg(lengths),
            variance = avg(lengths.map(function (l) { var d = mean - l; return d * d; }));
        ok(variance < 0.1);
        start();
    });
    ok(true);
});

asyncTest("edge lengths", function () {
    var d3cola = cola.d3adaptor();

    d3.json("../examples/graphdata/triangle.json", function (error, graph) {
        d3cola
            .nodes(graph.nodes)
            .links(graph.links);
        d3cola.start(10);
        var lengths = graph.links.map(function (l) {
            var u = l.source, v = l.target,
                dx = u.x - v.x, dy = u.y - v.y;
            return Math.sqrt(dx * dx + dy * dy);
        }), avg = function (a) { return a.reduce(function (u, v) { return u + v }) / a.length },
            mean = avg(lengths),
            variance = avg(lengths.map(function (l) { var d = mean - l; return d * d; }));
        ok(variance < 0.1);
        start();
    });
    ok(true);
});

asyncTest("equality constraints", function () {
    var d3cola = cola.d3adaptor();

    d3.json("../examples/graphdata/triangle.json", function (error, graph) {
        d3cola
            .nodes(graph.nodes)
            .links(graph.links)
            .constraints([{
                type: "separation", axis: "x",
                left: 0, right: 1, gap: 0, equality: true
            }, {
                type: "separation", axis: "y",
                left: 0, right: 2, gap: 0, equality: true
            }]);
        d3cola.start(20, 20, 20);
        ok(Math.abs(graph.nodes[0].x - graph.nodes[1].x) < 0.001);
        ok(Math.abs(graph.nodes[0].y - graph.nodes[2].y) < 0.001);
        start();
    });
    ok(true);
});

test("convex hulls", function () {
    var draw = false;
    var rand = new cola.PseudoRandom();
    var nextInt = function (r) { return Math.round(rand.getNext() * r) }
    var width = 100, height = 100;

    for (var k = 0; k < 10; ++k) {
        if (draw) {
            var svg = d3.select("body").append("svg").attr("width", width).attr("height", height);
        }
        var P = [];
        for (var i = 0; i < 5; ++i) {
            var p;
            P.push(p = { x: nextInt(width), y: nextInt(height) });
            if (draw) svg.append("circle").attr("cx", p.x).attr("cy", p.y).attr('fill', 'green').attr("r", 5);
        }
        var h = cola.geom.ConvexHull(P);
        if (draw) {
            var lineFunction = d3.svg.line().x(function (d) { return d.x; }).y(function (d) { return d.y; }).interpolate("linear");
            svg.append("path").attr("d", lineFunction(h))
                .attr("stroke", "blue")
                .attr("stroke-width", 2)
                .attr("fill", "none");
        }

        for (var i = 2; i < h.length; ++i) {
            var p = h[i - 2], q = h[i - 1], r = h[i];
            ok(cola.geom.isLeft(p, q, r) >= 0, "clockwise hull " + i);
            for (var j = 0; j < P.length; ++j) {
                ok(cola.geom.isLeft(p, q, P[j]) >= 0, "" + j);
            }
        }
        ok(h[0] !== h[h.length - 1], "first and last point of hull are different" + k);
    }
});

test("radial sort", function () {
    var draw = false;
    var n = 100;
    var width = 400, height = 400;
    if (draw) {
        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height);
    }
    var P = [];
    var x = 0, y = 0;
    var rand = new cola.PseudoRandom(5);
    var nextInt = function (r) { return Math.round(rand.getNext() * r) }
    for (var i = 0; i < n; ++i) {
        var p;
        P.push(p = { x: nextInt(width), y: nextInt(height) });
        x += p.x; y += p.y;
        if (draw) svg.append("circle").attr("cx", p.x).attr("cy", p.y).attr('fill', 'green').attr("r", 5);
    }
    var q = { x: x / n, y: y / n };
    console.log(q);
    var p0 = null;
    cola.geom.clockwiseRadialSweep(q, P, function (p, i) {
        if (p0) {
            var il = cola.geom.isLeft(q, p0, p);
            ok(il >= 0);
        }
        p0 = p;
        if (draw) {
            svg.append("line").attr('x1', q.x).attr('y1', q.y).attr('x2', p.x).attr("y2", p.y)
                .attr("stroke", d3.interpolateRgb("yellow", "red")(i / n))
                .attr("stroke-width", 2)
        }
    });
});

function makePoly(rand) {
    var length = function (p, q) { var dx = p.x - q.x, dy = p.y - q.y; return dx * dx + dy * dy; };
    var nextInt = function (r) { return Math.round(rand.getNext() * r) }
    var n = nextInt(7) + 3, width = 10, height = 10;
    if (arguments.length > 1) {
        width = arguments[1];
        height = arguments[2];
    }
    var P = [];
    loop: for (var i = 0; i < n; ++i) {
        var p = { x: nextInt(width), y: nextInt(height) };
        var ctr = 0;
        while (i > 0 && length(P[i - 1], p) < 1 // min segment length is 1
            || i > 1 && ( // new point must keep poly convex
                    cola.geom.isLeft(P[i - 2], P[i - 1], p) <= 0
                || cola.geom.isLeft(P[i - 1], p, P[0]) <= 0
                || cola.geom.isLeft(p, P[0], P[1]) <= 0)) {
            if (ctr++ > 10) break loop; // give up after ten tries (maybe not enough space left for another convex point) 
            p = { x: nextInt(width), y: nextInt(height) };
        }
        P.push(p);
    }
    if (P.length > 2) { // must be at least triangular
        P.push({ x: P[0].x, y: P[0].y });
        return P;
    }
    return makePoly(rand, width, height);
}

function makeNonoverlappingPolys(rand, n) {
    var P = [];
    var nextInt = function (r) { return Math.round(rand.getNext() * r) }
    var overlaps = function (p) {
        for (var i = 0; i < P.length; i++) {
            var q = P[i];
            if (cola.geom.polysOverlap(p, q)) return true;
        }
        return false;
    }
    for (var i = 0; i < n; i++) {
        var p = makePoly(rand);
        while (overlaps(p)) {
            var dx = nextInt(10) - 5, dy = nextInt(10) - 5;
            p.forEach(function (p) { p.x += dx; p.y += dy; });
        }
        P.push(p);
    }
    var minX = 0, minY = 0;
    P.forEach(function (p) { p.forEach(function (p) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
        })
    });
    P.forEach(function (p) {
        p.forEach(function (p) { p.x -= minX; p.y -= minY; });
    });
    return P;
}

function drawPoly(svg, P) {
    for (var i = 0; i < P.length; ++i) {
        var lineFunction = d3.svg.line().x(function (d) { return d.x * 10; }).y(function (d) { return d.y * 10; }).interpolate("linear");
        svg.append("path").attr("d", lineFunction(P))
            .attr("stroke", "blue")
            .attr("stroke-width", 1)
            .attr("fill", "none");
    }
    if (arguments.length > 2) {
        var label = arguments[2];
        svg.append("text").attr("x", 10 * P[0].x).attr("y", 10 * P[0].y).attr("fill", "red").text(label);
    }
}

function drawLine(svg, l) {
    var stroke = "green";
    if (arguments.length > 2) {
        stroke = arguments[2];
    }
    svg.append("line").attr('x1', 10 * l.x1).attr('y1', 10 * l.y1).attr('x2', 10 * l.x2).attr("y2", 10 * l.y2)
                    .attr("stroke", stroke)
                    .attr("stroke-width", 1);
}

function drawCircle(svg, p) {
    svg.append("circle").attr("cx", 10 * p.x).attr("cy", 10 * p.y).attr('fill', 'red').attr("r", 2);
}

function midPoint(p) {
    var mx = 0, my = 0;
    var n = p.length - 1;
    for (var i = 0; i < n; i++) {
        var q = p[i];
        mx += q.x;
        my += q.y;
    }
    return { x: mx/n, y: my/n };
}

test("tangent visibility graph", function () {
    var draw = false;
    for (var tt = 0; tt < 100; tt++) {
        var rand = new cola.PseudoRandom(tt),
            nextInt = function (r) { return Math.round(rand.getNext() * r) },
            n = 10,
            P = makeNonoverlappingPolys(rand, n),
            port1 = midPoint(P[8]),
            port2 = midPoint(P[9]),
            g = new cola.geom.TangentVisibilityGraph(P),
            start = g.addPoint(port1, 8),
            end = g.addPoint(port2, 9);
        g.addEdgeIfVisible(port1, port2, 8, 9);
        var es = g.E.map(function (e) { return { source: e.source.id, target: e.target.id, length: e.length() } }),
            shortestPath = (new cola.shortestpaths.Calculator(g.V.length, es)).PathFromNodeToNode(start.id, end.id);
        if (draw) {
            d3.select("body").append("p").html(tt);
            var svg = d3.select("body").append("svg").attr("width", 800).attr("height", 250);
            P.forEach(function (p, i) { drawPoly(svg, p /*, i*/) });
            //g.E.forEach(function (e) {
            //    drawLine(svg, { x1: e.source.p.x, y1: e.source.p.y, x2: e.target.p.x, y2: e.target.p.y });
            //});
            for (var i = 0; i < shortestPath.length; i++) {
                var u = i === 0 ? end : g.V[shortestPath[i - 1]];
                var v = g.V[shortestPath[i]];
                drawLine(svg, { x1: u.p.x, y1: u.p.y, x2: v.p.x, y2: v.p.y }, "orange");
            }
            drawCircle(svg, port1);
            drawCircle(svg, port2);
        }
    }
    ok(true);
});

test("tangents", function () {
    var draw = false;
    var rand = new cola.PseudoRandom();
    var rect = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 10, y: 20 }, { x: 20, y: 20 }];
    var pnt = [{ x: 0, y: 0 }];
    var t1 = cola.geom.tangents(pnt, rect);
    for (var j = 0; j < 100; j++) {
        var A = makePoly(rand), B = makePoly(rand);
        B.forEach(function (p) { p.x += 11 });
        //if (j !== 207) continue;
        var t = cola.geom.tangents(A, B);
        // ok(t.length === 4, t.length + " tangents found at j="+j);
        if (draw) {
            var getLine = function (tp) {
                return { x1: A[tp.t1].x, y1: A[tp.t1].y, x2: B[tp.t2].x, y2: B[tp.t2].y };
            }
            d3.select("body").append("p").html(j);
            var svg = d3.select("body").append("svg").attr("width", 800).attr("height", 100);
            drawPoly(svg, A);
            drawPoly(svg, B);
            for (var p in t) {
                var l = getLine(t[p]);
                drawLine(svg, l);
                var ints = intersects(l, A).concat(intersects(l, B));
                ok (ints.length <= 4, ints.length + " intersects found at "+j);
            }
        }
    }
    ok(true);
});

function intersects(l, P) {
    var ints = [];
    for (var i = 1; i < P.length; ++i) {
        var int = cola.vpsc.Rectangle.lineIntersection(
            l.x1, l.y1,
            l.x2, l.y2,
            P[i-1].x, P[i-1].y,
            P[i].x, P[i].y
            );
        if (int) ints.push(int);
    }
    return ints;
}

test("pseudo random number test", function () {
    var rand = new cola.PseudoRandom();
    for (var i = 0; i < 100; ++i) {
        var r = rand.getNext();
        ok(r <= 1, "r=" + r);
        ok(r >= 0, "r=" + r);
        r = rand.getNextBetween(5, 10);
        ok(r <= 10, "r=" + r);
        ok(r >= 5, "r=" + r);
        r = rand.getNextBetween(-5, 0);
        ok(r <= 0, "r=" + r);
        ok(r >= -5, "r=" + r);
        //console.log(r);
    }
});

test("rectangle intersections", function () {
    var r = new cola.vpsc.Rectangle(2, 4, 0, 2);
    var p = r.rayIntersection(0, 1);
    ok(p.x == 2);
    ok(p.y == 1);
    p = r.rayIntersection(0, 0);
    ok(p.x == 2);
});

test("matrix perf test", function () {
    ok(true); return; // disable

    var now = window.performance ? function () { return window.performance.now(); } : function () { };
    console.log("Array test:");
    var startTime = now();
    var totalRegularArrayTime = 0;
    var repeats = 1000;
    var n = 100;
    var M;
    for (var k = 0; k < repeats; ++k) {
        M = new Array(n);
        for (var i = 0; i < n; ++i) {
            M[i] = new Array(n);
        }
    }

    var t = now() - startTime;
    console.log("init = " + t);
    totalRegularArrayTime += t;
    startTime = now();
    for (var k = 0; k < repeats; ++k) {
        for (var i = 0; i < n; ++i) {
            for (var j = 0; j < n; ++j) {
                M[i][j] = 1;
            }
        }
    }

    var t = now() - startTime;
    console.log("write array = " + t);
    totalRegularArrayTime += t;
    startTime = now();
    for (var k = 0; k < repeats; ++k) {
        var sum = 0;
        for (var i = 0; i < n; ++i) {
            for (var j = 0; j < n; ++j) {
                sum += M[i][j];
            }
        }
        //equal(sum, n * n);
    }
    var t = now() - startTime;
    console.log("read array = " + t);
    totalRegularArrayTime += t;
    startTime = now();
    ok(true);

    var totalTypedArrayTime = 0;
    console.log("Typed Array test:");
    var startTime = now();
    for (var k = 0; k < repeats; ++k) {
        MT = new Float32Array(n * n);
    }

    var t = now() - startTime;
    console.log("init = " + t);
    totalTypedArrayTime += t;
    startTime = now();
    for (var k = 0; k < repeats; ++k) {
        for (var i = 0; i < n * n; ++i) {
            MT[i] = 1;
        }
    }
    var t = now() - startTime;
    console.log("write array = " + t);
    totalTypedArrayTime += t;
    startTime = now();
    for (var k = 0; k < repeats; ++k) {
        var sum = 0;
        for (var i = 0; i < n * n; ++i) {
            sum += MT[i];
        }
        //equal(sum, n * n);
    }
    var t = now() - startTime;
    console.log("read array = " + t);
    totalTypedArrayTime += t;
    startTime = now();
    ok(isNaN(totalRegularArrayTime) || totalRegularArrayTime < totalTypedArrayTime, "totalRegularArrayTime=" + totalRegularArrayTime + " totalTypedArrayTime="+totalTypedArrayTime+" - if this consistently fails then maybe we should switch to typed arrays");
});

/// <reference path="pqueue.js"/>
test("priority queue test", function () {
    var q = new cola.PriorityQueue(function (a, b) { return a <= b; });
    q.push(42, 5, 23, 5, Math.PI);
    var u = Math.PI, v;
    strictEqual(u, q.top());
    var cnt = 0;
    while ((v = q.pop()) !== null) {
        ok(u <= v);
        u = v;
        ++cnt;
    }
    equal(cnt, 5);
    q.push(42, 5, 23, 5, Math.PI);
    var k = q.push(13);
    strictEqual(Math.PI, q.top());
    q.reduceKey(k, 2);
    u = q.top();
    strictEqual(u, 2);
    cnt = 0;
    while ((v = q.pop()) !== null) {
        ok(u <= v);
        u = v;
        ++cnt;
    }
    equal(cnt, 6);
});

function getLinks(graph) {
    var m = graph.length;
    var links = new Array(m);
    for (var i = 0; i < m; ++i) {
        var e = graph[i];
        links[i] = { source: e[0], target: e[1] };
    }
    return links;
}

/// <reference path="shortestpaths.js"/>
test("dijkstra", function () {
    // 0  4-3
    //  \/ /
    //  1-2
    var n = 5;
    var links = getLinks([[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]])
    var calc = new cola.shortestpaths.Calculator(n, links);
    var d = calc.DistancesFromNode(0);
    deepEqual(d, [0, 1, 2, 3, 2]);
    var D = calc.DistanceMatrix();
    deepEqual(D, [
        [0, 1, 2, 3, 2],
        [1, 0, 1, 2, 1],
        [2, 1, 0, 1, 2],
        [3, 2, 1, 0, 1],
        [2, 1, 2, 1, 0]
    ]);
});

/// <reference path="cola.vpsc.js"/>
/// <reference path="vpsctests.js"/>
test("vpsc", function () {
    var round = function (v, p) {
        var m = Math.pow(10, p);
        return Math.round(v * m) / m;
    };
    var rnd = function (a, p) {
        if (typeof p === "undefined") { p = 4; }
        return a.map(function (v) { return round(v, p) })
    };
    var res = function (a, p) {
        if (typeof p === "undefined") { p = 4; }
        return a.map(function (v) { return round(v.position(), p) })
    };
    vpsctestcases.forEach(function (t) {
        var vs = t.variables.map(function (u, i) {
            var v;
            if (typeof u === "number") {
                v = new cola.vpsc.Variable(u);
            } else {
                v = new cola.vpsc.Variable(u.desiredPosition, u.weight, u.scale);
            }
            v.id = i;
            return v;
        });
        var cs = t.constraints.map(function (c) {
            return new cola.vpsc.Constraint(vs[c.left], vs[c.right], c.gap);
        });
        var solver = new cola.vpsc.Solver(vs, cs);
        solver.solve();
        if (typeof t.expected !== "undefined") {
            deepEqual(rnd(t.expected, t.precision), res(vs, t.precision), t.description);
        }
    });
});

/// <reference path="rbtree.js"/>
test("rbtree", function () {
    var tree = new RBTree(function (a, b) { return a - b });
    var data = [5, 8, 3, 1, 7, 6, 2];
    data.forEach(function (d) { tree.insert(d); });
    var it = tree.iterator(), item;
    var prev = 0;
    while ((item = it.next()) !== null) {
        ok(prev < item);
        prev = item;
    }

    var m = tree.findIter(5);
    ok(m.prev(3));
    ok(m.next(6));
});

/// <reference path="rectangle.js"/>
test("overlap removal", function () {
    var rs = [
        new cola.vpsc.Rectangle(0, 2, 0, 1),
        new cola.vpsc.Rectangle(1, 3, 0, 1)
    ];
    equal(rs[0].overlapX(rs[1]), 1);
    equal(rs[0].overlapY(rs[1]), 1);
    var vs = rs.map(function (r) {
        return new cola.vpsc.Variable(r.cx());
    });
    var cs = cola.vpsc.generateXConstraints(rs, vs);
    equal(cs.length, 1);
    var solver = new cola.vpsc.Solver(vs, cs);
    solver.solve();
    vs.forEach(function(v, i) {
        rs[i].setXCentre(v.position());
    });
    equal(rs[0].overlapX(rs[1]), 0);
    equal(rs[0].overlapY(rs[1]), 1);

    vs = rs.map(function (r) {
        return new cola.vpsc.Variable(r.cy());
    });
    cs = cola.vpsc.generateYConstraints(rs, vs);
    equal(cs.length, 0);
});

test("cola.vpsc.removeOverlaps", function () {
    var overlaps = function (rs) {
        var cnt = 0;
        for (var i = 0, n = rs.length; i < n - 1; ++i) {
            var r1 = rs[i];
            for (var j = i + 1; j < n; ++j) {
                var r2 = rs[j];
                if (r1.overlapX(r2) > 0 && r1.overlapY(r2) > 0) {
                    cnt++;
                }
            }
        }
        return cnt;
    };
    var rs = [
        new cola.vpsc.Rectangle(0, 4, 0, 4),
        new cola.vpsc.Rectangle(3, 5, 1, 2),
        new cola.vpsc.Rectangle(1, 3, 3, 5)
    ];
    equal(overlaps(rs), 2);
    cola.vpsc.removeOverlaps(rs);
    equal(overlaps(rs), 0);
    equal(rs[1].y, 1);
    equal(rs[1].Y, 2);

    rs = [
        new cola.vpsc.Rectangle(148.314,303.923,94.4755,161.84969999999998),
        new cola.vpsc.Rectangle(251.725,326.6396,20.0193,69.68379999999999),
        new cola.vpsc.Rectangle(201.235,263.6349,117.221,236.923),
        new cola.vpsc.Rectangle(127.445,193.7047,46.5891,186.5991),
        new cola.vpsc.Rectangle(194.259,285.7201,204.182,259.13239999999996)
    ];
    cola.vpsc.removeOverlaps(rs);
    equal(overlaps(rs), 0);
});

