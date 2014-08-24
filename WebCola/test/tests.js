/// <reference path="d3.v3.min.js"/>
/// <reference path="../src/d3adaptor.js"/>
/// <reference path="../src/shortestpaths.js"/>
/// <reference path="../src/descent.js"/>
/// <reference path="../src/cola.vpsc.js"/>
/// <reference path="../src/rectangle.js"/>
/// <reference path="../src/geom.js"/>
/// <reference path="../src/powergraph.js"/>

function nodeDistance(u, v) {
    var dx = u.x - v.x, dy = u.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function approxEquals(actual, expected, threshold) {
    return Math.abs(actual - expected) <= threshold;
}

asyncTest("small power-graph", function () {
    d3.json("../examples/graphdata/n7e23.json", function (error, graph) {
        var n = graph.nodes.length;
        ok(n == 7);
        var linkAccessor = {
            getSourceIndex: function (e) { return e.source },
            getTargetIndex: function (e) { return e.target },
            getType: function(e) { return 0 },
            makeLink: function (u, v) { return { source: u, target: v } }
        };
        var c = new cola.powergraph.Configuration(n, graph.links, linkAccessor);
        ok(c.modules.length == 7);
        var es;
        ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);
        var m = c.merge(c.modules[0], c.modules[4]);
        ok(m.children.contains(0));
        ok(m.children.contains(4));
        ok(m.outgoing.contains(1));
        ok(m.outgoing.contains(3));
        ok(m.outgoing.contains(5));
        ok(m.outgoing.contains(6));
        ok(m.incoming.contains(2));
        ok(m.incoming.contains(5));
        ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);
        m = c.merge(c.modules[2], c.modules[3]);
        ok(c.R == (es = c.allEdges()).length, "c.R=" + c.R + ", actual edges in c=" + es.length);

        c = new cola.powergraph.Configuration(n, graph.links, linkAccessor);
        var lastR = c.R;
        while (c.greedyMerge()) {
            ok(c.R < lastR);
            lastR = c.R;
        }
        var finalEdges = [];
        var powerEdges = c.allEdges();
        ok(powerEdges.length == 7);
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
            .links(graph.links)
            .linkDistance(1);
        var n = d3cola.nodes().length;
        equal(n, 4);
        var getSourceIndex = function (e) {
            return e.source;
        }
        var getTargetIndex = function (e) {
            return e.target;
        }
        var getLength = function (e) {
            return 1;
        }
        var D = (new cola.shortestpaths.Calculator(n, d3cola.links(), getSourceIndex, getTargetIndex, getLength)).DistanceMatrix();
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
        var length = function (l) {
            return d3cola.linkId(l) == "2-3" ? 2 : 1;
        }
        d3cola
            .linkDistance(length)
            .nodes(graph.nodes)
            .links(graph.links);
        d3cola.start(10);
        var errors = graph.links.map(function (e) {
            var l = nodeDistance(e.source, e.target);
            return Math.abs(l - length(e));
        }), max = Math.max.apply(this, errors);
        ok(max < 0.1);
        start();
    });
    ok(true);
});

