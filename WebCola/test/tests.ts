import * as d3 from 'd3';
import * as QUnit from 'qunit';
import * as cola from '../index';

const n7e23 = {
    "nodes":[
      {"name":"0","width":50,"height":50},
      {"name":"1","width":50,"height":50},
      {"name":"2","width":50,"height":50},
      {"name":"3","width":50,"height":50},
      {"name":"4","width":50,"height":50},
      {"name":"5","width":50,"height":50},
      {"name":"6","width":50,"height":50}
    ],
    "links":[
      {"source":0,"target":1},
      {"source":0,"target":3},
      {"source":0,"target":4},
      {"source":0,"target":5},
      {"source":0,"target":6},
      {"source":1,"target":6},
      {"source":2,"target":0},
      {"source":2,"target":1},
      {"source":2,"target":3},
      {"source":2,"target":4},
      {"source":2,"target":5},
      {"source":2,"target":6},
      {"source":3,"target":6},
      {"source":4,"target":1},
      {"source":4,"target":2},
      {"source":4,"target":3},
      {"source":4,"target":5},
      {"source":4,"target":6},
      {"source":5,"target":0},
      {"source":5,"target":2},
      {"source":5,"target":4},
      {"source":6,"target":1},
      {"source":6,"target":3}
    ]
}

const triangle = {
    "nodes":[
      {"name":"a","group":1},
      {"name":"b","group":1},
      {"name":"c","group":1},
      {"name":"d","group":1}
    ],
    "links":[
      {"source":0,"target":1,"value":1},
      {"source":1,"target":2,"value":1},
      {"source":2,"target":0,"value":1},
      {"source":2,"target":3,"value":1}
    ]
};

