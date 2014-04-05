module powergraph {
    export interface Edge {
        source: number;
        target: number;
    }

    export class Configuration {
        modules: Module[];
        roots: any;
        R: number;
        constructor(n: number, edges: Edge[]) {
            this.modules = new Array(n);
            this.roots = new Array(n);
            for (var i = 0; i < n; ++i) {
                this.roots[i] = this.modules[i] = new Module(i, {}, {}, {});
            }
            this.R = edges.length;
            edges.forEach(e => {
                var s = this.modules[e.source],
                    t = this.modules[e.target];
                s.outgoing[t.id] = t;
                t.incoming[s.id] = s;
            });
        }

        merge(a: Module, b: Module): Module {
            var inInt = intersection(a.incoming, b.incoming),
                outInt = intersection(a.outgoing, b.outgoing);
            var children = {};
            children[a.id] = a;
            children[b.id] = b;
            var m = new Module(this.modules.length, outInt, inInt, children);
            this.modules.push(m);
            var update = (s, i, o) => {
                for (var v in s) {
                    var n = <Module>s[v];
                    n[i][m.id] = m;
                    delete n[i][a.id];
                    delete n[i][b.id];
                    delete a[o][v];
                    delete b[o][v];
                }
            };
            update(outInt, "incoming", "outgoing");
            update(inInt, "outgoing", "incoming");
            this.R -= Object.keys(inInt).length + Object.keys(outInt).length;
            delete this.roots[a.id];
            delete this.roots[b.id];
            this.roots[m.id] = m;
            return m;
        }

        private rootMerges(): {
            nEdges: number;
            a: Module;
            b: Module;
        }[] {
            var rs = Object.keys(this.roots);
            var n = rs.length;
            var merges = new Array(n * (n - 1));
            var ctr = 0;
            for (var i = 0, i_ = n - 1; i < i_; ++i) {
                for (var j = i+1; j < n; ++j) {
                    var a = <Module>this.roots[rs[i]], b = <Module>this.roots[rs[j]];
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
            return this.R - intersectionCount(a.outgoing, b.outgoing) - intersectionCount(a.incoming, b.incoming);
        }

        getGroupHierarchy(retargetedEdges: Edge[]): any[]{
            var groups = [];
            var root = {};
            toGroups(this.roots, root, groups);
            var es = this.allEdges();
            es.forEach(e => {
                var a = this.modules[e.source];
                var b = this.modules[e.target];
                retargetedEdges.push({
                    source: e.source = typeof a.gid === "undefined" ? e.source : groups[a.gid],
                    target: e.target = typeof b.gid === "undefined" ? e.target : groups[b.gid]
                });
            });
            return groups;
        }

        allEdges(): Edge[]{
            var es = [];
            getEdges(this.roots, es);
            return es;
        }
    }

    function getEdges(modules, es) {
        for (var i in modules) {
            var m = modules[i];
            m.getEdges(es);
            getEdges(m.children, es);
        }
    }

    function toGroups(modules, group, groups) {
        for (var i in modules) {
            var m = modules[i];
            if (m.isLeaf()) {
                if (!group.leaves) group.leaves = [];
                group.leaves.push(m.id);
            } else {
                var g = group;
                m.gid = groups.length;
                if (!m.isIsland()) {
                    g = {id: m.gid};
                    if (!group.groups) group.groups = [];
                    group.groups.push(m.gid);
                    groups.push(g);
                }
                toGroups(m.children, g, groups);
            }
        }
    }

    export class Module {
        gid: number;

        constructor(
            public id: number,
            public outgoing: any,
            public incoming: any,
            public children: any) { }

        getEdges(es: Edge[]) {
            for (var o in this.outgoing) {
                es.push({ source: this.id, target: this.outgoing[o].id });
            }
        }

        isLeaf() {
            return Object.keys(this.children).length == 0;
        }

        isIsland() {
            return Object.keys(this.outgoing).length == 0 && Object.keys(this.incoming).length == 0;
        }
    }

    function intersection(m: any, n: any): any {
        var i = {};
        for (var v in m) if (v in n) i[v] = m[v];
        return i;
    }

    function intersectionCount(m: any, n: any): number {
        return Object.keys(intersection(m, n)).length
    }

    export function getGroups(n: number, links: Edge[]): { groups: any[]; powerEdges: Edge[] } {
        var c = new powergraph.Configuration(n, links);
        while (c.greedyMerge());
        var powerEdges = [];
        return { groups: c.getGroupHierarchy(powerEdges), powerEdges: powerEdges };
    } 
}