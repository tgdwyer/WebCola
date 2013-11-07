/// <reference path="d3.v3.min.js"/>
/// <reference path="cola.js"/>
/// <reference path="shortestpaths.js"/>
/// <reference path="descent.js"/>

asyncTest("all-pairs shortest paths", function () {
    var d3cola = cola.d3adaptor();

    d3.json("triangle.js", function (error, graph) {
        d3cola
            .nodes(graph.nodes)
            .links(graph.links);
        var n = d3cola.nodes().length;
        equal(n, 4);
        var D = ShortestPaths.johnsons(n, d3cola.links());
        deepEqual(D, [
            [0, 1, 1, 2],
            [1, 0, 1, 2],
            [1, 1, 0, 1],
            [2, 2, 1, 0],
        ]);
        var x = [0, 0, 1, 1], y = [1, 0, 0, 1];
        var cola = new Descent(x, y, D);
        var s0 = cola.reduceStress();
        var s1 = cola.reduceStress();
        ok(s1 < s0);
        var s2 = cola.reduceStress();
        ok(s2 < s1);
        start();
    });
    ok(true);
});

test("foreach test", function () {
    var now = window.performance ? function () { return window.performance.now(); } : function () { };
    var a = new Array(1000000);
    var expect = 0;
    for (var i = 0; i < a.length; ++i) {
        expect += a[i] = i;
    }
    var startTime = now();
    var sum = 0;
    for (var i = 0, n = a.length; i < n; ++i) {
        sum += i;
    }
    var t1 = now() - startTime;
    startTime = now();
    sum = 0;
    for (var i in a) {
        sum += i;
    }
    var t2 = now() - startTime;
    console.log("t1 = " + t1 + " t2 = " + t2);
    ok(sum == expect);
    
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
    var d = ShortestPaths.dijkstra(n, links, 0);
    deepEqual(d, [0, 1, 2, 3, 2]);
    var D = ShortestPaths.johnsons(n, links);
    deepEqual(D, [
        [0, 1, 2, 3, 2],
        [1, 0, 1, 2, 1],
        [2, 1, 0, 1, 2],
        [3, 2, 1, 0, 1],
        [2, 1, 2, 1, 0]
    ]);
});

/// <reference path="vpsc.js"/>
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
                v = new vpsc.Variable(u);
            } else {
                v = new vpsc.Variable(u.desiredPosition, u.weight, u.scale);
            }
            v.id = i;
            return v;
        });
        var cs = t.constraints.map(function (c) {
            return new vpsc.Constraint(vs[c.left], vs[c.right], c.gap);
        });
        var solver = new vpsc.Solver(vs, cs);
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
        new vpsc.Rectangle(0, 2, 0, 1),
        new vpsc.Rectangle(1, 3, 0, 1)
    ];
    equal(rs[0].overlapX(rs[1]), 1);
    equal(rs[0].overlapY(rs[1]), 1);
    var vs = rs.map(function (r) {
        return new vpsc.Variable(r.cx());
    });
    var cs = vpsc.generateXConstraints(rs, vs);
    equal(cs.length, 1);
    var solver = new vpsc.Solver(vs, cs);
    solver.solve();
    vs.forEach(function(v, i) {
        rs[i].setXCentre(v.position());
    });
    equal(rs[0].overlapX(rs[1]), 0);
    equal(rs[0].overlapY(rs[1]), 1);

    vs = rs.map(function (r) {
        return new vpsc.Variable(r.cy());
    });
    cs = vpsc.generateYConstraints(rs, vs);
    equal(cs.length, 0);
});

test("vpsc.removeOverlaps", function () {
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
        new vpsc.Rectangle(0, 4, 0, 4),
        new vpsc.Rectangle(3, 5, 1, 2),
        new vpsc.Rectangle(1, 3, 3, 5)
    ];
    equal(overlaps(rs), 2);
    vpsc.removeOverlaps(rs);
    equal(overlaps(rs), 0);
    equal(rs[1].y, 1);
    equal(rs[1].Y, 2);

    rs = [
        new vpsc.Rectangle(148.314,303.923,94.4755,161.84969999999998),
        new vpsc.Rectangle(251.725,326.6396,20.0193,69.68379999999999),
        new vpsc.Rectangle(201.235,263.6349,117.221,236.923),
        new vpsc.Rectangle(127.445,193.7047,46.5891,186.5991),
        new vpsc.Rectangle(194.259,285.7201,204.182,259.13239999999996)
    ];
    vpsc.removeOverlaps(rs);
    equal(overlaps(rs), 0);
});

