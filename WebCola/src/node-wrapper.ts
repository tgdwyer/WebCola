export class NodeWrapper {
	leaf: boolean;
	parent: NodeWrapper;
	ports: Vert[];
	constructor(public id: number, public rect: vpsc.Rectangle, public children: number[]) {
		this.leaf = typeof children === 'undefined' || children.length === 0;
	}
}