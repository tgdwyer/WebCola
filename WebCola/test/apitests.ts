///<reference path="qunit.d.ts"/>
///<reference path="../src/layout.ts"/>
QUnit.module("Typescript API Tests");

test("Basic headless layout", () => {
    var layout = new cola.Layout()
        .links([ // a triangle
            { source: 0, target: 1 },
            { source: 1, target: 2 },
            { source: 2, target: 0 }])
        .start();
    var vs = layout.nodes();
    equal(vs.length, 3, 'node array created');
    ok(layout.alpha() <= 0.01, 'converged');
    var checkLengths = idealLength =>
        layout.links().forEach(e=> {
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