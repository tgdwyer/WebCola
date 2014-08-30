/// <reference path="rectangle.ts"/>
/// <reference path="shortestpaths.ts"/>
module cola {
	export interface NodeAccessor<Node>{
		getChildren(v:Node) : number[];
		getBounds(v:Node) : cola.vpsc.Rectangle;
	}
	export class NodeWrapper {
		leaf: boolean;
		parent: NodeWrapper;
		ports: Vert[];
		constructor(public id: number, public rect: cola.vpsc.Rectangle, public children: number[]) {
			this.leaf = typeof children === 'undefined' || children.length === 0;
		}
	}
	export class Vert {
		constructor(public id: number, public x:number, public y: number, public node: NodeWrapper = null, public line = null) {}
	}
	export class GridRouter<Node> {
		groupPadding = 12;
		leaves:any[] = null;
		groups: NodeWrapper[];
		nodes: NodeWrapper[];
		cols;
		rows;
		root;
		verts: Vert[];
		edges;
		backToFront;
		obstacles;
		passableEdges;
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

		constructor(public originalnodes: Node[], accessor: NodeAccessor<Node>) {
			this.nodes = originalnodes.map((v,i)=> new NodeWrapper(i, accessor.getBounds(v), accessor.getChildren(v)));
	        this.leaves = this.nodes.filter(v=>v.leaf);
	        this.groups = this.nodes.filter(g=>!g.leaf);
	        this.cols = this.getGridDim('x');
	        this.rows = this.getGridDim('y');

	        // create parents for each node or group that is a member of another's children 
	        this.groups.forEach(v=>
	            v.children.forEach(c=> this.nodes[<number>c].parent = v));

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
	        var frontToBackGroups = this.backToFront.slice(0).reverse().filter(g=>!g.leaf);
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
	                var p = new Vert(this.verts.length, v.x1, h.y1);
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
	                v.rect.lineIntersections(l.x1,l.y1,l.x2,l.y2).forEach(intersect=>{
	                	var p = new Vert(this.verts.length, intersect.x, intersect.y, v, l);
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
	                if (u.node && u.node === v.node && u.node.leaf) continue;
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

	    // find a route between node s and node t
	    // returns an array of indices to verts
	    route(s: number, t: number):any[] {
	    	var source = this.nodes[<number>s], target = this.nodes[<number>t];
	    	this.obstacles = this.siblingObstacles(source, target);

	        var obstacleLookup = {};
	        this.obstacles.forEach(o => obstacleLookup[o.id] = o);
	        this.passableEdges = this.edges.filter(e=> {
	            var u = this.verts[e.source],
	                v = this.verts[e.target];
	            return !(u.node && u.node.id in obstacleLookup 
	                     || v.node && v.node.id in obstacleLookup);
	        });

	        for(var i = 1; i < source.ports.length; i++) {
	            var u = source.ports[0].id;
	            var v = source.ports[i].id;
	            this.passableEdges.push({
	                source: u,
	                target: v,
	                length: 0
	            });
	        }
	        for(var i = 1; i < target.ports.length; i++) {
	            var u = target.ports[0].id;
	            var v = target.ports[i].id;
	            this.passableEdges.push({
	                source: u,
	                target: v,
	                length: 0
	            });
	        }

	        var getSource = e=>e.source,
	            getTarget = e=>e.target,
	            getLength = e=>e.length;

	        var shortestPathCalculator = new cola.shortestpaths.Calculator(this.verts.length, this.passableEdges, getSource, getTarget, getLength);
	        var bendPenalty = (u,v,w)=> {
        		var a = this.verts[u], b = this.verts[v], c = this.verts[w];
        		var dx = Math.abs(c.x - a.x), dy = Math.abs(c.y - a.y);
        		// don't count bends from internal node edges
        		if (a.node === source && a.node === b.node || b.node === target && b.node === c.node) 
        			return 0;
        		return dx > 1 && dy > 1  ? 1000 : 0;
        	};
	        var shortestPath = shortestPathCalculator.PathFromNodeToNodeWithPrevCost(
	        	source.ports[0].id, target.ports[0].id,
				bendPenalty);
	        var pathSegments: Vert[][] = [];
            for (var i = 0; i < shortestPath.length; i++) {
                var a:Vert = i === 0 ? this.nodes[target.id].ports[0] : this.verts[shortestPath[i - 1]];
                var b:Vert = this.verts[shortestPath[i]];
                if (a.node === source && b.node === source) continue;
                if (a.node === target && b.node === target) continue;
                pathSegments.push([a,b]);
            }
            // - |_ --
            var mergedSegments = [];
        	var a = pathSegments[0][0];
            for (var i = 0; i < pathSegments.length; i++) {
            	var b = pathSegments[i][1],
            		c = i < pathSegments.length - 1 ? pathSegments[i+1][1] : null;
            	if (!c || c && bendPenalty(a.id,b.id,c.id)>0) {
	            	mergedSegments.push([a,b]);
	            	a = b;
            	}
            }
            var result = mergedSegments.map(s=>[{x:s[1].x,y:s[1].y},{x:s[0].x,y:s[0].y}]);
            result.reverse();
            return result;
	    }
	}
}