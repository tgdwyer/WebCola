import * as d3 from 'd3';
import * as QUnit from 'qunit';
import * as cola from '../index';

QUnit.module('Grid Routing')

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