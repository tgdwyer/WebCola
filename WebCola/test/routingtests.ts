import * as d3 from 'd3';
import * as QUnit from 'qunit';
import * as cola from '../index';

QUnit.module("Geom")
QUnit.test("convex hulls", function (assert) {
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
        var h = <any>cola.ConvexHull(P);
        if (draw) {
            var lineFunction = d3.line()
              .curve(d3.curveLinear)
              .x(function (d:any) { return d.x; })
              .y(function (d:any) { return d.y; });
            svg.append("path").attr("d", lineFunction(<any>h))
                .attr("stroke", "blue")
                .attr("stroke-width", 2)
                .attr("fill", "none");
        }

        for (var i = 2; i < h.length; ++i) {
            var p = h[i - 2], q = h[i - 1], r = h[i];
            assert.ok(cola.isLeft(p, q, r) >= 0, "clockwise hull " + i);
            for (var j = 0; j < P.length; ++j) {
                assert.ok(cola.isLeft(p, q, P[j]) >= 0, "" + j);
            }
        }
        assert.ok(h[0] !== h[h.length - 1], "first and last point of hull are different" + k);
    }
});

QUnit.test("radial sort", function (assert) {
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
    //console.log(q);
    var p0 = null;
    cola.clockwiseRadialSweep(q, P, <any>function (p, i) {
        if (p0) {
            var il = cola.isLeft(q, p0, p);
            assert.ok(il >= 0);
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
                    cola.isLeft(P[i - 2], P[i - 1], p) <= 0
                || cola.isLeft(P[i - 1], p, P[0]) <= 0
                || cola.isLeft(p, P[0], P[1]) <= 0)) {
            if (ctr++ > 10) break loop; // give up after ten tries (maybe not enough space left for another convex point)
            p = { x: nextInt(width), y: nextInt(height) };
        }
        P.push(p);
    }
    if (P.length > 2) { // must be at least triangular
        //P.push({ x: P[0].x, y: P[0].y });
        return P;
    }
    return makePoly(rand);
}

function makeNonoverlappingPolys(rand, n) {
    var P = [];
    var nextInt = function (r) { return Math.round(rand.getNext() * r) }
    var overlaps = function (p) {
        for (var i = 0; i < P.length; i++) {
            var q = P[i];
            if (cola.polysOverlap(p, q)) return true;
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
        var lineFunction = d3.line()
          .curve(d3.curveLinear)
          .x(function (d:any) { return d.x * 10; })
          .y(function (d:any) { return d.y * 10; })
        svg.append("path")
            .attr('d', lineFunction(P))
            .attr('stroke', "blue")
            .attr('stroke-width', 1)
            .attr('fill', "none");
    }
    if (arguments.length > 2) {
        var label = arguments[2];
        svg.append("text").attr("x", 10 * P[0].x).attr("y", 10 * P[0].y).attr("fill", "red").text(label);
    }
}

function drawLine(svg, l, stroke = "green") {
    svg.append("line")
      .attr('x1', 10 * l.x1)
      .attr('y1', 10 * l.y1)
      .attr('x2', 10 * l.x2)
      .attr('y2', 10 * l.y2)
      .attr('stroke', stroke)
      .attr('stroke-width', 2);
}

function drawCircle(svg, p) {
    svg.append("circle")
      .attr('cx', 10 * p.x)
      .attr('cy', 10 * p.y)
      .attr('fill', 'red')
      .attr('r', 3);
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
QUnit.test("tangent visibility graph", function (assert) {
    var draw = false;
    for (var tt = 0; tt < 1; tt++) {
        var rand = new cola.PseudoRandom(tt),
            nextInt = function (r) { return Math.round(rand.getNext() * r) },
            n = 10,
            P = makeNonoverlappingPolys(rand, n),
            port1 = <cola.TVGPoint>midPoint(P[8]),
            port2 = <cola.TVGPoint>midPoint(P[9]),
            g = new cola.TangentVisibilityGraph(P),
            start = g.addPoint(port1, 8),
            end = g.addPoint(port2, 9);
        g.addEdgeIfVisible(port1, port2, 8, 9);
        var getSource = function (e) { return e.source.id }, getTarget = function(e) { return e.target.id}, getLength = function(e) { return e.length() }
        var shortestPath = (new cola.Calculator(g.V.length, g.E, getSource, getTarget, getLength)).PathFromNodeToNode(start.id, end.id);
        assert.ok(shortestPath.length > 0);
        if (draw) {
            d3.select("body").append("p").html(tt+"");
            var svg = d3.select("body").append("svg").attr("width", 800).attr("height", 250);
            P.forEach(function (p, i) { drawPoly(svg, p /*, i*/) });

            //draw visibility graph:
            g.E.forEach(function (e) {
               drawLine(svg, { x1: e.source.p.x, y1: e.source.p.y, x2: e.target.p.x, y2: e.target.p.y });
            });
            for (var i = 0; i < shortestPath.length; i++) {
                var u = i === 0 ? end : g.V[shortestPath[i - 1]];
                var v = g.V[shortestPath[i]];
                drawLine(svg, { x1: u.p.x, y1: u.p.y, x2: v.p.x, y2: v.p.y }, "orange");
            }
            drawCircle(svg, port1);
            drawCircle(svg, port2);
        }
    }
    assert.ok(true);
});

QUnit.test("tangents", function (assert) {
    var draw = false;
    var rand = new cola.PseudoRandom();
    var rect = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 10, y: 20 }, { x: 20, y: 20 }];
    var pnt = [{ x: 0, y: 0 }];
    var t1 = cola.tangents(pnt, rect);
    for (var j = 0; j < 100; j++) {
        var A = makePoly(rand), B = makePoly(rand);
        B.forEach(function (p) { p.x += 11 });
        //if (j !== 207) continue;
        var t = cola.tangents(A, B);
        // ok(t.length === 4, t.length + " tangents found at j="+j);
        if (draw) {
            var getLine = function (tp) {
                return { x1: A[tp.t1].x, y1: A[tp.t1].y, x2: B[tp.t2].x, y2: B[tp.t2].y };
            }
            d3.select("body").append("p").html(j+"");
            var svg = d3.select("body").append("svg").attr('width', 800).attr('height', 100);
            drawPoly(svg, A);
            drawPoly(svg, B);
            for (var p in t) {
                var l = getLine(t[p]);
                drawLine(svg, l);
                var ints = intersects(l, A).concat(intersects(l, B));
                assert.ok (ints.length <= 4, ints.length + " intersects found at "+j);
            }
        }
    }
    assert.ok(true);
});

function intersects(l, P) {
    var ints = [];
    for (var i = 1; i < P.length; ++i) {
        var int = cola.Rectangle.lineIntersection(
            l.x1, l.y1,
            l.x2, l.y2,
            P[i-1].x, P[i-1].y,
            P[i].x, P[i].y
            );
        if (int) ints.push(int);
    }
    return ints;
}

QUnit.test("pseudo random number test", function (assert) {
    var rand = new cola.PseudoRandom();
    for (var i = 0; i < 100; ++i) {
        var r = rand.getNext();
        assert.ok(r <= 1, "r=" + r);
        assert.ok(r >= 0, "r=" + r);
        r = rand.getNextBetween(5, 10);
        assert.ok(r <= 10, "r=" + r);
        assert.ok(r >= 5, "r=" + r);
        r = rand.getNextBetween(-5, 0);
        assert.ok(r <= 0, "r=" + r);
        assert.ok(r >= -5, "r=" + r);
        //console.log(r);
    }
});

QUnit.test("rectangle intersections", function (assert) {
    var r = new cola.Rectangle(2, 4, 0, 2);
    var p = r.rayIntersection(0, 1);
    assert.ok(p.x == 2);
    assert.ok(p.y == 1);
    p = r.rayIntersection(0, 0);
    assert.ok(p.x == 2);
});

QUnit.test("matrix perf test", function (assert) {
    assert.ok(true); 
    if (true) return; // disable

    var now = function () { return window.performance.now(); } 
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
    assert.ok(true);

    var totalTypedArrayTime = 0;
    console.log("Typed Array test:");
    var startTime = now();
    var MT;
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
    assert.ok(isNaN(totalRegularArrayTime) || totalRegularArrayTime < totalTypedArrayTime, "totalRegularArrayTime=" + totalRegularArrayTime + " totalTypedArrayTime="+totalTypedArrayTime+" - if this consistently fails then maybe we should switch to typed arrays");
});

QUnit.test("priority queue test", function (assert) {
    var q = new cola.PriorityQueue(function (a, b) { return a <= b; });
    q.push(42, 5, 23, 5, Math.PI);
    var u = Math.PI, v;
    assert.strictEqual(u, q.top());
    var cnt = 0;
    while ((v = q.pop()) !== null) {
        assert.ok(u <= v);
        u = v;
        ++cnt;
    }
    assert.equal(cnt, 5);
    q.push(42, 5, 23, 5, Math.PI);
    var k = q.push(13);
    assert.strictEqual(Math.PI, q.top());
    q.reduceKey(k, 2);
    u = <number>q.top();
    assert.strictEqual(u, 2);
    cnt = 0;
    while ((v = q.pop()) !== null) {
        assert.ok(u <= v);
        u = v;
        ++cnt;
    }
    assert.equal(cnt, 6);
});

QUnit.test("dijkstra", function (assert) {
    // 0  4-3
    //  \/ /
    //  1-2
    var n = 5;
    var links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]],
        getSource = function (l) { return l[0] }, getTarget = function (l) { return l[1] }, getLength = function(l) { return 1 }
    var calc = new cola.Calculator(n, links, getSource, getTarget, getLength);
    var d = calc.DistancesFromNode(0);
    assert.deepEqual(d, [0, 1, 2, 3, 2]);
    var D = calc.DistanceMatrix();
    assert.deepEqual(D, [
        [0, 1, 2, 3, 2],
        [1, 0, 1, 2, 1],
        [2, 1, 0, 1, 2],
        [3, 2, 1, 0, 1],
        [2, 1, 2, 1, 0]
    ]);
});