window.onload = function () {
    QUnit.module("dom tests");

    function nodeDistance(u, v) {
        var dx = u.x - v.x, dy = u.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
  
    function approxEquals(actual, expected, threshold) {
        return Math.abs(actual - expected) <= threshold;
    }
    
    QUnit.test("small power-graph", function (assert) {
        var done = assert.async();
        d3.json("n7e23.json", function (graph:any) {
            var n = graph[0].nodes.length;
            assert.ok(n == 7);
            var linkAccessor = {
                getSourceIndex: function (e) { return e.source },
                getTargetIndex: function (e) { return e.target },
                getType: function(e) { return 0 },
                makeLink: function (u, v) { return { source: u, target: v } }
            };
            var c = new cola.Configuration(n, graph.links, linkAccessor);
            assert.ok(c.modules.length == 7);
            var es;
            assert.ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);
            var m = c.merge(c.modules[0], c.modules[4]);
            assert.ok(m.children.contains(0));
            assert.ok(m.children.contains(4));
            assert.ok(m.outgoing.contains(1));
            assert.ok(m.outgoing.contains(3));
            assert.ok(m.outgoing.contains(5));
            assert.ok(m.outgoing.contains(6));
            assert.ok(m.incoming.contains(2));
            assert.ok(m.incoming.contains(5));
            assert.ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);
            m = c.merge(c.modules[2], c.modules[3]);
            assert.ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);
  
            c = new cola.Configuration(n, graph.links, linkAccessor);
            var lastR = c.R;
            while (c.greedyMerge()) {
                assert.ok(c.R < lastR);
                lastR = c.R;
            }
            var finalEdges = [];
            var powerEdges = c.allEdges();
            assert.ok(powerEdges.length == 7);
            var groups = c.getGroupHierarchy(finalEdges);
            assert.ok(groups.length == 4);
            done();
        });
    });

    QUnit.test("small power-graph", function (assert) {
        var n = n7e23.nodes.length;
        assert.ok(n == 7);
        var linkAccessor = {
            getSourceIndex: function (e) { return e.source },
            getTargetIndex: function (e) { return e.target },
            getType: function(e) { return 0 },
            makeLink: function (u, v) { return { source: u, target: v } }
        };
        var c = new cola.Configuration(n, n7e23.links, linkAccessor);
        assert.ok(c.modules.length == 7);
        var es;
        assert.ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);
        var m = c.merge(c.modules[0], c.modules[4]);
        assert.ok(m.children.contains(0));
        assert.ok(m.children.contains(4));
        assert.ok(m.outgoing.contains(1));
        assert.ok(m.outgoing.contains(3));
        assert.ok(m.outgoing.contains(5));
        assert.ok(m.outgoing.contains(6));
        assert.ok(m.incoming.contains(2));
        assert.ok(m.incoming.contains(5));
        assert.ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);
        m = c.merge(c.modules[2], c.modules[3]);
        assert.ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);

        c = new cola.Configuration(n, n7e23.links, linkAccessor);
        var lastR = c.R;
        while (c.greedyMerge()) {
            assert.ok(c.R < lastR);
            lastR = c.R;
        }
        var finalEdges = [];
        var powerEdges = c.allEdges();
        assert.ok(powerEdges.length == 7);
        var groups = c.getGroupHierarchy(finalEdges);
        assert.ok(groups.length == 4);
    });

    QUnit.test("all-pairs shortest paths", function (assert) {
        let d3cola = cola.d3adaptor(d3);
  
        d3cola
            .nodes(<any>triangle.nodes)
            .links(triangle.links)
            .linkDistance(1);
        var n = d3cola.nodes().length;
        assert.equal(n, 4);
        var getSourceIndex = e=>e.source;
        var getTargetIndex = e=>e.target;
        var getLength = e=>1;
        var D = (new cola.Calculator(n, d3cola.links(), getSourceIndex, getTargetIndex, getLength)).DistanceMatrix();
        assert.deepEqual(D, [
            [0, 1, 1, 2],
            [1, 0, 1, 2],
            [1, 1, 0, 1],
            [2, 2, 1, 0],
        ]);
        var x = [0, 0, 1, 1], y = [1, 0, 0, 1];
        var descent = new cola.Descent([x, y], D);
        var s0 = descent.reduceStress();
        var s1 = descent.reduceStress();
        assert.ok(s1 < s0);
        var s2 = descent.reduceStress();
        assert.ok(s2 < s1);
        d3cola.start(0,0,10);
        var lengths = triangle.links.map(function (l) {
            var u = <any>l.source, v = <any>l.target,
                dx = u.x - v.x, dy = u.y - v.y;
            return Math.sqrt(dx*dx + dy*dy);
        }), avg = function (a) { return a.reduce(function (u, v) { return u + v }) / a.length },
            mean = avg(lengths),
            variance = avg(lengths.map(function (l) { var d = mean - l; return d * d; }));
            assert.ok(variance < 0.1);
    });

    QUnit.test("edge lengths", function (assert) {
        var d3cola = cola.d3adaptor(d3);
        var length = function (l) {
            return cola.Layout.linkId(l) == "2-3" ? 2 : 1;
        }
        d3cola
            .linkDistance(length)
            .nodes(<any>triangle.nodes)
            .links(triangle.links);
        d3cola.start(100);
        var errors = triangle.links.map(function (e) {
            var l = nodeDistance(e.source, e.target);
            return Math.abs(l - length(e));
        }), max = Math.max.apply(this, errors);
        assert.ok(max < 0.1, "max = "+max);
    });

    QUnit.test("group", function (assert) {
        var d3cola = cola.d3adaptor(d3);
        var nodes = [];
        var u = { x: -5, y: 0, width: 10, height: 20 };
        var v = { x: 5, y: 0, width: 10, height: 20 };
        var g = { padding: 10, leaves: [0] };
  
        d3cola
            .avoidOverlaps(true)
            .handleDisconnected(false)
            .nodes([u,v])
            .groups(<any>[g]);
  
        // just do overlap removal:
        d3cola.start(0, 0, 10);
  
        assert.ok(approxEquals((<any>g).bounds.width(), 30, 0.1));
        assert.ok(approxEquals((<any>g).bounds.height(), 40, 0.1));
  
        assert.ok(approxEquals(Math.abs(u.x - v.x), 20, 0.1), "u.x: "+u.x+" v.x: "+v.x);
    });

    QUnit.test("equality constraints", function (assert) {
        var d3cola = cola.d3adaptor(d3);
        let nodes = <any>triangle.nodes;
        d3cola
            .nodes(nodes)
            .links(triangle.links)
            .constraints([{
                type: "separation", axis: "x",
                left: 0, right: 1, gap: 0, equality: true
            }, {
                type: "separation", axis: "y",
                left: 0, right: 2, gap: 0, equality: true
            }]);
        d3cola.start(20, 20, 20);
        assert.ok(Math.abs(nodes[0].x - nodes[1].x) < 0.001);
        assert.ok(Math.abs(nodes[0].y - nodes[2].y) < 0.001);
    });

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
            P.push({ x: P[0].x, y: P[0].y });
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
  
    function drawLine(svg, l) {
        var stroke = "green";
        if (arguments.length > 2) {
            stroke = arguments[2];
        }
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
  
    QUnit.test('metro crossing min', function (assert) {
        function countRouteIntersections(routes) {
            var ints = [];
            for (var i = 0; i < routes.length - 1; i++) {
                for (var j = i + 1; j < routes.length ; j++) {
                    var r1 = routes[i], r2 = routes[j];
                    r1.forEach(function (s1) {
                        r2.forEach(function (s2) {
                            var int = cola.Rectangle.lineIntersection(s1[0].x, s1[0].y, s1[1].x, s1[1].y, s2[0].x, s2[0].y, s2[1].x, s2[1].y);
                            if (int) ints.push(int);
                        })
                    })
                }
            }
            return ints.length;
        }
        var verts, edges, order, routes;
        function makeInstance() {
            verts.forEach(function (v, i) {
                v.id = i;
                v.edges = {};
            });
            edges.forEach(function (e, i) {
                e.id = i;
            });
        }
        function twoParallelSegments() {
            verts = [
                { x: 0, y: 10 },
                { x: 10, y: 10 }
            ];
            edges = [
                [verts[0], verts[1]],
                [verts[0], verts[1]]
            ];
            makeInstance();
        }
        function threeByThreeSegments() {
            verts = [
                { x: 0, y: 10 },
                { x: 10, y: 10 },
                { x: 10, y: 20 },
                { x: 10, y: 30 },
                { x: 20, y: 20 },
                { x: 10, y: 0 },
                { x: 0, y: 20 }
            ];
            edges = [
                [verts[0], verts[1], verts[2], verts[3]],
                [verts[0], verts[1], verts[2], verts[4]],
                [verts[5], verts[1], verts[2], verts[6]]
            ];
            makeInstance();
        }
        function regression1() {
            verts = [
                {x:430.79999999999995, y:202.5},
                {x:464.4, y:202.5},
                {x:464.4, y:261.6666666666667},
                {x:464.4, y:320.83333333333337},
                {x:474, y:320.83333333333337},
                {x:486, y:320.83333333333337},
                {x:498.0000000000001, y:202.5},
                {x:474, y:202.5},
            ];
            verts.forEach(function(v) {
                v.x -= 400;
                v.y -= 160;
                v.x /= 4;
                v.y /= 8;
            });
            edges = [[
                verts[0],
                verts[1],
                verts[2],
                verts[3],
                verts[4],
                verts[5]
                ], [
                verts[6],
                verts[7],
                verts[1],
                verts[0]
                ]];
            makeInstance();
        }
        function nudge() {
            order = cola.GridRouter.orderEdges(edges);
            routes = edges.map(function (e) { return cola.GridRouter.makeSegments(e); });
            cola.GridRouter.nudgeSegments(routes, 'x', 'y', order, 2);
            cola.GridRouter.nudgeSegments(routes, 'y', 'x', order, 2);
            cola.GridRouter.unreverseEdges(routes, edges);
            draw();
        }
  
        var draw = function () {
            var svg = d3.select("body").append("svg").attr("width", 100).attr("height", 100).append('g').attr('transform', 'scale(4,4)');
  
            svg.append('svg:defs').append('svg:marker')
                .attr('id', 'end-arrow')
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 8)
                .attr('markerWidth', 3)
                .attr('markerHeight', 3)
                .attr('orient', 'auto')
              .append('svg:path')
                .attr('d', 'M0,-5L10,0L0,5L2,0')
                .attr('stroke-width', '0px')
                .attr('fill', '#000');
            var color = d3.schemeCategory10;
            // draw segments
            var getPoints = function (segs) {
                return [segs[0][0]].concat(segs.map(function (s) { return s[1] }));
            }
            var lineFunction = d3.line()
                .curve(d3.curveLinear)
                .x(function (d:any) { return d.x; })
                .y(function (d:any) { return d.y; });
            var edgepaths = svg.selectAll(".edge").data(routes).enter()
                .append('path').attr('class', 'edge').attr('opacity', 0.5)
                .attr('d', function (d) { return lineFunction(getPoints(d)) })
                .attr('stroke', function (d, i) { return color[i] })
                .attr('fill', 'none')
                .style('marker-end', 'url(#end-arrow)');
            svg.selectAll('.node').data(verts).enter()
                .append('ellipse').attr('rx', 1).attr('ry', 1).attr('opacity', 0.5)
                .attr('cx', function (d:any) { return d.x }).attr('cy', function (d:any) { return d.y })
            // draw from edge paths
            //var edgepaths = svg.selectAll(".edge").data(edges).enter()
            //    .append('path').attr('class', 'edge').attr('opacity', 0.5)
            //    .attr('d', function (d) { return lineFunction(d) })
            //    .attr('stroke', function (d) { return color(d.id) })
            //    .attr('fill', 'none')
        }
        // trivial case
        twoParallelSegments();
        nudge();
        // two segments, one reversed
        edges[1].reverse();
        nudge();
  
        threeByThreeSegments();
        var lcs = new cola.LongestCommonSubsequence('ABAB'.split(''), 'DABA'.split(''));
        assert.deepEqual(lcs.getSequence(), 'ABA'.split(''));
        lcs = new cola.LongestCommonSubsequence(edges[0], edges[1]);
        assert.equal(lcs.length, 3);
        assert.deepEqual(lcs.getSequence().map(function (v:any) { return v.id }), [0, 1, 2]);
        var e0reversed = edges[0].slice(0).reverse();
        lcs = new cola.LongestCommonSubsequence(e0reversed, edges[1]);
        assert.deepEqual(lcs.getSequence().map(function (v:any) { return v.id }), [2, 1, 0]);
        assert.ok(lcs.reversed);
  
        nudge();
        assert.equal(routes[0].length, 2);
        assert.equal(routes[1].length, 3);
        assert.equal(routes[2].length, 2);
  
        assert.equal(countRouteIntersections(routes), 2);
  
        // flip it in y and try again
        threeByThreeSegments();
        verts.forEach(function (v) { v.y = 30 - v.y });
        nudge();
        assert.equal(countRouteIntersections(routes), 2);
  
        // reverse the first edge path and see what happens
        threeByThreeSegments();
        edges[0].reverse();
        nudge();
        assert.equal(countRouteIntersections(routes), 2);
  
        // reverse the second edge path
        threeByThreeSegments();
        edges[1].reverse();
        nudge();
        assert.equal(countRouteIntersections(routes), 2);
  
        // reverse the first 2 edge paths
        threeByThreeSegments();
        edges[0].reverse();
        edges[1].reverse();
        nudge();
        assert.equal(countRouteIntersections(routes), 2);
  
        regression1();
        nudge();
        assert.equal(countRouteIntersections(routes), 0);
    });
};