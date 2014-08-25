/// <reference path="rectangle.ts"/>
class GridRouter {
	groupPadding = 5;
	leaves:any[] = null;
	groups;
	cols;
	rows;
	root;
	nodes;
	verts;
	edges;
	backToFront;
    private isLeaf(v) { return typeof v.children === 'undefined' }
    private isGroup(v) { return !this.isLeaf(v) }
    private avg(a) { return a.reduce((x,y)=>x+y)/a.length }
    private getGridDim(axis) {
        var columns = [];
        var ls = this.leaves.slice(0,this.leaves.length);
        while(ls.length > 0) {
            var r = ls[0].rect;
            var col = ls.filter(v=>v.rect['overlap'+axis.toUpperCase()](r));
            columns.push(col);
            col.forEach(v=> ls.splice(ls.indexOf(v),1));
            col[axis] = this.avg(col.map(v=> v.rect['c'+axis]()))
        }
        columns.sort((x,y)=> x[axis] - y[axis])
        return columns;
    }

    // get the depth of the given node in the group hierarchy
    private getDepth(v) {
        var depth = 0;
        while (v.parent !== this.root) {
            depth++;
            v = v.parent;
        }
        return depth;
    }

    // medial axes between node centres and also boundary lines for the grid
    private midPoints(a) {
        var gap = a[1] - a[0];
        var mids = [a[0]-gap/2];
        for(var i = 1; i < a.length; i++) {
            mids.push((a[i]+a[i-1])/2);
        }
        mids.push(a[a.length-1] + gap/2);
        return mids;
    }

	constructor(graph) {
		this.nodes = graph.nodes;
        this.leaves = this.nodes.filter(this.isLeaf);
        this.leaves.forEach(v => v.rect = new cola.vpsc.Rectangle(v.bounds.x, v.bounds.X, v.bounds.y, v.bounds.Y));
        this.groups = this.nodes.filter(g=>this.isGroup(g));
        this.cols = this.getGridDim('x');
        this.rows = this.getGridDim('y');

        // create parents for each node or group that is a member of another's children 
        this.groups.forEach(v=>
            v.children.forEach(c=> this.nodes[c].parent = v));

        // root claims the remaining orphans
        this.root = {children:[]};
        this.nodes.forEach(v=> {
            if (typeof v.parent === 'undefined') {
                v.parent = this.root;
                this.root.children.push(v.id);
            }

            // each node will have grid vertices associated with it,
            // some inside the node and some on the boundary
            // leaf nodes will have exactly one internal node at the center
            // and four boundary nodes
            // groups will have potentially many of each
            v.ports = []
        });

        // nodes ordered by their position in the group hierarchy
        this.backToFront = this.nodes.slice(0);
        this.backToFront.sort((x,y)=> this.getDepth(x) - this.getDepth(y)); 

        // compute boundary rectangles for each group
        // has to be done from front to back, i.e. inside groups to outside groups
        // such that each can be made large enough to enclose its interior
        var frontToBackGroups = this.backToFront.slice(0).reverse().filter(g=>this.isGroup(g));
        frontToBackGroups.forEach(v=> {
            var r = cola.vpsc.Rectangle.empty();
            v.children.forEach(c=> r = r.union(this.nodes[c].rect));
            v.rect = r.inflate(this.groupPadding);
        });

        var colMids = this.midPoints(this.cols.map(r=> r.x));
        var rowMids = this.midPoints(this.rows.map(r=> r.y));

        // setup extents of lines
        var rowx = colMids[0], rowX = colMids[colMids.length-1];
        var coly = rowMids[0], colY = rowMids[rowMids.length-1];

        // horizontal lines
        var hlines = this.rows.map(r=> <any>{x1: rowx, x2: rowX, y1: r.y, y2: r.y})
                         .concat(rowMids.map(m=> <any>{x1: rowx, x2: rowX, y1: m, y2: m}));

        // vertical lines
        var vlines = this.cols.map(c=> <any>{x1: c.x, x2: c.x, y1: coly, y2: colY})
        				 .concat(colMids.map(m=> <any>{x1: m, x2: m, y1: coly, y2: colY}));

        // the full set of lines
        var lines = hlines.concat(vlines);

        // we record the vertices associated with each line
        lines.forEach(l=>l.verts = []);

        // the routing graph
        this.verts = [];
        this.edges = [];

        // create vertices at the crossings of horizontal and vertical grid-lines
        hlines.forEach(h=> 
            vlines.forEach(v=> {
                var p = {id: this.verts.length, x: v.x1, y: h.y1};
                h.verts.push(p);
                v.verts.push(p);
                this.verts.push(p);

                // assign vertices to the nodes immediately under them
                var i = this.backToFront.length;
                while (i-- > 0) {
                    var node = this.backToFront[i],
                        r = node.rect;
                    var dx = Math.abs(p.x - r.cx()),
                        dy = Math.abs(p.y - r.cy());
                    if (dx < r.width()/2 && dy < r.height()/2) {
                        (<any>p).node = node;
                        break;
                    }
                }
            })
        );

        lines.forEach(l=> {
            // create vertices at the intersections of nodes and lines
            this.nodes.forEach(v=> {
                v.rect.lineIntersections(l.x1,l.y1,l.x2,l.y2).forEach(p=>{
                    p.line = l;
                    p.node = v;
                    p.id = this.verts.length;
                    this.verts.push(p);
                    l.verts.push(p);
                    v.ports.push(p);
                });
            });

            // split lines into edges joining vertices
            var isHoriz = Math.abs(l.y1 - l.y2) < 0.1;
            var delta = (a,b)=> isHoriz ? b.x - a.x : b.y - a.y;
            l.verts.sort(delta);
            for (var i = 1; i < l.verts.length; i++) {
                var u = l.verts[i-1], v = l.verts[i];
                if (u.node && u.node === v.node && this.isLeaf(u.node)) continue;
                this.edges.push({source: u.id, target: v.id, length: Math.abs(delta(u,v))});
            }
        });



	}

    // find path from v to root including both v and root
    private findLineage(v) {
        var lineage = [v];
        do {
            v = v.parent; 
            lineage.push(v);
        } while (v!==this.root);
        return lineage.reverse();
    }

    // find path connecting a and b through their lowest common ancestor
    private findAncestorPathBetween(a,b) {
        var aa = this.findLineage(a), ba = this.findLineage(b), i = 0;
        while (aa[i] === ba[i]) i++;
        // i-1 to include common ancestor only once (as first element)
        return {commonAncestor: aa[i-1], lineages: aa.slice(i).concat(ba.slice(i))};
    }

    // when finding a path between two nodes a and b, siblings of a and b on the
    // paths from a and b to their least common ancestor are obstacles
    siblingObstacles(a,b) {
        var path = this.findAncestorPathBetween(a,b);
        var lineageLookup = {};
        path.lineages.forEach(v=> lineageLookup[v.id] = {} );
        var obstacles = path.commonAncestor.children.filter(v=> !(v in lineageLookup));

        path.lineages
        	.filter(v=> v.parent !== path.commonAncestor)
        	.forEach(v=> obstacles = obstacles.concat(v.parent.children.filter(c=> c !== v.id)));

        return obstacles.map(v=> this.nodes[v]);
    }
}