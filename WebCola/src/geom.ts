module geom {
    export class Point {
        x: number;
        y: number;
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

    /**
     * returns the convex hull of a set of points using Andrew's monotone chain algorithm
     * see: http://geomalgorithms.com/a10-_hull-1.html#Monotone%20Chain
     * @param S array of points
     * @return the convex hull as an array of points
     */
    export function ConvexHull(S: Point[]): Point[]{
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
} 