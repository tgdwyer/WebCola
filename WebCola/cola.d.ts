/// <reference path="extern/d3v3.d.ts" />
declare module "src/linklengths" {
    export interface LinkAccessor<Link> {
        getSourceIndex(l: Link): number;
        getTargetIndex(l: Link): number;
    }
    export interface LinkLengthAccessor<Link> extends LinkAccessor<Link> {
        setLength(l: Link, value: number): void;
    }
    export function symmetricDiffLinkLengths<Link>(links: Link[], la: LinkLengthAccessor<Link>, w?: number): void;
    export function jaccardLinkLengths<Link>(links: Link[], la: LinkLengthAccessor<Link>, w?: number): void;
    export interface IConstraint {
        left: number;
        right: number;
        gap: number;
    }
    export interface DirectedEdgeConstraints {
        axis: string;
        gap: number;
    }
    export interface LinkSepAccessor<Link> extends LinkAccessor<Link> {
        getMinSeparation(l: Link): number;
    }
    export function generateDirectedEdgeConstraints<Link>(n: number, links: Link[], axis: string, la: LinkSepAccessor<Link>): IConstraint[];
    export function stronglyConnectedComponents<Link>(numVertices: number, edges: Link[], la: LinkAccessor<Link>): number[][];
}
declare module "src/powergraph" {
    import { LinkAccessor } from "src/linklengths";
    export interface LinkTypeAccessor<Link> extends LinkAccessor<Link> {
        getType(l: Link): number;
    }
    export class PowerEdge {
        source: any;
        target: any;
        type: number;
        constructor(source: any, target: any, type: number);
    }
    export class Configuration<Link> {
        private linkAccessor;
        modules: Module[];
        roots: ModuleSet[];
        R: number;
        constructor(n: number, edges: Link[], linkAccessor: LinkTypeAccessor<Link>, rootGroup?: any[]);
        private initModulesFromGroup(group);
        merge(a: Module, b: Module, k?: number): Module;
        private rootMerges(k?);
        greedyMerge(): boolean;
        private nEdges(a, b);
        getGroupHierarchy(retargetedEdges: PowerEdge[]): any[];
        allEdges(): PowerEdge[];
        static getEdges(modules: ModuleSet, es: PowerEdge[]): void;
    }
    export class Module {
        id: number;
        outgoing: LinkSets;
        incoming: LinkSets;
        children: ModuleSet;
        definition: any;
        gid: number;
        constructor(id: number, outgoing?: LinkSets, incoming?: LinkSets, children?: ModuleSet, definition?: any);
        getEdges(es: PowerEdge[]): void;
        isLeaf(): boolean;
        isIsland(): boolean;
        isPredefined(): boolean;
    }
    export class ModuleSet {
        table: any;
        count(): number;
        intersection(other: ModuleSet): ModuleSet;
        intersectionCount(other: ModuleSet): number;
        contains(id: number): boolean;
        add(m: Module): void;
        remove(m: Module): void;
        forAll(f: (m: Module) => void): void;
        modules(): Module[];
    }
    export class LinkSets {
        sets: any;
        n: number;
        count(): number;
        contains(id: number): boolean;
        add(linktype: number, m: Module): void;
        remove(linktype: number, m: Module): void;
        forAll(f: (ms: ModuleSet, linktype: number) => void): void;
        forAllModules(f: (m: Module) => void): void;
        intersection(other: LinkSets): LinkSets;
    }
    export function getGroups<Link>(nodes: any[], links: Link[], la: LinkTypeAccessor<Link>, rootGroup?: any[]): {
        groups: any[];
        powerEdges: PowerEdge[];
    };
}
declare module "src/descent" {
    export class Locks {
        locks: {
            [key: number]: number[];
        };
        add(id: number, x: number[]): void;
        clear(): void;
        isEmpty(): boolean;
        apply(f: (id: number, x: number[]) => void): void;
    }
    export class Descent {
        D: number[][];
        G: number[][];
        threshold: number;
        H: number[][][];
        g: number[][];
        x: number[][];
        k: number;
        n: number;
        locks: Locks;
        private static zeroDistance;
        private minD;
        private Hd;
        private a;
        private b;
        private c;
        private d;
        private e;
        private ia;
        private ib;
        private xtmp;
        numGridSnapNodes: number;
        snapGridSize: number;
        snapStrength: number;
        scaleSnapByMaxH: boolean;
        private random;
        project: {
            (x0: number[], y0: number[], r: number[]): void;
        }[];
        constructor(x: number[][], D: number[][], G?: number[][]);
        static createSquareMatrix(n: number, f: (i: number, j: number) => number): number[][];
        private offsetDir();
        computeDerivatives(x: number[][]): void;
        private static dotProd(a, b);
        private static rightMultiply(m, v, r);
        computeStepSize(d: number[][]): number;
        reduceStress(): number;
        private static copy(a, b);
        private stepAndProject(x0, r, d, stepSize);
        private static mApply(m, n, f);
        private matrixApply(f);
        private computeNextPosition(x0, r);
        run(iterations: number): number;
        rungeKutta(): number;
        private static mid(a, b, m);
        takeDescentStep(x: number[], d: number[], stepSize: number): void;
        computeStress(): number;
    }
    export class PseudoRandom {
        seed: number;
        private a;
        private c;
        private m;
        private range;
        constructor(seed?: number);
        getNext(): number;
        getNextBetween(min: number, max: number): number;
    }
}
declare module "src/vpsc" {
    export class PositionStats {
        scale: number;
        AB: number;
        AD: number;
        A2: number;
        constructor(scale: number);
        addVariable(v: Variable): void;
        getPosn(): number;
    }
    export class Constraint {
        left: Variable;
        right: Variable;
        gap: number;
        equality: boolean;
        lm: number;
        active: boolean;
        unsatisfiable: boolean;
        constructor(left: Variable, right: Variable, gap: number, equality?: boolean);
        slack(): number;
    }
    export class Variable {
        desiredPosition: number;
        weight: number;
        scale: number;
        offset: number;
        block: Block;
        cIn: Constraint[];
        cOut: Constraint[];
        constructor(desiredPosition: number, weight?: number, scale?: number);
        dfdv(): number;
        position(): number;
        visitNeighbours(prev: Variable, f: (c: Constraint, next: Variable) => void): void;
    }
    export class Block {
        vars: Variable[];
        posn: number;
        ps: PositionStats;
        blockInd: number;
        constructor(v: Variable);
        private addVariable(v);
        updateWeightedPosition(): void;
        private compute_lm(v, u, postAction);
        private populateSplitBlock(v, prev);
        traverse(visit: (c: Constraint) => any, acc: any[], v?: Variable, prev?: Variable): void;
        findMinLM(): Constraint;
        private findMinLMBetween(lv, rv);
        private findPath(v, prev, to, visit);
        isActiveDirectedPathBetween(u: Variable, v: Variable): boolean;
        static split(c: Constraint): Block[];
        private static createSplitBlock(startVar);
        splitBetween(vl: Variable, vr: Variable): {
            constraint: Constraint;
            lb: Block;
            rb: Block;
        };
        mergeAcross(b: Block, c: Constraint, dist: number): void;
        cost(): number;
    }
    export class Blocks {
        vs: Variable[];
        private list;
        constructor(vs: Variable[]);
        cost(): number;
        insert(b: Block): void;
        remove(b: Block): void;
        merge(c: Constraint): void;
        forEach(f: (b: Block, i: number) => void): void;
        updateBlockPositions(): void;
        split(inactive: Constraint[]): void;
    }
    export class Solver {
        vs: Variable[];
        cs: Constraint[];
        bs: Blocks;
        inactive: Constraint[];
        static LAGRANGIAN_TOLERANCE: number;
        static ZERO_UPPERBOUND: number;
        constructor(vs: Variable[], cs: Constraint[]);
        cost(): number;
        setStartingPositions(ps: number[]): void;
        setDesiredPositions(ps: number[]): void;
        private mostViolated();
        satisfy(): void;
        solve(): number;
    }
    export function removeOverlapInOneDimension(spans: {
        size: number;
        desiredCenter: number;
    }[], lowerBound?: number, upperBound?: number): {
        newCenters: number[];
        lowerBound: number;
        upperBound: number;
    };
}
declare module "src/rbtree" {
    export class TreeBase {
        _root: any;
        size: any;
        _comparator: any;
        clear(): void;
        find(data: any): any;
        findIter: (data: any) => any;
        lowerBound(data: any): Iterator;
        upperBound(data: any): Iterator;
        min(): any;
        max(): any;
        iterator(): Iterator;
        each(cb: any): void;
        reach(cb: any): void;
        _bound(data: any, cmp: any): Iterator;
    }
    export class Iterator {
        _tree: any;
        _ancestors: any;
        _cursor: any;
        constructor(tree: any);
        data(): any;
        next(): any;
        prev(): any;
        _minNode(start: any): void;
        _maxNode(start: any): void;
    }
    export class RBTree<T> extends TreeBase {
        _root: any;
        _comparator: any;
        size: any;
        constructor(comparator: (a: T, b: T) => number);
        insert(data: any): boolean;
        remove(data: any): boolean;
        static is_red(node: any): any;
        static single_rotate(root: any, dir: any): any;
        static double_rotate(root: any, dir: any): any;
    }
}
declare module "src/geom" {
    export class Point {
        x: number;
        y: number;
    }
    export class LineSegment {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        constructor(x1: number, y1: number, x2: number, y2: number);
    }
    export class PolyPoint extends Point {
        polyIndex: number;
    }
    export function isLeft(P0: Point, P1: Point, P2: Point): number;
    export function ConvexHull(S: Point[]): Point[];
    export function clockwiseRadialSweep(p: Point, P: Point[], f: (p: Point) => void): void;
    export function tangent_PolyPolyC(V: Point[], W: Point[], t1: (a: Point, b: Point[]) => number, t2: (a: Point, b: Point[]) => number, cmp1: (a: Point, b: Point, c: Point) => boolean, cmp2: (a: Point, b: Point, c: Point) => boolean): {
        t1: number;
        t2: number;
    };
    export function LRtangent_PolyPolyC(V: Point[], W: Point[]): {
        t1: number;
        t2: number;
    };
    export function RLtangent_PolyPolyC(V: Point[], W: Point[]): {
        t1: number;
        t2: number;
    };
    export function LLtangent_PolyPolyC(V: Point[], W: Point[]): {
        t1: number;
        t2: number;
    };
    export function RRtangent_PolyPolyC(V: Point[], W: Point[]): {
        t1: number;
        t2: number;
    };
    export class BiTangent {
        t1: number;
        t2: number;
        constructor(t1: number, t2: number);
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
        id: number;
        polyid: number;
        polyvertid: number;
        p: TVGPoint;
        constructor(id: number, polyid: number, polyvertid: number, p: TVGPoint);
    }
    export class VisibilityEdge {
        source: VisibilityVertex;
        target: VisibilityVertex;
        constructor(source: VisibilityVertex, target: VisibilityVertex);
        length(): number;
    }
    export class TangentVisibilityGraph {
        P: TVGPoint[][];
        V: VisibilityVertex[];
        E: VisibilityEdge[];
        constructor(P: TVGPoint[][], g0?: {
            V: VisibilityVertex[];
            E: VisibilityEdge[];
        });
        addEdgeIfVisible(u: TVGPoint, v: TVGPoint, i1: number, i2: number): void;
        addPoint(p: TVGPoint, i1: number): VisibilityVertex;
        private intersectsPolys(l, i1, i2);
    }
    export function tangents(V: Point[], W: Point[]): BiTangents;
    export function polysOverlap(p: Point[], q: Point[]): boolean;
}
declare module "src/rectangle" {
    import { Constraint, Variable } from "src/vpsc";
    import { Point } from "src/geom";
    export interface Leaf {
        bounds: Rectangle;
        variable: Variable;
    }
    export interface Group {
        bounds: Rectangle;
        padding: number;
        stiffness: number;
        leaves: Leaf[];
        groups: Group[];
        minVar: Variable;
        maxVar: Variable;
    }
    export function computeGroupBounds(g: Group): Rectangle;
    export class Rectangle {
        x: number;
        X: number;
        y: number;
        Y: number;
        constructor(x: number, X: number, y: number, Y: number);
        static empty(): Rectangle;
        cx(): number;
        cy(): number;
        overlapX(r: Rectangle): number;
        overlapY(r: Rectangle): number;
        setXCentre(cx: number): void;
        setYCentre(cy: number): void;
        width(): number;
        height(): number;
        union(r: Rectangle): Rectangle;
        lineIntersections(x1: number, y1: number, x2: number, y2: number): Array<Point>;
        rayIntersection(x2: number, y2: number): Point;
        vertices(): Point[];
        static lineIntersection(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): Point;
        inflate(pad: number): Rectangle;
    }
    export function makeEdgeBetween(source: Rectangle, target: Rectangle, ah: number): {
        sourceIntersection: Point;
        targetIntersection: Point;
        arrowStart: Point;
    };
    export function makeEdgeTo(s: {
        x: number;
        y: number;
    }, target: Rectangle, ah: number): Point;
    export function generateXConstraints(rs: Rectangle[], vars: Variable[]): Constraint[];
    export function generateYConstraints(rs: Rectangle[], vars: Variable[]): Constraint[];
    export function generateXGroupConstraints(root: Group): Constraint[];
    export function generateYGroupConstraints(root: Group): Constraint[];
    export function removeOverlaps(rs: Rectangle[]): void;
    export interface GraphNode extends Leaf {
        fixed: boolean;
        fixedWeight?: number;
        width: number;
        height: number;
        x: number;
        y: number;
        px: number;
        py: number;
    }
    export class IndexedVariable extends Variable {
        index: number;
        constructor(index: number, w: number);
    }
    export class Projection {
        private nodes;
        private groups;
        private rootGroup;
        private avoidOverlaps;
        private xConstraints;
        private yConstraints;
        private variables;
        constructor(nodes: GraphNode[], groups: Group[], rootGroup?: Group, constraints?: any[], avoidOverlaps?: boolean);
        private createSeparation(c);
        private makeFeasible(c);
        private createAlignment(c);
        private createConstraints(constraints);
        private setupVariablesAndBounds(x0, y0, desired, getDesired);
        xProject(x0: number[], y0: number[], x: number[]): void;
        yProject(x0: number[], y0: number[], y: number[]): void;
        projectFunctions(): {
            (x0: number[], y0: number[], r: number[]): void;
        }[];
        private project(x0, y0, start, desired, getDesired, cs, generateConstraints, updateNodeBounds, updateGroupBounds);
        private solve(vs, cs, starting, desired);
    }
}
declare module "src/pqueue" {
    export class PairingHeap<T> {
        elem: T;
        private subheaps;
        constructor(elem: T);
        toString(selector: any): string;
        forEach(f: any): void;
        count(): number;
        min(): T;
        empty(): boolean;
        contains(h: PairingHeap<T>): boolean;
        isHeap(lessThan: (a: T, b: T) => boolean): boolean;
        insert(obj: T, lessThan: any): PairingHeap<T>;
        merge(heap2: PairingHeap<T>, lessThan: any): PairingHeap<T>;
        removeMin(lessThan: (a: T, b: T) => boolean): PairingHeap<T>;
        mergePairs(lessThan: (a: T, b: T) => boolean): PairingHeap<T>;
        decreaseKey(subheap: PairingHeap<T>, newValue: T, setHeapNode: (e: T, h: PairingHeap<T>) => void, lessThan: (a: T, b: T) => boolean): PairingHeap<T>;
    }
    export class PriorityQueue<T> {
        private lessThan;
        private root;
        constructor(lessThan: (a: T, b: T) => boolean);
        top(): T;
        push(...args: T[]): PairingHeap<T>;
        empty(): boolean;
        isHeap(): boolean;
        forEach(f: any): void;
        pop(): T;
        reduceKey(heapNode: PairingHeap<T>, newKey: T, setHeapNode?: (e: T, h: PairingHeap<T>) => void): void;
        toString(selector: any): string;
        count(): number;
    }
}
declare module "src/shortestpaths" {
    export class Calculator<Link> {
        n: number;
        es: Link[];
        private neighbours;
        constructor(n: number, es: Link[], getSourceIndex: (l: Link) => number, getTargetIndex: (l: Link) => number, getLength: (l: Link) => number);
        DistanceMatrix(): number[][];
        DistancesFromNode(start: number): number[];
        PathFromNodeToNode(start: number, end: number): number[];
        PathFromNodeToNodeWithPrevCost(start: number, end: number, prevCost: (u: number, v: number, w: number) => number): number[];
        private dijkstraNeighbours(start, dest?);
    }
}
declare module "src/handledisconnected" {
    export function applyPacking(graphs: Array<any>, w: any, h: any, node_size: any, desired_ratio?: number): void;
    export function separateGraphs(nodes: any, links: any): any[];
}
declare module "src/layout" {
    import { LinkLengthAccessor } from "src/linklengths";
    export enum EventType {
        start = 0,
        tick = 1,
        end = 2,
    }
    export interface Event {
        type: EventType;
        alpha: number;
        stress?: number;
        listener?: () => void;
    }
    export interface Node {
        index?: number;
        x: number;
        y: number;
        width?: number;
        height?: number;
        fixed: number;
    }
    export interface Link<NodeRefType> {
        source: NodeRefType;
        target: NodeRefType;
        length?: number;
        weight?: number;
    }
    export type LinkNumericPropertyAccessor = (t: Link<Node | number>) => number;
    export interface LinkLengthTypeAccessor extends LinkLengthAccessor<Link<Node | number>> {
        getType: LinkNumericPropertyAccessor;
    }
    export class Layout {
        private _canvasSize;
        private _linkDistance;
        private _defaultNodeSize;
        private _linkLengthCalculator;
        private _linkType;
        private _avoidOverlaps;
        private _handleDisconnected;
        private _alpha;
        private _lastStress;
        private _running;
        private _nodes;
        private _groups;
        private _rootGroup;
        private _links;
        private _constraints;
        private _distanceMatrix;
        private _descent;
        private _directedLinkConstraints;
        private _threshold;
        private _visibilityGraph;
        private _groupCompactness;
        protected event: any;
        on(e: EventType | string, listener: (event: Event) => void): Layout;
        protected trigger(e: Event): void;
        protected kick(): void;
        protected tick(): boolean;
        private updateNodePositions();
        nodes(): Array<Node>;
        nodes(v: Array<Node>): Layout;
        private groups();
        private groups(x);
        powerGraphGroups(f: Function): Layout;
        avoidOverlaps(): boolean;
        avoidOverlaps(v: boolean): Layout;
        handleDisconnected(): boolean;
        handleDisconnected(v: boolean): Layout;
        flowLayout(axis: string, minSeparation: number | ((t: any) => number)): Layout;
        links(): Array<Link<Node | number>>;
        links(x: Array<Link<Node | number>>): Layout;
        constraints(): Array<any>;
        constraints(c: Array<any>): Layout;
        distanceMatrix(): Array<Array<number>>;
        distanceMatrix(d: Array<Array<number>>): Layout;
        size(): Array<number>;
        size(x: Array<number>): Layout;
        defaultNodeSize(): number;
        defaultNodeSize(x: number): Layout;
        groupCompactness(): number;
        groupCompactness(x: number): Layout;
        linkDistance(): number;
        linkDistance(): LinkNumericPropertyAccessor;
        linkDistance(x: number): Layout;
        linkDistance(x: LinkNumericPropertyAccessor): Layout;
        linkType(f: Function | number): Layout;
        convergenceThreshold(): number;
        convergenceThreshold(x: number): Layout;
        alpha(): number;
        alpha(x: number): Layout;
        getLinkLength(link: Link<Node | number>): number;
        static setLinkLength(link: Link<Node | number>, length: number): void;
        getLinkType(link: Link<Node | number>): number;
        linkAccessor: LinkLengthTypeAccessor;
        symmetricDiffLinkLengths(idealLength: number, w?: number): Layout;
        jaccardLinkLengths(idealLength: number, w?: number): Layout;
        start(initialUnconstrainedIterations?: number, initialUserConstraintIterations?: number, initialAllConstraintsIterations?: number, gridSnapIterations?: number, keepRunning?: boolean): Layout;
        private initialLayout(iterations, x, y);
        private separateOverlappingComponents(width, height);
        resume(): Layout;
        stop(): Layout;
        prepareEdgeRouting(nodeMargin?: number): void;
        routeEdge(edge: any, draw: any): any[];
        static getSourceIndex(e: Link<Node | number>): number;
        static getTargetIndex(e: Link<Node | number>): number;
        static linkId(e: Link<Node | number>): string;
        static dragStart(d: Node | any): void;
        private static stopNode(v);
        private static storeOffset(d, origin);
        static dragOrigin(d: Node | any): {
            x: number;
            y: number;
        };
        static drag(d: Node | any, position: {
            x: number;
            y: number;
        }): void;
        static dragEnd(d: any): void;
        static mouseOver(d: any): void;
        static mouseOut(d: any): void;
    }
}
declare module "src/adaptor" {
    import { Layout, EventType, Event } from "src/layout";
    export class LayoutAdaptor extends Layout {
        trigger(e: Event): void;
        kick(): void;
        drag(): void;
        on(eventType: EventType | string, listener: () => void): LayoutAdaptor;
        dragstart: (d: any) => void;
        dragStart: (d: any) => void;
        dragend: (d: any) => void;
        dragEnd: (d: any) => void;
        constructor(options: any);
    }
    export function adaptor(options: any): LayoutAdaptor;
}
declare module "src/d3v3adaptor" {
    import { Layout, EventType, Event } from "src/layout";
    export class D3StyleLayoutAdaptor extends Layout {
        event: d3.Dispatch;
        trigger(e: Event): void;
        kick(): void;
        drag: () => any;
        constructor();
        on(eventType: EventType | string, listener: () => void): D3StyleLayoutAdaptor;
    }
    export function d3adaptor(): D3StyleLayoutAdaptor;
}
declare module "src/d3v4adaptor" {
    import { dispatch } from 'd3-dispatch';
    import { timer } from 'd3-timer';
    import { drag as d3drag } from 'd3-drag';
    import { Layout, EventType, Event } from "src/layout";
    export interface D3Context {
        timer: typeof timer;
        drag: typeof d3drag;
        dispatch: typeof dispatch;
        event: any;
    }
    export class D3StyleLayoutAdaptor extends Layout {
        private d3Context;
        event: any;
        trigger(e: Event): void;
        kick(): void;
        drag: () => any;
        constructor(d3Context: D3Context);
        on(eventType: EventType | string, listener: () => void): D3StyleLayoutAdaptor;
    }
}
declare module "src/d3adaptor" {
    import * as d3v3 from "src/d3v3adaptor";
    import * as d3v4 from "src/d3v4adaptor";
    export interface D3v3Context {
        version: string;
    }
    export function d3adaptor(d3Context?: d3v4.D3Context | D3v3Context): d3v4.D3StyleLayoutAdaptor | d3v3.D3StyleLayoutAdaptor;
}
declare module "src/gridrouter" {
    import { Point } from "src/geom";
    import { Rectangle } from "src/rectangle";
    export interface NodeAccessor<Node> {
        getChildren(v: Node): number[];
        getBounds(v: Node): Rectangle;
    }
    export class NodeWrapper {
        id: number;
        rect: Rectangle;
        children: number[];
        leaf: boolean;
        parent: NodeWrapper;
        ports: Vert[];
        constructor(id: number, rect: Rectangle, children: number[]);
    }
    export class Vert {
        id: number;
        x: number;
        y: number;
        node: NodeWrapper;
        line: any;
        constructor(id: number, x: number, y: number, node?: NodeWrapper, line?: any);
    }
    export class LongestCommonSubsequence<T> {
        s: T[];
        t: T[];
        length: number;
        si: number;
        ti: number;
        reversed: boolean;
        constructor(s: T[], t: T[]);
        private static findMatch<T>(s, t);
        getSequence(): T[];
    }
    export interface GridLine {
        nodes: NodeWrapper[];
        pos: number;
    }
    export class GridRouter<Node> {
        originalnodes: Node[];
        groupPadding: number;
        leaves: NodeWrapper[];
        groups: NodeWrapper[];
        nodes: NodeWrapper[];
        cols: GridLine[];
        rows: GridLine[];
        root: any;
        verts: Vert[];
        edges: any;
        backToFront: any;
        obstacles: any;
        passableEdges: any;
        private avg(a);
        private getGridLines(axis);
        private getDepth(v);
        private midPoints(a);
        constructor(originalnodes: Node[], accessor: NodeAccessor<Node>, groupPadding?: number);
        private findLineage(v);
        private findAncestorPathBetween(a, b);
        siblingObstacles(a: any, b: any): any;
        static getSegmentSets(routes: any, x: any, y: any): any[];
        static nudgeSegs(x: string, y: string, routes: any, segments: any, leftOf: any, gap: number): void;
        static nudgeSegments(routes: any, x: string, y: string, leftOf: (e1: number, e2: number) => boolean, gap: number): void;
        routeEdges<Edge>(edges: Edge[], nudgeGap: number, source: (e: Edge) => number, target: (e: Edge) => number): Point[][][];
        static unreverseEdges(routes: any, routePaths: any): void;
        static angleBetween2Lines(line1: Point[], line2: Point[]): number;
        private static isLeft(a, b, c);
        private static getOrder(pairs);
        static orderEdges(edges: any): (l: number, r: number) => boolean;
        static makeSegments(path: Point[]): Point[][];
        route(s: number, t: number): Point[];
        static getRoutePath(route: Point[][], cornerradius: number, arrowwidth: number, arrowheight: number): {
            routepath: string;
            arrowpath: string;
        };
    }
}
declare module "src/layout3d" {
    import { Descent } from "src/descent";
    import { GraphNode, Rectangle } from "src/rectangle";
    import { Variable } from "src/vpsc";
    export class Link3D {
        source: number;
        target: number;
        length: number;
        constructor(source: number, target: number);
        actualLength(x: number[][]): number;
    }
    export class Node3D implements GraphNode {
        x: number;
        y: number;
        z: number;
        fixed: boolean;
        width: number;
        height: number;
        px: number;
        py: number;
        bounds: Rectangle;
        variable: Variable;
        constructor(x?: number, y?: number, z?: number);
    }
    export class Layout3D {
        nodes: Node3D[];
        links: Link3D[];
        idealLinkLength: number;
        static dims: string[];
        static k: number;
        result: number[][];
        constraints: any[];
        constructor(nodes: Node3D[], links: Link3D[], idealLinkLength?: number);
        linkLength(l: Link3D): number;
        useJaccardLinkLengths: boolean;
        descent: Descent;
        start(iterations?: number): Layout3D;
        tick(): number;
    }
}
declare module "src/batch" {
    import { Node, Link, Layout } from "src/layout";
    import { Point } from "src/geom";
    export function gridify(pgLayout: any, nudgeGap: number, margin: number, groupMargin: number): Point[][][];
    export function powerGraphGridLayout(graph: {
        nodes: Node[];
        links: Link<Node>[];
    }, size: number[], grouppadding: number): {
        cola: Layout;
        powerGraph: any;
    };
}
declare module "index" {
    export * from "src/adaptor";
    export * from "src/d3adaptor";
    export * from "src/descent";
    export * from "src/geom";
    export * from "src/gridrouter";
    export * from "src/handledisconnected";
    export * from "src/layout";
    export * from "src/layout3d";
    export * from "src/linklengths";
    export * from "src/powergraph";
    export * from "src/pqueue";
    export * from "src/rbtree";
    export * from "src/rectangle";
    export * from "src/shortestpaths";
    export * from "src/vpsc";
    export * from "src/batch";
}
