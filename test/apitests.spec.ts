import {stronglyConnectedComponents, LinkAccessor, Layout, Link, Node, EventType, Node3D, Link3D, Layout3D} from '../src';

describe("Headless API", () => {
    test('strongly connected components', () => {
        var la = <LinkAccessor<number[]>>{
            getSourceIndex: ([source, target]) => source,
            getTargetIndex: ([source, target]) => target
        };
        var links = [[0, 1]];
        var components = stronglyConnectedComponents(2, links, la);
        expect(components).toHaveLength(2);

        links = [[0, 1], [1, 2], [2, 0]];
        components = stronglyConnectedComponents(3, links, la);
        expect(components).toHaveLength(1);

        links = [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3]];
        components = stronglyConnectedComponents(6, links, la);
        expect(components).toHaveLength(2);

        links = [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 2]];
        components = stronglyConnectedComponents(5, links, la);
        expect(components).toHaveLength(1);
    });

    test("Basic headless layout", () => {
        // layout a triangular graph
        // should have no trouble finding an arrangement with all lengths close to the ideal length
        var layout = new Layout()
            .links([
                { source: 0, target: 1 },
                { source: 1, target: 2 },
                { source: 2, target: 0 }])
            .start(10);
        // that's it!

        var vs = layout.nodes();
        expect(vs).toHaveLength(3)//, 'node array created');
        expect(layout.alpha() <= layout.convergenceThreshold() || 'converged to alpha=' + layout.alpha()).toBe(true);
        var checkLengths = idealLength =>
            layout.links().forEach(function (e: Link<Node>) {
                var dx = e.source.x - e.target.x,
                    dy = e.source.y - e.target.y;
                var length = Math.sqrt(dx * dx + dy * dy);
                expect(Math.abs(length - idealLength) < 0.01 || 'correct link length: ' + length).toBe(true);
            });
        checkLengths(layout.linkDistance());

        // rerun layout with a new ideal link length
        layout.linkDistance(10).start(10);
        checkLengths(10);
    });

    test("Layout events", () => {
        // layout a little star graph with listeners counting the different events
        var starts = 0, ticks = 0, ends = 0;

        var layout = new Layout()
            .links([
                { source: 0, target: 1 },
                { source: 1, target: 2 },
                { source: 1, target: 3 }])
            .on(EventType.start, e => starts++)
            .on(EventType.tick, e => ticks++)
            .on(EventType.end, e => ends++)
            .start();

        expect(layout.alpha() <= layout.convergenceThreshold() || 'converged to alpha=' + layout.alpha()).toBe(true);
        expect(starts).toBe(1); //, 'started once');
        expect((ticks >= 1 && ticks < 50) || `ticked ${ticks} times`).toBe(true);
        expect(ends).toBe(1); //, 'ended once');
    });

    test("Stable alignment constraint", () => {
        // layout a pair of connected nodes on a y alignment constraint
        // test:
        //  - alignment constraint works
        //  - non-overlap constraint
        //  - layout does not drift after multiple calls to start
        const nodeSize = 20, threshold = 0.01;
        let starts = 0, ticks = 0, ends = 0,
            layout = new Layout()
                .handleDisconnected(false) // handle disconnected repacks the components which would hide any drift
                .linkDistance(1) // minimal link distance means nodes would overlap if not for...
                .avoidOverlaps(true) // force non-overlap
                .links([{ source: 0, target: 1 }])
                .constraints([{
                    type: "alignment", axis: "y",
                    offsets: [
                        { node: 0, offset: 0 },
                        { node: 1, offset: 0 },
                    ]
                }])
                .on(EventType.start, e => starts++)
                .on(EventType.tick, e => ticks++)
                .on(EventType.end, e => ends++);
        layout.nodes().forEach(v => v.width = v.height = nodeSize) // square nodes
        layout.start(); // first layout

        expect(layout.alpha() <= layout.convergenceThreshold() || 'converged to alpha=' + layout.alpha()).toBe(true);
        expect(starts).toBe(1); //, 'started once');
        expect((ticks >= 1 && ticks < 50) || `ticked ${ticks} times`).toBe(true);
        expect(ends).toBe(1); //, 'ended once');
        const coords = layout.nodes().map(v => <any>{ x: v.x, y: v.y });
        const dx = Math.abs(Math.abs(coords[0].x - coords[1].x) - nodeSize);
        expect(dx < threshold || `node overlap = ${dx}`).toBe(true);
        const dy = Math.abs(coords[0].y - coords[1].y);
        expect(dy < threshold || "y coords equal").toBe(true);

        layout.start(); // relayout!
        expect(starts).toBe(2); //, 'started twice');
        const coords2 = layout.nodes().map(v => <any>{ x: v.x, y: v.y });
        const xdrift = Math.abs(coords2[0].x - coords[0].x);
        expect(xdrift < threshold || "layout stable between calls to start").toBe(true);
    });
});

