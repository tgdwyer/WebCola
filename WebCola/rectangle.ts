///<reference path="vpsc.ts"/>
///<reference path="rbtree.d.ts"/>
module vpsc {
    export class Rectangle {
        x: number;
        X: number;
        y: number;
        Y: number;

        constructor (x: number, X: number, y: number, Y: number) {
            this.x = x;
            this.X = X;
            this.y = y;
            this.Y = Y;
        }

        cx(): number { return (this.x + this.X) / 2; }

        cy(): number { return (this.y + this.Y) / 2; }

        overlapX(r: Rectangle): number {
            var ux = this.cx(), vx = r.cx();
            if (ux <= vx && r.x < this.X) return this.X - r.x;
            if (vx <= ux && this.x < r.X) return r.X - this.x;
            return 0;
        }

        overlapY(r: Rectangle): number {
            var uy = this.cy(), vy = r.cy();
            if (uy <= vy && r.y < this.Y) return this.Y - r.y;
            if (vy <= uy && this.y < r.Y) return r.Y - this.y;
            return 0;
        }

        setXCentre(cx: number): void {
            var dx = cx - this.cx();
            this.x += dx;
            this.X += dx;
        }

        setYCentre(cy: number): void {
            var dy = cy - this.cy();
            this.y += dy;
            this.Y += dy;
        }
    }

    class Node {
        v: Variable;
        r: Rectangle;
        pos: number;
        prev: RBTree<Node>;
        next: RBTree<Node>;

        constructor(v: Variable, r: Rectangle, p: number) {
            this.v = v;
            this.r = r;
            this.pos = p;
            this.prev = makeRBTree();
            this.next = makeRBTree();
        }
    }

    class Event {
        isOpen: boolean;
        v: Node;
        pos: number;

        constructor(isOpen: boolean, v: Node, p: number) {
            this.isOpen = isOpen;
            this.v = v;
            this.pos = p;
        }
    }

    function compareEvents(a: Event, b: Event): number {
        if (a.pos > b.pos) {
            return 1;
        }
        if (a.pos < b.pos) {
            return -1;
        }
        if (a.isOpen) {
            // open must come before close
            return -1;
        }
        return 0;
    }

    function makeRBTree(): RBTree<Node> {
        return new RBTree<Node>((a, b) => a.pos - b.pos);
    }

    function generateConstraints(rs: Rectangle[], vars: Variable[], minSep: number,
        getCentre: (r: Rectangle) => number,
        getOpen: (r: Rectangle) => number,
        getClose: (r: Rectangle) => number,
        getSize: (r: Rectangle) => number,
        findNeighbours: (v: Node, scanline: RBTree<Node>) => void
        ): Constraint[]
    {
        var i, n = rs.length;
        var N = 2 * n;
        console.assert(vars.length >= n);
        var events = new Array<Event>(N);
        for (i = 0; i < n; ++i) {
            var r = rs[i];
            var v = new Node(vars[i], r, getCentre(r));
            events[i] = new Event(true, v, getOpen(r));
            events[i + n] = new Event(false, v, getClose(r));
        }
        events.sort(compareEvents);
        var cs = new Array<Constraint>();
        var scanline = makeRBTree();
        for (i = 0; i < N; ++i) {
            var e = events[i];
            var v = e.v;
            if (e.isOpen) {
                scanline.insert(v);
                findNeighbours(v, scanline);
            } else {
                // close event
                scanline.remove(v);
                var makeConstraint = (l, r) => {
                    var sep = (getSize(l.r) + getSize(r.r)) / 2 + minSep;
                    cs.push(new Constraint(l.v, r.v, sep));
                };
                var visitNeighbours = (forward, reverse, mkcon) => {
                    var u, it = v[forward].iterator();
                    while ((u = it[forward]()) !== null) {
                        mkcon(u, v);
                        u[reverse].remove(v);
                    }
                };
                visitNeighbours("prev", "next", (u, v) => makeConstraint(u, v));
                visitNeighbours("next", "prev", (u, v) => makeConstraint(v, u));
            }
        }
        console.assert(scanline.size === 0);
        return cs;
    }

    function findXNeighbours(v: Node, scanline: RBTree<Node>): void {
        var f = (forward, reverse) => {
            var it = scanline.findIter(v);
            var u;
            while ((u = it[forward]()) !== null) {
                var uovervX = u.r.overlapX(v.r);
                if (uovervX <= 0 || uovervX <= u.r.overlapY(v.r)) {
                    v[forward].insert(u);
                    u[reverse].insert(v);
                }
                if (uovervX <= 0) {
                    break;
                }
            }
        }
        f("next", "prev");
        f("prev", "next");
    }

    function findYNeighbours(v: Node, scanline: RBTree<Node>): void {
        var f = (forward, reverse) => {
            var u = scanline.findIter(v)[forward]();
            if (u !== null && u.r.overlapX(v.r) > 0) {
                v[forward].insert(u);
                u[reverse].insert(v);
            }
        }
        f("next", "prev");
        f("prev", "next");
    }

    export function generateXConstraints(rs: Rectangle[], vars: Variable[]): Constraint[] {
        return generateConstraints(rs, vars, 1e-6, r=> r.cx(), r=> r.y, r=> r.Y, r=> r.X - r.x, findXNeighbours);
    }

    export function generateYConstraints(rs: Rectangle[], vars: Variable[]): Constraint[] {
        return generateConstraints(rs, vars, 1e-6, r=> r.cy(), r=> r.x, r=> r.X, r=> r.Y - r.y, findYNeighbours);
    }

    export function removeOverlaps(rs: Rectangle[]): void {
        var vs = rs.map(r => new vpsc.Variable(r.cx()));
        var cs = vpsc.generateXConstraints(rs, vs);
        var solver = new vpsc.Solver(vs, cs);
        solver.solve();
        vs.forEach((v, i) => rs[i].setXCentre(v.position()));
        vs = rs.map(function (r) {
            return new vpsc.Variable(r.cy());
        });
        cs = vpsc.generateYConstraints(rs, vs);
        solver = new vpsc.Solver(vs, cs);
        solver.solve();
        vs.forEach((v, i) => rs[i].setYCentre(v.position()));
    }
}