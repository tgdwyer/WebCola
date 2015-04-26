export interface NodeAccessor<Node>{
	getChildren(v:Node) : number[];
	getBounds(v:Node) : vpsc.Rectangle;
}