import * as d3 from 'd3';
import { Configuration, d3adaptor, Calculator, Descent, Layout } from '../src';

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

// We allow duplicate node names
const duplicate_nodes = {
      "nodes":[
	{"name":"a","group":1},
	{"name":"a","group":1},
	{"name":"b","group":1}
      ],
      "links":[
	{"source":0,"target":2,"value":1}
      ]
};

describe("dom tests", () => {

    function nodeDistance(u, v) {
        var dx = u.x - v.x, dy = u.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
  
    function approxEquals(actual, expected, threshold) {
        return Math.abs(actual - expected) <= threshold;
    }
    
    test("small power-graph", () => {
        var n = n7e23.nodes.length;
        expect(n == 7).toBe(true);
        var linkAccessor = {
            getSourceIndex: function (e) { return e.source },
            getTargetIndex: function (e) { return e.target },
            getType: function (e) { return 0 },
            makeLink: function (u, v) { return { source: u, target: v } }
        };
        var c = new Configuration(n, n7e23.links, linkAccessor);
        expect(c.modules.length == 7).toBe(true);
        var es;
        expect(c.R == (es = c.allEdges()).length || "c.R=" + c.R + ", actual edges in c=" + es.length).toBe(true);
        var m = c.merge(c.modules[0], c.modules[4]);
        expect(m.children.contains(0)).toBe(true);
        expect(m.children.contains(4)).toBe(true);
        expect(m.outgoing.contains(1)).toBe(true);
        expect(m.outgoing.contains(3)).toBe(true);
        expect(m.outgoing.contains(5)).toBe(true);
        expect(m.outgoing.contains(6)).toBe(true);
        expect(m.incoming.contains(2)).toBe(true);
        expect(m.incoming.contains(5)).toBe(true);
        expect(c.R == (es = c.allEdges()).length || "c.R=" + c.R + ", actual edges in c=" + es.length).toBe(true);
        m = c.merge(c.modules[2], c.modules[3]);
        expect(c.R == (es = c.allEdges()).length || "c.R=" + c.R + ", actual edges in c=" + es.length).toBe(true);

        c = new Configuration(n, n7e23.links, linkAccessor);
        var lastR = c.R;
        while (c.greedyMerge()) {
            expect(c.R < lastR).toBe(true);
            lastR = c.R;
        }
        var finalEdges = [];
        var powerEdges = c.allEdges();
        expect(powerEdges.length == 7).toBe(true);
        var groups = c.getGroupHierarchy(finalEdges);
        expect(groups.length == 4).toBe(true);
    });

    test("all-pairs shortest paths", () => {
        let d3cola = d3adaptor(d3);
  
        d3cola
            .nodes(<any>triangle.nodes)
            .links(triangle.links)
            .linkDistance(1);
        var n = d3cola.nodes().length;
        expect(n).toBe(4);
        var getSourceIndex = e => e.source;
        var getTargetIndex = e => e.target;
        var getLength = e => 1;
        var D = (new Calculator(n, d3cola.links(), getSourceIndex, getTargetIndex, getLength)).DistanceMatrix();
        expect(D).toEqual([
            [0, 1, 1, 2],
            [1, 0, 1, 2],
            [1, 1, 0, 1],
            [2, 2, 1, 0],
        ]);
        var x = [0, 0, 1, 1], y = [1, 0, 0, 1];
        var descent = new Descent([x, y], D);
        var s0 = descent.reduceStress();
        var s1 = descent.reduceStress();
        expect(s1 < s0).toBe(true);
        var s2 = descent.reduceStress();
        expect(s2 < s1).toBe(true);
        d3cola.start(0, 0, 10);
        var lengths = triangle.links.map(function (l) {
            var u = <any>l.source, v = <any>l.target,
                dx = u.x - v.x, dy = u.y - v.y;
            return Math.sqrt(dx * dx + dy * dy);
        }), avg = function (a) { return a.reduce(function (u, v) { return u + v }) / a.length },
            mean = avg(lengths),
            variance = avg(lengths.map(function (l) { var d = mean - l; return d * d; }));
        expect(variance < 0.1).toBe(true);
    });

    test("edge lengths", () => {
        var d3cola = d3adaptor(d3);
        var length = function (l) {
            return Layout.linkId(l) == "2-3" ? 2 : 1;
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
        expect(max < 0.1 || "max = " + max).toBe(true);
    });

    test("group", () => {
        var d3cola = d3adaptor(d3);
        var nodes = [];
        var u = { x: -5, y: 0, width: 10, height: 20 };
        var v = { x: 5, y: 0, width: 10, height: 20 };
        var g = { padding: 10, leaves: [0] };
  
        d3cola
            .avoidOverlaps(true)
            .handleDisconnected(false)
            .nodes([u, v])
            .groups(<any>[g]);
  
        // just do overlap removal:
        d3cola.start(0, 0, 10);
  
        expect(approxEquals((<any>g).bounds.width(), 30, 0.1)).toBe(true);
        expect(approxEquals((<any>g).bounds.height(), 40, 0.1)).toBe(true);
  
        expect(approxEquals(Math.abs(u.x - v.x), 20, 0.1) || "u.x: " + u.x + " v.x: " + v.x).toBe(true);
    });

    test("equality constraints", () => {
        var d3cola = d3adaptor(d3);
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
        expect(Math.abs(nodes[0].x - nodes[1].x) < 0.001).toBe(true);
        expect(Math.abs(nodes[0].y - nodes[2].y) < 0.001).toBe(true);
    });

    test("Graph with duplicate node name", function () {
        var d3cola = d3adaptor(d3);
        let nodes = <any>duplicate_nodes.nodes;
        d3cola
            .nodes(nodes)
            .links(duplicate_nodes.links)
            .start(30);

        expect(3).toBe(d3cola.nodes().length);
    });
});