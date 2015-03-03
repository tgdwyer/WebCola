///<reference path="vpsc.ts"/>
///<reference path="rectangle.ts"/>
module cola.geom {
    export class Point {
        x: number;
        y: number;
    }

    export class LineSegment {
        constructor(public x1: number, public y1: number, public x2: number, public y2: number) { }
    }

    export class PolyPoint extends Point {
        polyIndex: number;
    }

    /** tests if a point is Left|On|Right of an infinite line.
     * @param points P0, P1, and P2
     * @return >0 for P2 left of the line through P0 and P1
     *            =0 for P2 on the line
     *            <0 for P2 right of the line
     */
    export function isLeft(P0: Point, P1: Point, P2: Point): number {
        return (P1.x - P0.x) * (P2.y - P0.y) - (P2.x - P0.x) * (P1.y - P0.y);
    }

    function above(p: Point, vi: Point, vj: Point): boolean {
        return isLeft(p, vi, vj) > 0;
    }

    function below(p: Point, vi: Point, vj: Point): boolean {
        return isLeft(p, vi, vj) < 0;
    }

    
    /**
     * returns the convex hull of a set of points using Andrew's monotone chain algorithm
     * see: http://geomalgorithms.com/a10-_hull-1.html#Monotone%20Chain
     * @param S array of points
     * @return the convex hull as an array of points
     */
    export function ConvexHull(S: Point[]): Point[] {
        var P = S.slice(0).sort((a, b) => a.x !== b.x ? b.x - a.x : b.y - a.y);
        var n = S.length, i;
        var minmin = 0;
        var xmin = P[0].x;
        for (i = 1; i < n; ++i) {
            if (P[i].x !== xmin) break;
        }
        var minmax = i - 1;
        var H: Point[] = [];
        H.push(P[minmin]); // push minmin point onto stack
        if (minmax === n - 1) { // degenerate case: all x-coords == xmin
            if (P[minmax].y !== P[minmin].y) // a  nontrivial segment
                H.push(P[minmax]);
        } else {
            // Get the indices of points with max x-coord and min|max y-coord
            var maxmin, maxmax = n - 1;
            var xmax = P[n - 1].x;
            for (i = n - 2; i >= 0; i--)
                if (P[i].x !== xmax) break;
            maxmin = i + 1;

            // Compute the lower hull on the stack H
            i = minmax;
            while (++i <= maxmin) {
                // the lower line joins P[minmin]  with P[maxmin]
                if (isLeft(P[minmin], P[maxmin], P[i]) >= 0 && i < maxmin)
                    continue; // ignore P[i] above or on the lower line

                while (H.length > 1) // there are at least 2 points on the stack
                {
                    // test if  P[i] is left of the line at the stack top
                    if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                        break; // P[i] is a new hull  vertex
                    else
                        H.length -= 1; // pop top point off  stack
                }
                if (i != minmin) H.push(P[i]);
            }

            // Next, compute the upper hull on the stack H above the bottom hull
            if (maxmax != maxmin) // if  distinct xmax points
                H.push(P[maxmax]); // push maxmax point onto stack
            var bot = H.length; // the bottom point of the upper hull stack
            i = maxmin;
            while (--i >= minmax) {
                // the upper line joins P[maxmax]  with P[minmax]
                if (isLeft(P[maxmax], P[minmax], P[i]) >= 0 && i > minmax)
                    continue; // ignore P[i] below or on the upper line

                while (H.length > bot) // at least 2 points on the upper stack
                {
                    // test if  P[i] is left of the line at the stack top
                    if (isLeft(H[H.length - 2], H[H.length - 1], P[i]) > 0)
                        break; // P[i] is a new hull  vertex
                    else
                        H.length -= 1; // pop top point off  stack
                }
                if (i != minmin) H.push(P[i]); // push P[i] onto stack
            }
        }
        return H;
    }

