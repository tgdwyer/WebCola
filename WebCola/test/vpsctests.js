"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var QUnit = require("qunit");
var cola = require("../index");
var testcases = require("./vpsctestcases");
QUnit.test("vpsc", function (assert) {
    var round = function (v, p) {
        var m = Math.pow(10, p);
        return Math.round(v * m) / m;
    };
    var rnd = function (a, p) {
        if (typeof p === "undefined") {
            p = 4;
        }
        return a.map(function (v) { return round(v, p); });
    };
    var res = function (a, p) {
        if (typeof p === "undefined") {
            p = 4;
        }
        return a.map(function (v) { return round(v.position(), p); });
    };
    testcases.forEach(function (t) {
        var vs = t.variables.map(function (u, i) {
            var v;
            if (typeof u === "number") {
                v = new cola.Variable(u);
            }
            else {
                v = new cola.Variable(u.desiredPosition, u.weight, u.scale);
            }
            v.id = i;
            return v;
        });
        var cs = t.constraints.map(function (c) {
            return new cola.Constraint(vs[c.left], vs[c.right], c.gap);
        });
        var solver = new cola.Solver(vs, cs);
        solver.solve();
        if (typeof t.expected !== "undefined") {
            assert.deepEqual(rnd(t.expected, t.precision), res(vs, t.precision), t.description);
        }
    });
});
//# sourceMappingURL=vpsctests.js.map