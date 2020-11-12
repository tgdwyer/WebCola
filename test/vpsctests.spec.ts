import { Variable, Constraint, Solver } from '../src';
import testcases from './vpsctestcases';

test("vpsc", () =>  {
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
        var vs = (t.variables as (number |  {
            desiredPosition: number;
            weight: number;
            scale: number;
        })[]).map(function (u, i) {
            var v;
            if (typeof u === "number") {
                v = new Variable(u);
            }
            else {
                v = new Variable(u.desiredPosition, u.weight, u.scale);
            }
            v.id = i;
            return v;
        });
        var cs = t.constraints.map(function (c) {
            return new Constraint(vs[c.left], vs[c.right], c.gap);
        });
        var solver = new Solver(vs, cs);
        solver.solve();
        if (typeof t.expected !== "undefined") {
            expect(rnd(t.expected, t.precision)).toEqual(res(vs, t.precision)); //, t.description);
        }
    });
});