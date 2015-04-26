export class Variable {
    offset: number = 0;
    block: Block;
    cIn: Constraint[];
    cOut: Constraint[];

    constructor(public desiredPosition: number, public weight: number = 1, public scale: number = 1) {}

    dfdv(): number {
        return 2.0 * this.weight * (this.position() - this.desiredPosition);
    }

    position(): number {
        return (this.block.ps.scale * this.block.posn + this.offset) / this.scale;
    }

    // visit neighbours by active constraints within the same block
    visitNeighbours(prev: Variable, f: (c: Constraint, next: Variable) => void ): void {
        var ff = (c, next) => c.active && prev !== next && f(c, next);
        this.cOut.forEach(c=> ff(c, c.right));
        this.cIn.forEach(c=> ff(c, c.left));
    }
}