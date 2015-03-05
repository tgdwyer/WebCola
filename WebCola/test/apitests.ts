///<reference path="qunit.d.ts"/>
///<reference path="../src/layout.ts"/>
QUnit.module("Typescript API Tests");

test("Basic headless layout",() => {
    // layout a triangular graph
    // should have no trouble finding an arrangement with all lengths close to the ideal length
    var layout = new cola.Layout()
        .links([
            { source: 0, target: 1 },
            { source: 1, target: 2 },
            { source: 2, target: 0 }])
        .start();
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
    layout.linkDistance(10).start();
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
    ok(ticks >= 1 && ticks < 20, 'ticked '+ticks+' times');
    equal(ends, 1, 'ended once');
});