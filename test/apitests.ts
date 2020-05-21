import * as QUnit from 'qunit';
import * as cola from '../index';

QUnit.module("Headless API");
QUnit.test('strongly connected components', (assert) => {
    var la = <cola.LinkAccessor<number[]>> {
        getSourceIndex: ([source, target]) => source,
        getTargetIndex: ([source, target]) => target
    };
    var links = [[0, 1]];
    var components = cola.stronglyConnectedComponents(2, links, la);
    assert.equal(components.length, 2);

    links = [[0, 1], [1, 2], [2, 0]];
    components = cola.stronglyConnectedComponents(3, links, la);
    assert.equal(components.length, 1);

    links = [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3]];
    components = cola.stronglyConnectedComponents(6, links, la);
    assert.equal(components.length, 2);

    links = [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 2]];
    components = cola.stronglyConnectedComponents(5, links, la);
    assert.equal(components.length, 1);
});

QUnit.test("Basic headless layout",(assert) => {
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
    assert.equal(vs.length, 3, 'node array created');
    assert.ok(layout.alpha() <= layout.convergenceThreshold(), 'converged to alpha='+layout.alpha());
    var checkLengths = idealLength =>
        layout.links().forEach(function(e: cola.Link<cola.Node>) {
            var dx = e.source.x - e.target.x,
                dy = e.source.y - e.target.y;
            var length = Math.sqrt(dx * dx + dy * dy);
            assert.ok(Math.abs(length - idealLength) < 0.01, 'correct link length: '+length);
        });
    checkLengths(layout.linkDistance());

    // rerun layout with a new ideal link length
    layout.linkDistance(10).start(10);
    checkLengths(10);
});

QUnit.test("Layout events",(assert) => {
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

    assert.ok(layout.alpha() <= layout.convergenceThreshold(), 'converged to alpha=' + layout.alpha());
    assert.equal(starts, 1, 'started once');
    assert.ok(ticks >= 1 && ticks < 50, `ticked ${ticks} times`);
    assert.equal(ends, 1, 'ended once');
});

QUnit.test("Stable alignment constraint", (assert) => {
    // layout a pair of connected nodes on a y alignment constraint
    // test:
    //  - alignment constraint works
    //  - non-overlap constraint
    //  - layout does not drift after multiple calls to start
    const nodeSize = 20, threshold = 0.01;
    let starts = 0, ticks = 0, ends = 0,
        layout = new cola.Layout()
        .handleDisconnected(false) // handle disconnected repacks the components which would hide any drift
        .linkDistance(1) // minimal link distance means nodes would overlap if not for...
        .avoidOverlaps(true) // force non-overlap
        .links([{ source: 0, target: 1 }])
        .constraints([{ type: "alignment", axis: "y",
            offsets: [
                { node: 0, offset: 0 },
                { node: 1, offset: 0 },
            ]
        }])
        .on(cola.EventType.start, e => starts++)
        .on(cola.EventType.tick, e => ticks++)
        .on(cola.EventType.end, e => ends++);
    layout.nodes().forEach(v=>v.width = v.height = nodeSize) // square nodes
    layout.start(); // first layout

    assert.ok(layout.alpha() <= layout.convergenceThreshold(), 'converged to alpha=' + layout.alpha());
    assert.equal(starts, 1, 'started once');
    assert.ok(ticks >= 1 && ticks < 50, `ticked ${ticks} times`);
    assert.equal(ends, 1, 'ended once');
    const coords = layout.nodes().map(v => <any>{x:v.x, y:v.y});
    const dx = Math.abs(Math.abs(coords[0].x - coords[1].x) - nodeSize);
    assert.ok(dx < threshold, `node overlap = ${dx}`);
    const dy = Math.abs(coords[0].y - coords[1].y);
    assert.ok(dy < threshold, "y coords equal");

    layout.start(); // relayout!
    assert.equal(starts, 2, 'started twice');
    const coords2 = layout.nodes().map(v => <any>{x:v.x, y:v.y});
    const xdrift = Math.abs(coords2[0].x - coords[0].x);
    assert.ok(xdrift < threshold, "layout stable between calls to start");
});

QUnit.module("3D Layout");

QUnit.test("single link", (assert) => {
    // single link with non-zero coords only in z-axis.
    // should relax to ideal length, nodes moving only in z-axis
    const nodes = [new cola.Node3D(0, 0, -1), new cola.Node3D(0, 0, 1)];
    const links = [new cola.Link3D(0, 1)];
    const desiredLength = 10;
    let layout = new cola.Layout3D(nodes, links, desiredLength).start();
    let linkLength = layout.linkLength(links[0]);
    nodes.forEach(({x, y}) => assert.ok(Math.abs(x) < 1e-5 && Math.abs(y) < 1e-5));
    assert.ok(Math.abs(linkLength - desiredLength) < 1e-4, "length = " + linkLength);

    // test per-link desiredLength:
    const smallerLength = 5;
    links[0].length = smallerLength;
    layout = new cola.Layout3D(nodes, links);
    layout.useJaccardLinkLengths = false;
    layout.start();
    linkLength = layout.linkLength(links[0]);
    assert.ok(Math.abs(linkLength - smallerLength) < 1e-4, "length = " + linkLength);
});

function graph(links: number[][]): {
    nodes: cola.Node3D[];
    links: cola.Link3D[];
} {
    const N = links.reduce((n, [u, v]) => Math.max(n, u, v), -1) + 1, nodes = new Array(N);
    for (let i = N; i--;) nodes[i] = new cola.Node3D;
    return { nodes: nodes, links: links.map(([u, v]) => new cola.Link3D(u, v)) };
}

QUnit.test("Pyramid", (assert) => {
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
        assert.ok(sOver >= s, `  overshoot'=${sOver}, s=${s}`);
        assert.ok(sUnder >= s, `  undershoot'=${sUnder}, s=${s}`);
        return [s,alpha];
    }

    for (let i = 0; i < 10; i++) {
        let [s2, alpha] = reduceStress();
        assert.ok(s2 <= s, `s'=${s2}, s=${s}, alpha=${alpha}`);
        s = s2;
    }

    layout = new cola.Layout3D(nodes, links, 10).start();
    const lengths = links.map(l=> layout.linkLength(l));
    lengths.forEach(l=> assert.ok(Math.abs(l - lengths[0]) < 1e-4, "length = " + l));
});

QUnit.test("Fixed nodes", (assert) => {
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
            assert.ok(closeEnough(layout.result[j][i], nodes[i][d], 1), `nodes[${i}] lock in ${d}-axis at ${nodes[i][d]}, actual=${layout.result[j][i]}`));

        const lengths = links.map(l=> layout.linkLength(l));
        let meanLength = lengths.reduce((s, l) => s + l, 0) / lengths.length;

        // check all edge-lengths are within 5% of the mean
        lengths.forEach(l=> assert.ok(closeEnough(l, meanLength, meanLength / 20), "edge length = " + l));
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