describe("3D Layout", () => {
    test("single link", () => {
        // single link with non-zero coords only in z-axis.
        // should relax to ideal length, nodes moving only in z-axis
        const nodes = [new Node3D(0, 0, -1), new Node3D(0, 0, 1)];
        const links = [new Link3D(0, 1)];
        const desiredLength = 10;
        let layout = new Layout3D(nodes, links, desiredLength).start();
        let linkLength = layout.linkLength(links[0]);
        nodes.forEach(({ x, y }) => expect(Math.abs(x) < 1e-5 && Math.abs(y) < 1e-5).toBe(true));
        expect(Math.abs(linkLength - desiredLength) < 1e-4 || "length = " + linkLength).toBe(true);

        // test per-link desiredLength:
        const smallerLength = 5;
        links[0].length = smallerLength;
        layout = new Layout3D(nodes, links);
        layout.useJaccardLinkLengths = false;
        layout.start();
        linkLength = layout.linkLength(links[0]);
        expect(Math.abs(linkLength - smallerLength) < 1e-4 || "length = " + linkLength).toBe(true);
    });

    function graph(links: number[][]): {
        nodes: Node3D[];
        links: Link3D[];
    } {
        const N = links.reduce((n, [u, v]) => Math.max(n, u, v), -1) + 1, nodes = new Array(N);
        for (let i = N; i--;) nodes[i] = new Node3D;
        return { nodes: nodes, links: links.map(([u, v]) => new Link3D(u, v)) };
    }

    test("Pyramid", () => {
        // k4 should relax to a 3D pyramid with all edges the same length
        const { nodes, links } = graph([[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]]);
        let layout = new Layout3D(nodes, links, 10).start(0);

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
            expect(sOver >= s || `  overshoot'=${sOver}, s=${s}`).toBe(true);
            expect(sUnder >= s || `  undershoot'=${sUnder}, s=${s}`).toBe(true);
            return [s, alpha];
        }

        for (let i = 0; i < 10; i++) {
            let [s2, alpha] = reduceStress();
            expect(s2 <= s || `s'=${s2}, s=${s}, alpha=${alpha}`).toBe(true);
            s = s2;
        }

        layout = new Layout3D(nodes, links, 10).start();
        const lengths = links.map(l => layout.linkLength(l));
        lengths.forEach(l => expect(Math.abs(l - lengths[0]) < 1e-4 || "length = " + l).toBe(true));
    });

    test("Fixed nodes", () => {
        const { nodes, links } = graph([[0, 1], [1, 2], [2, 3], [3, 4]]);
        let lock = (i, x) => {
            nodes[i].fixed = true;
            nodes[i].x = x;
        }

        let closeEnough = (a, b, t) => Math.abs(a - b) < t;
        const layout = new Layout3D(nodes, links, 10);

        let check = () => {
            // locked nodes should be at their initial position
            for (var i = 0; i < nodes.length; i++) if (nodes[i].fixed)
                Layout3D.dims.forEach((d, j) =>
                    expect(closeEnough(layout.result[j][i], nodes[i][d], 1) || `nodes[${i}] lock in ${d}-axis at ${nodes[i][d]}, actual=${layout.result[j][i]}`).toBe(true));

            const lengths = links.map(l => layout.linkLength(l));
            let meanLength = lengths.reduce((s, l) => s + l, 0) / lengths.length;

            // check all edge-lengths are within 5% of the mean
            lengths.forEach(l => expect(closeEnough(l, meanLength, meanLength / 20) || "edge length = " + l).toBe(true));
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
});
