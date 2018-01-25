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
};