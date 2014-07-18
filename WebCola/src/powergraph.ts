module cola.powergraph {
    export interface LinkAccessor<Link> {
        getSourceIndex(l: Link): number;
        getTargetIndex(l: Link): number;

        // return a unique identifier for the type of the link
        getType(l: Link): number;
    }

    export class PowerEdge {
        constructor(
            public source: any,
            public target: any,
            public type: number) { }
    }

    export class Configuration<Link> {
        // canonical list of modules.  
        // Initialized to a module for each leaf node, such that the ids and indexes of the module in the array match the indexes of the nodes in links
        // Modules created through merges are appended to the end of this.
        modules: Module[];
        // top level modules and candidates for merges
        roots: ModuleSet;
        // remaining edge count
        R: number;
        constructor(n: number, edges: Link[], private linkAccessor: LinkAccessor<Link>) {
            this.modules = new Array(n);
            this.roots = new ModuleSet();
            for (var i = 0; i < n; ++i) {
                this.roots.add(this.modules[i] = new Module(i));
            }
            this.R = edges.length;
            edges.forEach(e => {
                var s = this.modules[linkAccessor.getSourceIndex(e)],
                    t = this.modules[linkAccessor.getTargetIndex(e)],
                    type = linkAccessor.getType(e);
                s.outgoing.add(type, t);
                t.incoming.add(type, s);
            });
        }

        // merge modules a and b keeping track of their power edges and removing the from roots
        merge(a: Module, b: Module): Module {
            var inInt = a.incoming.intersection(b.incoming),
                outInt = a.outgoing.intersection(b.outgoing);
            var children = new ModuleSet();
            children.add(a);
            children.add(b);
            var m = new Module(this.modules.length, outInt, inInt, children);
            this.modules.push(m);
            var update = (s: LinkSets, i: string, o: string) => {
                s.forAll((ms, linktype) => {
                    ms.forAll(n => {
                        var nls = <LinkSets>n[i];
                        nls.add(linktype, m);
                        nls.remove(linktype, a);
                        nls.remove(linktype, b);
                        (<LinkSets>a[o]).remove(linktype, n);
                        (<LinkSets>b[o]).remove(linktype, n);
                    });
                });
            };
            update(outInt, "incoming", "outgoing");
            update(inInt, "outgoing", "incoming");
            this.R -= inInt.count() + outInt.count();
            this.roots.remove(a);
            this.roots.remove(b);
            this.roots.add(m);
            return m;
        }

        private rootMerges(): {
            nEdges: number;
            a: Module;
            b: Module;
        }[] {
            var rs = this.roots.modules();
            var n = rs.length;
            var merges = new Array(n * (n - 1));
            var ctr = 0;
            for (var i = 0, i_ = n - 1; i < i_; ++i) {
                for (var j = i+1; j < n; ++j) {
                    var a = rs[i], b = rs[j];
                    merges[ctr++] = { nEdges: this.nEdges(a, b), a: a, b: b };
                }
            }
            return merges;
        }

        greedyMerge(): boolean {
            var ms = this.rootMerges().sort((a, b) => a.nEdges - b.nEdges);
            var m = ms[0];
            if (m.nEdges >= this.R) return false;
            this.merge(m.a, m.b);
            return true;
        }

        private nEdges(a: Module, b: Module): number {
            var inInt = a.incoming.intersection(b.incoming),
                outInt = a.outgoing.intersection(b.outgoing);
            return this.R - inInt.count() - outInt.count();
        }

        getGroupHierarchy(retargetedEdges: PowerEdge[]): any[]{
            var groups = [];
            var root = {};
            toGroups(this.roots, root, groups);
            var es = this.allEdges();
            es.forEach(e => {
                var a = this.modules[e.source];
                var b = this.modules[e.target];
                retargetedEdges.push(new PowerEdge(
                    typeof a.gid === "undefined" ? e.source : groups[a.gid],
                    typeof b.gid === "undefined" ? e.target : groups[b.gid],
                    e.type
                ));
            });
            return groups;
        }

        allEdges(): PowerEdge[] {
            var es = [];
            Configuration.getEdges(this.roots, es);
            return es;
        }

        static getEdges(modules: ModuleSet, es: PowerEdge[]) {
            modules.forAll(m => {
                m.getEdges(es);
                Configuration.getEdges(m.children, es);
            });
        }
    }

    function toGroups(modules, group, groups) {
        modules.forAll(m => {
            if (m.isLeaf()) {
                if (!group.leaves) group.leaves = [];
                group.leaves.push(m.id);
            } else {
                var g = group;
                m.gid = groups.length;
                if (!m.isIsland()) {
                    g = { id: m.gid };
                    if (!group.groups) group.groups = [];
                    group.groups.push(m.gid);
                    groups.push(g);
                }
                toGroups(m.children, g, groups);
            }
        });
    }

    export class Module {
        gid: number;

        constructor(
            public id: number,
            public outgoing: LinkSets = new LinkSets(),
            public incoming: LinkSets = new LinkSets(),
            public children: ModuleSet = new ModuleSet()) { }

        getEdges(es: PowerEdge[]) {
            this.outgoing.forAll((ms, edgetype) => {
                ms.forAll(target => {
                    es.push(new PowerEdge(this.id, target.id, edgetype));
                });
            });
        }

        isLeaf() {
            return this.children.count() === 0;
        }

        isIsland() {
            return this.outgoing.count() === 0 && this.incoming.count() === 0;
        }
    }

    function intersection(m: any, n: any): any {
        var i = {};
        for (var v in m) if (v in n) i[v] = m[v];
        return i;
    }

    export class ModuleSet {
        table: any = {};
        count() {
            return Object.keys(this.table).length;
        }
        intersection(other: ModuleSet): ModuleSet {
            var result = new ModuleSet();
            result.table = intersection(this.table, other.table);
            return result;
        }
        intersectionCount(other: ModuleSet): number {
            return this.intersection(other).count();
        }
        contains(id: number): boolean {
            return id in this.table;
        } 
        add(m: Module): void {
            this.table[m.id] = m;
        }
        remove(m: Module): void {
            delete this.table[m.id];
        }
        forAll(f: (m: Module) => void) {
            for (var mid in this.table) {
                f(this.table[mid]);
            }
        }
        modules(): Module[] {
            var vs = [];
            this.forAll(m => vs.push(m));
            return vs;
        }
    }

    export class LinkSets {
        sets: any = {};
        n: number = 0;
        count(): number {
            return this.n;
        }
        contains(id: number) {
            var result = false;
            this.forAllModules(m => {
                if (!result && m.id == id) {
                    result = true;
                }
            });
            return result;
        }
        add(linktype: number, m: Module) {
            var s: ModuleSet = linktype in this.sets ? this.sets[linktype] : this.sets[linktype] = new ModuleSet();
            s.add(m);
            ++this.n;
        }
        remove(linktype: number, m: Module) {
            var ms = <ModuleSet>this.sets[linktype];
            ms.remove(m);
            if (ms.count() === 0) {
                delete this.sets[linktype];
            }
            --this.n;
        }
        forAll(f: (ms: ModuleSet, linktype: number) => void) {
            for (var linktype in this.sets) {
                f(<ModuleSet>this.sets[linktype], linktype);
            }
        }
        forAllModules(f: (m: Module) => void) {
            this.forAll((ms, lt) => ms.forAll(f));
        }
        intersection(other: LinkSets): LinkSets {
            var result: LinkSets = new LinkSets();
            this.forAll((ms, lt) => {
                if (lt in other.sets) {
                    var i = ms.intersection(other.sets[lt]),
                        n = i.count();
                    if (n > 0) {
                        result.sets[lt] = i;
                        result.n += n;
                    }
                }
            });
            return result;
        }
    }

    function intersectionCount(m: any, n: any): number {
        return Object.keys(intersection(m, n)).length
    }

    export function getGroups<Link>(nodes: any[], links: Link[], la: LinkAccessor<Link>): { groups: any[]; powerEdges: PowerEdge[] } {
        var n = nodes.length,
            c = new powergraph.Configuration(n, links, la);
        while (c.greedyMerge());
        var powerEdges: PowerEdge[] = [];
        var g = c.getGroupHierarchy(powerEdges);
        powerEdges.forEach(function (e) {
            var f = (end) => {
                var g = e[end];
                if (typeof g == "number") e[end] = nodes[g];
            }
            f("source");
            f("target");
        });
        return { groups: g, powerEdges: powerEdges };
    } 
}