    // apply f to the points in P in clockwise order around the point p
    export function clockwiseRadialSweep(p: Point, P: Point[], f: (Point) => void) {
        P.slice(0).sort(
            (a, b) => Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x)
            ).forEach(f);
    }

    function nextPolyPoint(p: PolyPoint, ps: PolyPoint[]): PolyPoint {
        if (p.polyIndex === ps.length - 1) return ps[0];
        return ps[p.polyIndex + 1];
    }

    function prevPolyPoint(p: PolyPoint, ps: PolyPoint[]): PolyPoint {
        if (p.polyIndex === 0) return ps[ps.length - 1];
        return ps[p.polyIndex - 1];
    }

    // tangent_PointPolyC(): fast binary search for tangents to a convex polygon
    //    Input:  P = a 2D point (exterior to the polygon)
    //            n = number of polygon vertices
    //            V = array of vertices for a 2D convex polygon with V[n] = V[0]
    //    Output: rtan = index of rightmost tangent point V[rtan]
    //            ltan = index of leftmost tangent point V[ltan]
    function tangent_PointPolyC(P: Point, V: Point[]): { rtan: number; ltan: number } {
        return { rtan: Rtangent_PointPolyC(P, V), ltan: Ltangent_PointPolyC(P, V) };
    }


    // Rtangent_PointPolyC(): binary search for convex polygon right tangent
    //    Input:  P = a 2D point (exterior to the polygon)
    //            n = number of polygon vertices
    //            V = array of vertices for a 2D convex polygon with V[n] = V[0]
    //    Return: index "i" of rightmost tangent point V[i]
    function Rtangent_PointPolyC(P: Point, V: Point[]): number {
        var n = V.length - 1;

        // use binary search for large convex polygons
        var a: number, b: number, c: number;            // indices for edge chain endpoints
        var upA: boolean, dnC: boolean;           // test for up direction of edges a and c

        // rightmost tangent = maximum for the isLeft() ordering
        // test if V[0] is a local maximum
        if (below(P, V[1], V[0]) && !above(P, V[n - 1], V[0]))
            return 0;               // V[0] is the maximum tangent point

        for (a = 0, b = n; ;) {          // start chain = [0,n] with V[n]=V[0]
            if (b - a === 1) 
                if (above(P, V[a], V[b]))
                    return a;
                else 
                    return b;

            c = Math.floor((a + b) / 2);        // midpoint of [a,b], and 0<c<n
            dnC = below(P, V[c + 1], V[c]);
            if (dnC && !above(P, V[c - 1], V[c]))
                return c;          // V[c] is the maximum tangent point

            // no max yet, so continue with the binary search
            // pick one of the two subchains [a,c] or [c,b]
            upA = above(P, V[a + 1], V[a]);
            if (upA) {                       // edge a points up
                if (dnC)                         // edge c points down
                    b = c;                           // select [a,c]
                else {                           // edge c points up
                    if (above(P, V[a], V[c]))     // V[a] above V[c]
                        b = c;                       // select [a,c]
                    else                          // V[a] below V[c]
                        a = c;                       // select [c,b]
                }
            }
            else {                           // edge a points down
                if (!dnC)                        // edge c points up
                    a = c;                           // select [c,b]
                else {                           // edge c points down
                    if (below(P, V[a], V[c]))     // V[a] below V[c]
                        b = c;                       // select [a,c]
                    else                          // V[a] above V[c]
                        a = c;                       // select [c,b]
                }
            }
        }
    }

    // Ltangent_PointPolyC(): binary search for convex polygon left tangent
    //    Input:  P = a 2D point (exterior to the polygon)
    //            n = number of polygon vertices
    //            V = array of vertices for a 2D convex polygon with V[n]=V[0]
    //    Return: index "i" of leftmost tangent point V[i]
    function Ltangent_PointPolyC(P: Point, V: Point[]): number {
        var n = V.length - 1;
        // use binary search for large convex polygons
        var a: number, b: number, c: number;             // indices for edge chain endpoints
        var dnA: boolean, dnC: boolean;           // test for down direction of edges a and c

        // leftmost tangent = minimum for the isLeft() ordering
        // test if V[0] is a local minimum
        if (above(P, V[n - 1], V[0]) && !below(P, V[1], V[0]))
            return 0;               // V[0] is the minimum tangent point

        for (a = 0, b = n; ;) {          // start chain = [0,n] with V[n] = V[0]
            if (b - a === 1)
                if (below(P, V[a], V[b]))
                    return a;
                else
                    return b;

            c = Math.floor((a + b) / 2);        // midpoint of [a,b], and 0<c<n
            dnC = below(P, V[c + 1], V[c]);
            if (above(P, V[c - 1], V[c]) && !dnC)
                return c;          // V[c] is the minimum tangent point

            // no min yet, so continue with the binary search
            // pick one of the two subchains [a,c] or [c,b]
            dnA = below(P, V[a + 1], V[a]);
            if (dnA) {                       // edge a points down
                if (!dnC)                        // edge c points up
                    b = c;                           // select [a,c]
                else {                           // edge c points down
                    if (below(P, V[a], V[c]))     // V[a] below V[c]
                        b = c;                       // select [a,c]
                    else                          // V[a] above V[c]
                        a = c;                       // select [c,b]
                }
            }
            else {                           // edge a points up
                if (dnC)                         // edge c points down
                    a = c;                           // select [c,b]
                else {                           // edge c points up
                    if (above(P, V[a], V[c]))     // V[a] above V[c]
                        b = c;                       // select [a,c]
                    else                          // V[a] below V[c]
                        a = c;                       // select [c,b]
                }
            }
        }
    }

    // RLtangent_PolyPolyC(): get the RL tangent between two convex polygons
    //    Input:  m = number of vertices in polygon 1
    //            V = array of vertices for convex polygon 1 with V[m]=V[0]
    //            n = number of vertices in polygon 2
    //            W = array of vertices for convex polygon 2 with W[n]=W[0]
    //    Output: *t1 = index of tangent point V[t1] for polygon 1
    //            *t2 = index of tangent point W[t2] for polygon 2
    export function tangent_PolyPolyC(V: Point[], W: Point[], t1: (a, b) => number, t2: (a, b) => number, cmp1: (a, b, c) => boolean, cmp2: (a, b, c) => boolean): { t1: number; t2: number } {
        var ix1: number, ix2: number;      // search indices for polygons 1 and 2

        // first get the initial vertex on each polygon
        ix1 = t1(W[0], V);   // right tangent from W[0] to V
        ix2 = t2(V[ix1], W); // left tangent from V[ix1] to W

        // ping-pong linear search until it stabilizes
        var done = false;                    // flag when done
        while (!done) {
            done = true;                     // assume done until...
            while (true) {
                if (ix1 === V.length - 1) ix1 = 0;
                if (cmp1(W[ix2], V[ix1], V[ix1 + 1])) break;
                ++ix1;                       // get Rtangent from W[ix2] to V
            }
            while (true) {
                if (ix2 === 0) ix2 = W.length - 1;
                if (cmp2(V[ix1], W[ix2], W[ix2 - 1])) break;
                --ix2;                       // get Ltangent from V[ix1] to W
                done = false;                // not done if had to adjust this
            }
        }
        return { t1: ix1, t2: ix2 };
    }

    export function LRtangent_PolyPolyC(V: Point[], W: Point[]): { t1: number; t2: number } {
        var rl = RLtangent_PolyPolyC(W, V);
        return { t1: rl.t2, t2: rl.t1 };
    }

    export function RLtangent_PolyPolyC(V: Point[], W: Point[]): { t1: number; t2: number } {
        return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Ltangent_PointPolyC, above, below);
    }

    export function LLtangent_PolyPolyC(V: Point[], W: Point[]): { t1: number; t2: number } {
        return tangent_PolyPolyC(V, W, Ltangent_PointPolyC, Ltangent_PointPolyC, below, below);
    }

    export function RRtangent_PolyPolyC(V: Point[], W: Point[]): { t1: number; t2: number } {
        return tangent_PolyPolyC(V, W, Rtangent_PointPolyC, Rtangent_PointPolyC, above, above);
    }

    export class BiTangent {
        constructor(public t1: number, public t2: number) { }
    }

    export class BiTangents {
        rl: BiTangent;
        lr: BiTangent;
        ll: BiTangent;
        rr: BiTangent;
    }

    export class TVGPoint extends Point {
        vv: VisibilityVertex;
    }

    export class VisibilityVertex {
        constructor(
            public id: number,
            public polyid: number,
            public polyvertid: number,
            public p: TVGPoint)
        {
            p.vv = this;
        }
    }

    export class VisibilityEdge {
        constructor(
            public source: VisibilityVertex,
            public target: VisibilityVertex) { }
        length(): number {
            var dx = this.source.p.x - this.target.p.x;
            var dy = this.source.p.y - this.target.p.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
    }

    export class TangentVisibilityGraph {
        V: VisibilityVertex[] = [];
        E: VisibilityEdge[] = [];
        constructor(public P: TVGPoint[][], g0?: { V: VisibilityVertex[]; E: VisibilityEdge[] }) {
            if (!g0) {
                var n = P.length;
                for (var i = 0; i < n; i++) {
                    var p = P[i];
                    for (var j = 0; j < p.length; ++j) {
                        var pj = p[j],
                            vv = new VisibilityVertex(this.V.length, i, j, pj);
                        this.V.push(vv);
                        if (j > 0) this.E.push(new VisibilityEdge(p[j - 1].vv, vv));
                    }
                }
                for (var i = 0; i < n - 1; i++) {
                    var Pi = P[i];
                    for (var j = i + 1; j < n; j++) {
                        var Pj = P[j],
                            t = geom.tangents(Pi, Pj);
                        for (var q in t) {
                            var c = t[q],
                                source = Pi[c.t1], target = Pj[c.t2];
                            this.addEdgeIfVisible(source, target, i, j);
                        }
                    }
                }
            } else {
                this.V = g0.V.slice(0);
                this.E = g0.E.slice(0);
            }
        }
        addEdgeIfVisible(u: TVGPoint, v: TVGPoint, i1: number, i2: number) {
            if (!this.intersectsPolys(new LineSegment(u.x, u.y, v.x, v.y), i1, i2)) {
                this.E.push(new VisibilityEdge(u.vv, v.vv));
            }
        }
        addPoint(p: TVGPoint, i1: number): VisibilityVertex {
            var n = this.P.length;
            this.V.push(new VisibilityVertex(this.V.length, n, 0, p));
            for (var i = 0; i < n; ++i) {
                if (i === i1) continue;
                var poly = this.P[i],
                    t = tangent_PointPolyC(p, poly);
                this.addEdgeIfVisible(p, poly[t.ltan], i1, i);
                this.addEdgeIfVisible(p, poly[t.rtan], i1, i);
            }
            return p.vv;
        }
        private intersectsPolys(l: LineSegment, i1: number, i2: number): boolean {
            for (var i = 0, n = this.P.length; i < n; ++i) {
                if (i != i1 && i != i2 && intersects(l, this.P[i]).length > 0) {
                    return true;
                }
            }
            return false;
        }
    }

    function intersects(l: LineSegment, P: Point[]) {
        var ints = [];
        for (var i = 1, n = P.length; i < n; ++i) {
            var int = cola.vpsc.Rectangle.lineIntersection(
                l.x1, l.y1,
                l.x2, l.y2,
                P[i - 1].x, P[i - 1].y,
                P[i].x, P[i].y
                );
            if (int) ints.push(int);
        }
        return ints;
    }

    export function tangents(V: Point[], W: Point[]): BiTangents
    {
        var m = V.length - 1, n = W.length - 1;
        var bt = new BiTangents();
        for (var i = 0; i < m; ++i) {
            for (var j = 0; j < n; ++j) {
                var v1 = V[i == 0 ? m - 1 : i - 1];
                var v2 = V[i];
                var v3 = V[i + 1];
                var w1 = W[j == 0 ? n - 1 : j - 1];
                var w2 = W[j];
                var w3 = W[j + 1];
                var v1v2w2 = isLeft(v1, v2, w2);
                var v2w1w2 = isLeft(v2, w1, w2);
                var v2w2w3 = isLeft(v2, w2, w3);
                var w1w2v2 = isLeft(w1, w2, v2);
                var w2v1v2 = isLeft(w2, v1, v2);
                var w2v2v3 = isLeft(w2, v2, v3);
                if (v1v2w2 >= 0 && v2w1w2 >= 0 && v2w2w3 < 0
                    && w1w2v2 >= 0 && w2v1v2 >= 0 && w2v2v3 < 0) {
                        bt.ll = new BiTangent(i, j);
                } else if (v1v2w2 <= 0 && v2w1w2 <= 0 && v2w2w3 > 0
                    && w1w2v2 <= 0 && w2v1v2 <= 0 && w2v2v3 > 0) {
                        bt.rr = new BiTangent(i, j);
                } else if (v1v2w2 <= 0 && v2w1w2 > 0 && v2w2w3 <= 0
                    && w1w2v2 >= 0 && w2v1v2 < 0 && w2v2v3 >= 0) {
                        bt.rl = new BiTangent(i, j);
                } else if (v1v2w2 >= 0 && v2w1w2 < 0 && v2w2w3 >= 0
                    && w1w2v2 <= 0 && w2v1v2 > 0 && w2v2v3 <= 0) {
                        bt.lr = new BiTangent(i, j);
                }
            }
        }
        return bt;
    }

    function isPointInsidePoly(p: Point, poly: Point[]): boolean {
        for (var i = 1, n = poly.length; i < n; ++i) 
            if (below(poly[i - 1], poly[i], p)) return false;
        return true;
    }

    function isAnyPInQ(p: Point[], q: Point[]): boolean {
        return !p.every(v => !isPointInsidePoly(v, q));
    }

    export function polysOverlap(p: Point[], q: Point[]): boolean {
        if (isAnyPInQ(p, q)) return true;
        if (isAnyPInQ(q, p)) return true;
        for (var i = 1, n = p.length; i < n; ++i) {
            var v = p[i], u = p[i - 1];
            if (intersects(new LineSegment(u.x, u.y, v.x, v.y), q).length > 0) return true;
        }
        return false;
    }
} 