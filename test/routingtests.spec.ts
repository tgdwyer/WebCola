import * as d3 from 'd3';
import { PseudoRandom, ConvexHull, isLeft, clockwiseRadialSweep, polysOverlap, TVGPoint, TangentVisibilityGraph, Calculator, tangents, Rectangle, PriorityQueue } from '../src';

describe("Geom", () => {
    test("convex hulls", () => {
        var draw = false;
        var rand = new PseudoRandom();
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
            var h = <any>ConvexHull(P);
            if (draw) {
                var lineFunction = d3.line()
                    .curve(d3.curveLinear)
                    .x(function (d: any) { return d.x; })
                    .y(function (d: any) { return d.y; });
                svg.append("path").attr("d", lineFunction(<any>h))
                    .attr("stroke", "blue")
                    .attr("stroke-width", 2)
                    .attr("fill", "none");
            }

            for (var i = 2; i < h.length; ++i) {
                var p = h[i - 2], q = h[i - 1], r = h[i];
                expect(isLeft(p, q, r) >= 0 || "clockwise hull " + i).toBe(true);
                for (var j = 0; j < P.length; ++j) {
                    expect(isLeft(p, q, P[j]) >= 0 || "" + j).toBe(true);
                }
            }
            expect(h[0] !== h[h.length - 1] || "first and last point of hull are different" + k).toBe(true);
        }
    });

    test("radial sort", () => {
        var draw = false;
        var n = 100;
        var width = 400, height = 400;
        if (draw) {
            var svg = d3.select("body").append("svg").attr("width", width).attr("height", height);
        }
        var P = [];
        var x = 0, y = 0;
        var rand = new PseudoRandom(5);
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
        clockwiseRadialSweep(q, P, <any>function (p, i) {
            if (p0) {
                var il = isLeft(q, p0, p);
                expect(il >= 0).toBe(true);
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
                    isLeft(P[i - 2], P[i - 1], p) <= 0
                    || isLeft(P[i - 1], p, P[0]) <= 0
                    || isLeft(p, P[0], P[1]) <= 0)) {
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
                if (polysOverlap(p, q)) return true;
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
        P.forEach(function (p) {
            p.forEach(function (p) {
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
                .x(function (d: any) { return d.x * 10; })
                .y(function (d: any) { return d.y * 10; })
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
        return { x: mx / n, y: my / n };
    }
    test("tangent visibility graph", () => {
        var draw = false;
        for (var tt = 0; tt < 1; tt++) {
            var rand = new PseudoRandom(tt),
                nextInt = function (r) { return Math.round(rand.getNext() * r) },
                n = 10,
                P = makeNonoverlappingPolys(rand, n),
                port1 = <TVGPoint>midPoint(P[8]),
                port2 = <TVGPoint>midPoint(P[9]),
                g = new TangentVisibilityGraph(P),
                start = g.addPoint(port1, 8),
                end = g.addPoint(port2, 9);
            g.addEdgeIfVisible(port1, port2, 8, 9);
            var getSource = function (e) { return e.source.id }, getTarget = function (e) { return e.target.id }, getLength = function (e) { return e.length() }
            var shortestPath = (new Calculator(g.V.length, g.E, getSource, getTarget, getLength)).PathFromNodeToNode(start.id, end.id);
            expect(shortestPath.length > 0).toBe(true);
            if (draw) {
                d3.select("body").append("p").html(tt + "");
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
        expect(true).toBe(true);
    });

    test("tangents", () => {
        var draw = false;
        var rand = new PseudoRandom();
        var rect = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 10, y: 20 }, { x: 20, y: 20 }];
        var pnt = [{ x: 0, y: 0 }];
        var t1 = tangents(pnt, rect);
        for (var j = 0; j < 100; j++) {
            var A = makePoly(rand), B = makePoly(rand);
            B.forEach(function (p) { p.x += 11 });
            //if (j !== 207) continue;
            var t = tangents(A, B);
            // ok(t.length === 4, t.length + " tangents found at j="+j);
            if (draw) {
                var getLine = function (tp) {
                    return { x1: A[tp.t1].x, y1: A[tp.t1].y, x2: B[tp.t2].x, y2: B[tp.t2].y };
                }
                d3.select("body").append("p").html(j + "");
                var svg = d3.select("body").append("svg").attr('width', 800).attr('height', 100);
                drawPoly(svg, A);
                drawPoly(svg, B);
                for (var p in t) {
                    var l = getLine(t[p]);
                    drawLine(svg, l);
                    var ints = intersects(l, A).concat(intersects(l, B));
                    expect(ints.length <= 4 || ints.length + " intersects found at " + j).toBe(true);
                }
            }
        }
        expect(true).toBe(true);
    });

    function intersects(l, P) {
        var ints = [];
        for (var i = 1; i < P.length; ++i) {
            var int = Rectangle.lineIntersection(
                l.x1, l.y1,
                l.x2, l.y2,
                P[i - 1].x, P[i - 1].y,
                P[i].x, P[i].y
            );
            if (int) ints.push(int);
        }
        return ints;
    }

    test("pseudo random number test", () => {
        var rand = new PseudoRandom();
        for (var i = 0; i < 100; ++i) {
            var r = rand.getNext();
            expect(r <= 1 || "r=" + r).toBe(true);
            expect(r >= 0 || "r=" + r).toBe(true);
            r = rand.getNextBetween(5, 10);
            expect(r <= 10 || "r=" + r).toBe(true);
            expect(r >= 5 || "r=" + r).toBe(true);
            r = rand.getNextBetween(-5, 0);
            expect(r <= 0 || "r=" + r).toBe(true);
            expect(r >= -5 || "r=" + r).toBe(true);
            //console.log(r);
        }
    });

    test("rectangle intersections", () => {
        var r = new Rectangle(2, 4, 0, 2);
        var p = r.rayIntersection(0, 1);
        expect(p.x == 2).toBe(true);
        expect(p.y == 1).toBe(true);
        p = r.rayIntersection(0, 0);
        expect(p.x == 2).toBe(true);
    });

    test("priority queue test", () => {
        var q = new PriorityQueue(function (a, b) { return a <= b; });
        q.push(42, 5, 23, 5, Math.PI);
        var u = Math.PI, v;
        expect(u).toBe(q.top());
        var cnt = 0;
        while ((v = q.pop()) !== null) {
            expect(u <= v).toBe(true);
            u = v;
            ++cnt;
        }
        expect(cnt).toBe(5);
        q.push(42, 5, 23, 5, Math.PI);
        var k = q.push(13);
        expect(Math.PI).toBe(q.top());
        q.reduceKey(k, 2);
        u = <number>q.top();
        expect(u).toBe(2);
        cnt = 0;
        while ((v = q.pop()) !== null) {
            expect(u <= v).toBe(true);
            u = v;
            ++cnt;
        }
        expect(cnt).toBe(6);
    });

    test("dijkstra", () => {
        // 0  4-3
        //  \/ /
        //  1-2
        var n = 5;
        var links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]],
            getSource = function (l) { return l[0] }, getTarget = function (l) { return l[1] }, getLength = function (l) { return 1 }
        var calc = new Calculator(n, links, getSource, getTarget, getLength);
        var d = calc.DistancesFromNode(0);
        expect(d).toEqual([0, 1, 2, 3, 2]);
        var D = calc.DistanceMatrix();
        expect(D).toEqual([
            [0, 1, 2, 3, 2],
            [1, 0, 1, 2, 1],
            [2, 1, 0, 1, 2],
            [3, 2, 1, 0, 1],
            [2, 1, 2, 1, 0]
        ]);
    });
});