test("group", function () {
    var d3cola = cola.d3adaptor();

    var length = function (l) {
        return d3cola.linkId(l) == "2-3" ? 2 : 1;
    }
    var nodes = [];
    var u = { x: -5, y: 0, width: 10, height: 10 };
    var v = { x: 5, y: 0, width: 10, height: 10 };
    var g = { padding: 10, leaves: [0] };

    d3cola
        .linkDistance(length)
        .avoidOverlaps(true)
        .nodes([u,v])
        .groups([g]);
    d3cola.start(10, 10, 10);

    ok(approxEquals(g.bounds.width(), 30, 0.1));
    ok(approxEquals(g.bounds.height(), 30, 0.1));

    ok(approxEquals(Math.abs(u.y - v.y), 20, 0.1));
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
    //console.log(q);
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

// next steps: 
//  o label node and group centre and boundary vertices
//  - non-traversable regions (obstacles) are determined by finding the highest common ancestors of the source and target nodes
//  - to route each edge the weights of the edges are adjusted such that those inside obstacles
//    have infinite weight while those inside the source and target node have zero weight
//  - augment dijkstra with a cost for bends
asyncTest('grid visibility', function() {
    var draw = true;
    d3.json("../examples/graphdata/tetrisbugmultiedgeslayout.json", function (error, graph) {
        var groupPadding = 5;
        function isLeaf(v) { return typeof v.children === 'undefined' };
        var leaves = graph.nodes.filter(isLeaf);
        leaves.forEach(function (v) {
            v.rect = new cola.vpsc.Rectangle(v.bounds.x, v.bounds.X, v.bounds.y, v.bounds.Y);
        });
        function isGroup(v) { return !isLeaf(v) };
        var groups = graph.nodes.filter(isGroup);
        function avg(a) { return a.reduce(function(x,y) { return x+y })/a.length }
        function getGridDim(axis) {
            var columns = [];
            var ls = leaves.slice(0,leaves.length);
            while(ls.length > 0) {
                var r = ls[0].rect;
                var col = ls.filter(function (v) {
                    return v.rect['overlap'+axis.toUpperCase()](r);
                });
                columns.push(col);
                col.forEach(function (v) {
                    ls.splice(ls.indexOf(v),1);
                });
                col[axis] = avg(col.map(function (v) { return v.rect['c'+axis]() }))
            }
            columns.sort(function (x,y) { return x[axis] - y[axis] })
            return columns;
        }
        var cols = getGridDim('x');
        var rows = getGridDim('y');

        // create parents for each node or group that is a member of another's children 
        groups.forEach(function (v) {
            v.children.forEach(function (c) { 
                graph.nodes[c].parent = v;
            });
        });

        // root claims the remaining orphans
        var root = {children:[]};
        graph.nodes.forEach(function (v) {
            if (typeof v.parent === 'undefined') {
                v.parent = root;
                root.children.push(v.id);
            }

            // each node will have grid vertices associated with it,
            // some inside the node and some on the boundary
            // leaf nodes will have exactly one internal node at the center
            // and four boundary nodes
            // groups will have potentially many of each
            v.verts = []
        });

        // get the depth of the given node in the group hierarchy
        function getDepth(v) {
            var depth = 0;
            while (v.parent !== root) {
                depth++;
                v = v.parent;
            }
            return depth;
        };

        // nodes ordered by their position in the group hierarchy
        var backToFront = graph.nodes.slice(0);
        backToFront.sort(function (x,y) { return getDepth(x) - getDepth(y) }); 

        // compute boundary rectangles for each group
        // has to be done from front to back, i.e. inside groups to outside groups
        // such that each can be made large enough to enclose its interior
        var frontToBackGroups = backToFront.slice(0).reverse().filter(isGroup);
        frontToBackGroups.forEach(function (v) {
            var r = cola.vpsc.Rectangle.empty();
            v.children.forEach(function (c) { 
                r = r.union(graph.nodes[c].rect);
            });
            v.rect = r.inflate(groupPadding);
        });

        // medial axes between node centres and also boundary lines for the grid
        function midPoints(a) {
            var gap = a[1] - a[0];
            var mids = [a[0]-gap/2];
            for(var i = 1; i < a.length; i++) {
                mids.push((a[i]+a[i-1])/2);
            }
            mids.push(a[a.length-1] + gap/2);
            return mids;
        }

        var colMids = midPoints(cols.map(function(r) {return r.x}));
        var rowMids = midPoints(rows.map(function(r) {return r.y}));

        // extend the lines a little beyond the first and last boundary lines
        var rowx = colMids[0]-10, rowX = colMids[colMids.length-1]+10;
        var coly = rowMids[0]-10, colY = rowMids[rowMids.length-1]+10;

        // horizontal lines
        var hlines = rows.map(function (r) {
            return {x1: rowx, x2: rowX, y1: r.y, y2: r.y};
        }).concat(rowMids.map(function (m) {
            return {x1: rowx, x2: rowX, y1: m, y2: m};
        }));

        // vertical lines
        var vlines = cols.map(function (c) {
            return {x1: c.x, x2: c.x, y1: coly, y2: colY};
        }).concat(colMids.map(function (m) {
            return {x1: m, x2: m, y1: coly, y2: colY};
        }));

        // the full set of lines
        var lines = hlines.concat(vlines);

        // we record the vertices associated with each line
        lines.forEach(function (l) { l.verts = [] });

        // the routing graph
        var verts = [];
        var edges = [];

        // create vertices at the crossings of horizontal and vertical grid-lines
        hlines.forEach(function (h) {
            vlines.forEach(function (v) {
                var p = {id: verts.length, x: v.x1, y: h.y1};
                h.verts.push(p);
                v.verts.push(p);
                verts.push(p);

                // assign vertices to the nodes immediately under them
                var i = backToFront.length;
                while (i-- > 0) {
                    var node = backToFront[i],
                        r = node.rect;
                    var dx = Math.abs(p.x - r.cx()),
                        dy = Math.abs(p.y - r.cy());
                    if (dx < r.width()/2 && dy < r.height()/2) {
                        p.node = node;
                        break;
                    }
                }
            });
        });

        lines.forEach(function (l) {
            // create vertices at the intersections of nodes and lines
            graph.nodes.forEach(function (v) {
                v.rect.lineIntersections(l.x1,l.y1,l.x2,l.y2).forEach(function (p) {
                    p.line = l;
                    p.node = v;
                    p.id = verts.length;
                    verts.push(p);
                    l.verts.push(p);
                });
            });

            // split lines into edges joining vertices
            var isHoriz = Math.abs(l.y1 - l.y2) < 0.1;
            function delta(a,b) { return isHoriz ? b.x - a.x : b.y - a.y };
            l.verts.sort(delta);
            for (var i = 1; i < l.verts.length; i++) {
                var u = l.verts[i-1], v = l.verts[i];
                edges.push({source: u.id, target: v.id, length: Math.abs(delta(u,v))});
            }
        });

        // populate the node verts lists so we can easily find 
        // the vertices associated with a given node
        verts.forEach(function (v) {
            if (typeof v.node !== 'undefined') v.node.verts.push(v);
        });

        // find path from v to root including both v and root
        function findLineage(v) {
            var lineage = [v];
            do {
                v = v.parent; 
                lineage.push(v);
            } while (v!==root);
            return lineage.reverse();
        }

        // find path connecting a and b through their lowest common ancestor
        function findAncestorPathBetween(a,b) {
            var aa = findLineage(a), ba = findLineage(b), i = 0;
            while (aa[i] === ba[i]) i++;
            // i-1 to include common ancestor only once (as first element)
            return {commonAncestor: aa[i-1], lineages: aa.slice(i).concat(ba.slice(i))};
        }

        // when finding a path between two nodes a and b, siblings of a and b on the
        // paths from a and b to their least common ancestor are obstacles
        function siblingObstacles(a,b) {
            var path = findAncestorPathBetween(a,b);
            var lineageLookup = {};
            path.lineages.forEach(function(v) {lineageLookup[v.id] = {} });
            var obstacles = path.commonAncestor.children.filter(function (v) {
                return !(v in lineageLookup);
            });

            path.lineages.filter(function(v) { return v.parent !== path.commonAncestor }).forEach(function (v) {
                obstacles = obstacles.concat(v.parent.children.filter(function (c) { return c !== v.id }));
            });
            return obstacles.map(function (v) { return graph.nodes[v] });
        }
        var source = graph.nodes[1], target = graph.nodes[5];
        var obstacles = siblingObstacles(source,target);
        function check(expected) {
            ok(obstacles.length === expected);
            ok(obstacles.map(function (v) { return v.id }).indexOf(source.id) < 0);
            ok(obstacles.map(function (v) { return v.id }).indexOf(target.id) < 0);
        }
        check(8);
        // source = graph.nodes[0], target = graph.nodes[7];
        // obstacles = siblingObstacles(source,target);
        // check(6);

        // source = graph.nodes[4], target = graph.nodes[5];
        // obstacles = siblingObstacles(source,target);
        // check(8)

        var obstacleLookup = {};
        obstacles.forEach(function (o) {
            obstacleLookup[o.id] = {}
        });
        var passableEdges = edges.filter(function (e) {
            var u = verts[e.source],
                v = verts[e.target];
            return !(u.node && u.node.id in obstacleLookup 
                     || v.node && v.node.id in obstacleLookup);
        });

        var getSource = function (e) { return e.source }, 
            getTarget = function(e) { return e.target}, 
            getLength = function(e) { return e.length },
            shortestPath = (new cola.shortestpaths.Calculator(verts.length, passableEdges, getSource, getTarget, getLength))
                .PathFromNodeToNode(source.verts[0].id, target.verts[0].id);

        if (draw) {
            var svg = d3.select("body").append("svg").attr("width", 800).attr("height", 400).append('g').attr('transform', 'scale(0.5,0.8)')
            var color = d3.scale.category20();
            svg.selectAll('.gridLines')
                .data(lines)
                .enter()
                .append('line')
                .attr('x1',function(d) {return d.x1})
                .attr('x2',function(d) {return d.x2})
                .attr('y1',function(d) {return d.y1})
                .attr('y2',function(d) {return d.y2})
                .style('stroke', 'orange')
                .style('stroke-width','3')
            var nodegroups = svg.selectAll('.gridNodes')
                .data(backToFront)
                .enter()
                .append('g')
                .attr('transform',function (d) { return 'translate('+d.rect.x+','+d.rect.y+')' });
            nodegroups
                .append('rect')
                .attr('width', function (d) { return d.rect.width() })
                .attr('height', function (d) { return d.rect.height() })
                .style('fill', function (d) { return color(d.id) })
                //.style('fill', 'beige')
                .style('stroke-width','2');
            nodegroups.append('text')
                .attr('x', 10)
                .attr('y',function(d) { return d.rect.height()/2 })
                .text(function (d) { return d.id +":" + d.name })
            svg.selectAll('.edges')
                .data(passableEdges)
                .enter()
                .append('line')
                .attr('x1',function(d) {return verts[d.source].x})
                .attr('y1',function(d) {return verts[d.source].y})
                .attr('x2',function(d) {return verts[d.target].x})
                .attr('y2',function(d) {return verts[d.target].y})
                .style('stroke', 'black')
                .style('stroke-width','2')
            svg.selectAll('.verts')
                .data(verts)
                .enter()
                .append("circle")
                .attr("cx", function(d) { return d.x })
                .attr("cy", function(d) { return d.y })
                .attr("r", 2)
                .style('stroke', 'black')
                .style('stroke-width', '0.5')
                .style('fill', function (d) { 
                    return typeof d.node === 'undefined' ? 'black' : color(d.node.id) 
                })
            svg.selectAll('.obstacles')
                .data(obstacles)
                .enter()
                .append('rect')
                .attr('x', function(d) { return d.rect.x })
                .attr('y', function(d) { return d.rect.y })
                .attr('width',function(d){return d.rect.width()})
                .attr('height',function(d){return d.rect.height()})
                .style('stroke', 'black')
                .style('stroke-width', '3')
                .style('fill', 'none');
            svg.append('line')
                .attr('x1', source.rect.cx())
                .attr('y1', source.rect.cy())
                .attr('x2', target.rect.cx())
                .attr('y2', target.rect.cy())
                .style('stroke', 'black')
                .style('stroke-width',3);

            for (var i = 0; i < shortestPath.length; i++) {
                var u = i === 0 ? target.verts[0] : verts[shortestPath[i - 1]];
                var v = verts[shortestPath[i]];
                svg.append('line')
                    .attr('x1', u.x)
                    .attr('y1', u.y)
                    .attr('x2', v.x)
                    .attr('y2', v.y)
                    .style('stroke', 'red')
                    .style('stroke-width',3);
            }
        }
        start();
    });
    ok(true);
});

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
        var getSource = function (e) { return e.source.id }, getTarget = function(e) { return e.target.id}, getLength = function(e) { return e.length }
            shortestPath = (new cola.shortestpaths.Calculator(g.V.length, g.E, getSource, getTarget, getLength)).PathFromNodeToNode(start.id, end.id);
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
    var q = new PriorityQueue(function (a, b) { return a <= b; });
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

/// <reference path="shortestpaths.js"/>
test("dijkstra", function () {
    // 0  4-3
    //  \/ /
    //  1-2
    var n = 5;
    var links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]],
        getSource = function (l) { return l[0] }, getTarget = function (l) { return l[1] }, getLength = function(l) { return 1 }
    var calc = new cola.shortestpaths.Calculator(n, links, getSource, getTarget, getLength);
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

test("packing", function () {
    var draw = false;
    var nodes = []
    var drawNodes = function () {
        if (draw) {
            var svg  = d3.select("body").append("svg").attr("width", 200).attr("height", 200);
            nodes.forEach(function (v) {
                svg.append("rect").attr("x", 100 + v.x - v.width / 2).attr("y", 100 + v.y - v.height / 2).attr("width", v.width).attr("height", v.height).style("fill", "#6600FF").style("fill-opacity", 0.5);
            });
        }
    }
    for (var i = 0; i < 9; i++) { nodes.push({width: 10, height: 10}) }
    cola.d3adaptor().nodes(nodes).start();
    drawNodes();
    var check = function (aspectRatioThreshold) {
        var dim = nodes.reduce(function (p, v) {
            return {
                x: Math.min(v.x - v.width / 2, p.x),
                y: Math.min(v.y - v.height / 2, p.y),
                X: Math.max(v.x + v.width / 2, p.X),
                Y: Math.max(v.y + v.height / 2, p.Y)
            };
        }, { x: Number.POSITIVE_INFINITY, X: Number.NEGATIVE_INFINITY, y: Number.POSITIVE_INFINITY, Y: Number.NEGATIVE_INFINITY });
        var width = dim.X - dim.x, height = dim.Y - dim.y;
        ok(Math.abs(width / height - 1) < aspectRatioThreshold);
    }
    check(0.001);

    // regression test, used to cause infinite loop
    nodes = [{ width: 24, height: 35 }, { width: 24, height: 35 }, { width: 32, height: 35 }];
    cola.d3adaptor().nodes(nodes).start();
    drawNodes();
    check(0.3);

    // for some reason the first rectangle is offset by the following - no assertion for this yet.
    var rand = new cola.PseudoRandom(51);
    for (var i = 0; i < 19; i++) { nodes.push({ width: rand.getNextBetween(5, 30), height: rand.getNextBetween(5, 30) }) }
    cola.d3adaptor().nodes(nodes).avoidOverlaps(false).start();
    drawNodes();
    check(0.1);
});
