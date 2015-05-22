///<reference path="qunit.d.ts"/>
///<reference path="../src/layout.ts"/>
QUnit.module("Headless API");

test("Basic headless layout",() => {
    // layout a triangular graph
    // should have no trouble finding an arrangement with all lengths close to the ideal length
    var layout = new cola.Layout()
        .links([
            { source: 0, target: 1 },
            { source: 1, target: 2 },
            { source: 2, target: 0 }])
        .start(10);
    // that's it!

    var vs = layout.nodes();
    equal(vs.length, 3, 'node array created');
    ok(layout.alpha() <= layout.convergenceThreshold(), 'converged to alpha='+layout.alpha());
    var checkLengths = idealLength =>
        layout.links().forEach(function(e: cola.Link<cola.Node>) {
            var dx = e.source.x - e.target.x,
                dy = e.source.y - e.target.y;
            var length = Math.sqrt(dx * dx + dy * dy);
            ok(Math.abs(length - idealLength) < 0.01, 'correct link length: '+length);
        });
    checkLengths(layout.linkDistance());

    // rerun layout with a new ideal link length
    layout.linkDistance(10).start(10);
    checkLengths(10);
});

test("Layout events",() => {
    // layout a little star graph with listeners counting the different events
    var starts = 0, ticks = 0, ends = 0;

    var layout = new cola.Layout()
        .links([
        { source: 0, target: 1 },
        { source: 1, target: 2 },
        { source: 1, target: 3 }])
        .on(cola.EventType.start, e => starts++)
        .on(cola.EventType.tick, e => ticks++)
        .on(cola.EventType.end, e => ends++)
        .start();

    ok(layout.alpha() <= layout.convergenceThreshold(), 'converged to alpha=' + layout.alpha());
    equal(starts, 1, 'started once');
    ok(ticks >= 1 && ticks < 50, `ticked ${ticks} times`);
    equal(ends, 1, 'ended once');
});

QUnit.module("3D Layout");

test("single link", () => {
    // single link with non-zero coords only in z-axis.
    // should relax to ideal length, nodes moving only in z-axis
    const nodes = [new cola.Node3D(0, 0, -1), new cola.Node3D(0, 0, 1)];
    const links = [new cola.Link3D(0, 1)];
    const desiredLength = 10;
    let layout = new cola.Layout3D(nodes, links, desiredLength).start();
    let linkLength = layout.linkLength(links[0]);
    nodes.forEach(({x, y}) => ok(Math.abs(x) < 1e-5 && Math.abs(y) < 1e-5));
    ok(Math.abs(linkLength - desiredLength) < 1e-4, "length = " + linkLength);
});

test("Pyramid", () => {
    // k4 should relax to a 3D pyramid with all edges the same length
    const nodes = Array.apply(null, { length: 4 }).map(() => new cola.Node3D);
    const links = [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]]
        .map(([u, v]) => new cola.Link3D(u, v));
    const layout = new cola.Layout3D(nodes, links, 10).start();
    const lengths = links.map(l=> layout.linkLength(l));
    lengths.forEach(l=> ok(Math.abs(l - lengths[0]) < 1e-4, "length = " + l));
});

test("Fixed nodes", () => {
    const N = 5;
    const nodes = Array.apply(null, { length: N }).map(() => new cola.Node3D);
    const links = [[0, 1], [1, 2], [2, 3], [3, 4]]
        .map(([u, v]) => new cola.Link3D(u, v));

    // nodes 0 and 4 will be locked at (-5,0,0) and (5,0,0) respectively
    nodes[0].fixed = nodes[4].fixed = true;
    nodes[0].x = -5;
    nodes[4].x = 5;

    // with ideal edge length at 10, other nodes will arc around in a kind of horsh-shoe shape
    const layout = new cola.Layout3D(nodes, links, 10).start();

    let closeEnough = (a, b) => Math.abs(a - b) < 1;

    for (var i = 0; i < N; i++) if (nodes[i].fixed) 
        cola.Layout3D.dims.forEach((d, j) =>
            ok(closeEnough(layout.result[j][i], nodes[i][d]), `nodes[${i}] locked in ${d}-axis`));

    const lengths = links.map(l=> layout.linkLength(l));
    let meanLength = lengths.reduce((s, l) => s + l, 0) / lengths.length;
    lengths.forEach(l=> ok(closeEnough(l, meanLength), "edge length = " + l));
});