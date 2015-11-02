///<reference path="qunit.d.ts"/>
///<reference path="../src/layout.ts"/>
///<reference path="../src/layout3d.ts"/>

QUnit.module("Headless API");
test('strongly connected components', () => {
    var la = <cola.LinkAccessor<number[]>> {
        getSourceIndex: ([source, target]) => source,
        getTargetIndex: ([source, target]) => target
    };
    var links = [[0, 1]];
    var components = cola.stronglyConnectedComponents(2, links, la);
    equal(components.length, 2);

    links = [[0, 1], [1, 2], [2, 0]];
    components = cola.stronglyConnectedComponents(3, links, la);
    equal(components.length, 1);

    links = [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3]];
    components = cola.stronglyConnectedComponents(6, links, la);
    equal(components.length, 2);

    links = [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 2]];
    components = cola.stronglyConnectedComponents(5, links, la);
    equal(components.length, 1);
});

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

    // test per-link desiredLength:
    const smallerLength = 5;
    links[0].length = smallerLength;
    layout = new cola.Layout3D(nodes, links);
    layout.useJaccardLinkLengths = false;
    layout.start();
    linkLength = layout.linkLength(links[0]);
    ok(Math.abs(linkLength - smallerLength) < 1e-4, "length = " + linkLength);
});

function graph(links: number[][]): {
    nodes: cola.Node3D[];
    links: cola.Link3D[];
} {
    const N = links.reduce((n, [u, v]) => Math.max(n, u, v), -1) + 1, nodes = new Array(N);
    for (let i = N; i--;) nodes[i] = new cola.Node3D;
    return { nodes: nodes, links: links.map(([u, v]) => new cola.Link3D(u, v)) };
}

test("Pyramid", () => {
    // k4 should relax to a 3D pyramid with all edges the same length
    const { nodes, links } = graph([[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]]);
    let layout = new cola.Layout3D(nodes, links, 10).start(0);

    let d = layout.descent;
    let x = layout.result;
    let s = d.computeStress();
    let takeDescentStep = alpha => {
        for (var i = 0; i < 3; ++i) {
            d.takeDescentStep(d.x[i], d.g[i], alpha);
        }
    }
    let reduceStress = () => {
        d.computeDerivatives(d.x);
        var alpha = 2 * d.computeStepSize(d.g);
        let f = 5;
        takeDescentStep(f * alpha);
        let sOver = d.computeStress();
        takeDescentStep(-f * alpha);
        f = 0.8;
        takeDescentStep(f * alpha);
        let sUnder = d.computeStress();
        takeDescentStep(-f * alpha);
        takeDescentStep(alpha);
        let s = d.computeStress();
        ok(sOver >= s, `  overshoot'=${sOver}, s=${s}`);
        ok(sUnder >= s, `  undershoot'=${sUnder}, s=${s}`);
        return [s,alpha];
    }

    for (let i = 0; i < 10; i++) {
        let [s2, alpha] = reduceStress();
        ok(s2 <= s, `s'=${s2}, s=${s}, alpha=${alpha}`);
        s = s2; 
    }

    layout = new cola.Layout3D(nodes, links, 10).start();
    const lengths = links.map(l=> layout.linkLength(l));
    lengths.forEach(l=> ok(Math.abs(l - lengths[0]) < 1e-4, "length = " + l));
});

test("Fixed nodes", () => {
    const { nodes, links } = graph([[0, 1], [1, 2], [2, 3], [3, 4]]);
    let lock = (i, x) => {
        nodes[i].fixed = true;
        nodes[i].x = x;
    } 
    
    let closeEnough = (a, b, t) => Math.abs(a - b) < t;
    const layout = new cola.Layout3D(nodes, links, 10);

    let check = () => {
        // locked nodes should be at their initial position
        for (var i = 0; i < nodes.length; i++) if (nodes[i].fixed)
            cola.Layout3D.dims.forEach((d, j) =>
                ok(closeEnough(layout.result[j][i], nodes[i][d], 1), `nodes[${i}] lock in ${d}-axis at ${nodes[i][d]}, actual=${layout.result[j][i]}`));

        const lengths = links.map(l=> layout.linkLength(l));
        let meanLength = lengths.reduce((s, l) => s + l, 0) / lengths.length;

        // check all edge-lengths are within 5% of the mean
        lengths.forEach(l=> ok(closeEnough(l, meanLength, meanLength / 20), "edge length = " + l));
    };

    // nodes 0 and 4 will be locked at (-5,0,0) and (5,0,0) respectively
    // with these locks and ideal edge length at 10, unfixed nodes will arc around in a horse-shoe shape
    lock(0, -5);
    lock(4, 5);

    layout.start();

    check();

    // move the lock positions
    lock(0, -10);
    lock(4, 10);

    // run layout incrementally
    for (let i = 0; i < 100; i++) layout.tick();

    check();
});