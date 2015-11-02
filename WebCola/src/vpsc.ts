module cola.vpsc {
    export class PositionStats {
        AB: number = 0;
        AD: number = 0;
        A2: number = 0;

        constructor(public scale: number) {}

        addVariable(v: Variable): void {
            var ai = this.scale / v.scale;
            var bi = v.offset / v.scale;
            var wi = v.weight;
            this.AB += wi * ai * bi;
            this.AD += wi * ai * v.desiredPosition;
            this.A2 += wi * ai * ai;
        }

        getPosn(): number {
            return (this.AD - this.AB) / this.A2;
        }
    }

    export class Constraint {
        lm: number;
        active: boolean = false;
        unsatisfiable: boolean = false;

        constructor(public left: Variable, public right: Variable, public gap: number, public equality: boolean = false) {
            this.left = left;
            this.right = right;
            this.gap = gap;
            this.equality = equality;
        }

        slack(): number {
            return this.unsatisfiable ? Number.MAX_VALUE
                : this.right.scale * this.right.position() - this.gap
                - this.left.scale * this.left.position();
        }
    }

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

    export class Block {
        vars: Variable[] = [];
        posn: number;
        ps: PositionStats;
        blockInd: number;

        constructor(v: Variable) {
            v.offset = 0;
            this.ps = new PositionStats(v.scale);
            this.addVariable(v);
        }

        private addVariable(v: Variable): void {
            v.block = this;
            this.vars.push(v);
            this.ps.addVariable(v);
            this.posn = this.ps.getPosn();
        }

        // move the block where it needs to be to minimize cost
        updateWeightedPosition(): void {
            this.ps.AB = this.ps.AD = this.ps.A2 = 0;
            for (var i = 0, n = this.vars.length; i < n; ++i)
                this.ps.addVariable(this.vars[i]);
            this.posn = this.ps.getPosn();
        }

        private compute_lm(v: Variable, u: Variable, postAction: (c: Constraint)=>void): number {
            var dfdv = v.dfdv();
            v.visitNeighbours(u, (c, next) => {
                var _dfdv = this.compute_lm(next, v, postAction);
                if (next === c.right) {
                    dfdv += _dfdv * c.left.scale;
                    c.lm = _dfdv;
                } else {
                    dfdv += _dfdv * c.right.scale;
                    c.lm = -_dfdv;
                }
                postAction(c);
            });
            return dfdv / v.scale;
        }
        
        private populateSplitBlock(v: Variable, prev: Variable): void {
            v.visitNeighbours(prev, (c, next) => {
                next.offset = v.offset + (next === c.right ? c.gap : -c.gap);
                this.addVariable(next);
                this.populateSplitBlock(next, v);
            });
        }

        // traverse the active constraint tree applying visit to each active constraint
        traverse(visit: (c: Constraint) => any, acc: any[], v: Variable = this.vars[0], prev: Variable=null) {
            v.visitNeighbours(prev, (c, next) => {
                acc.push(visit(c));
                this.traverse(visit, acc, next, v);
            });
        }

        // calculate lagrangian multipliers on constraints and
        // find the active constraint in this block with the smallest lagrangian.
        // if the lagrangian is negative, then the constraint is a split candidate.  
        findMinLM(): Constraint {
            var m: Constraint = null;
            this.compute_lm(this.vars[0], null, c=> {
                if (!c.equality && (m === null || c.lm < m.lm)) m = c;
            });
            return m;
        }

        private findMinLMBetween(lv: Variable, rv: Variable): Constraint {
            this.compute_lm(lv, null, () => {});
            var m = null;
            this.findPath(lv, null, rv, (c, next)=> {
                if (!c.equality && c.right === next && (m === null || c.lm < m.lm)) m = c;
            });
            return m;
        }

        private findPath(v: Variable, prev: Variable, to: Variable, visit: (c: Constraint, next:Variable)=>void): boolean {
            var endFound = false;
            v.visitNeighbours(prev, (c, next) => {
                if (!endFound && (next === to || this.findPath(next, v, to, visit)))
                {
                    endFound = true;
                    visit(c, next);
                }
            });
            return endFound;
        }
        
        // Search active constraint tree from u to see if there is a directed path to v.
        // Returns true if path is found.
        isActiveDirectedPathBetween(u: Variable, v: Variable) : boolean {
            if (u === v) return true;
            var i = u.cOut.length;
            while(i--) {
                var c = u.cOut[i];
                if (c.active && this.isActiveDirectedPathBetween(c.right, v))
                    return true;
            }
            return false;
        }

        // split the block into two by deactivating the specified constraint
        static split(c: Constraint): Block[]{
/* DEBUG
            console.log("split on " + c);
            console.assert(c.active, "attempt to split on inactive constraint");
DEBUG */
            c.active = false;
            return [Block.createSplitBlock(c.left), Block.createSplitBlock(c.right)];
        }

        private static createSplitBlock(startVar: Variable): Block {
            var b = new Block(startVar);
            b.populateSplitBlock(startVar, null);
            return b;
        }

        // find a split point somewhere between the specified variables
        splitBetween(vl: Variable, vr: Variable): { constraint: Constraint; lb: Block; rb: Block } {
/* DEBUG
            console.assert(vl.block === this);
            console.assert(vr.block === this);
DEBUG */
            var c = this.findMinLMBetween(vl, vr);
            if (c !== null) {
                var bs = Block.split(c);
                return { constraint: c, lb: bs[0], rb: bs[1] };
            }
            // couldn't find a split point - for example the active path is all equality constraints
            return null;
        }

        mergeAcross(b: Block, c: Constraint, dist: number): void {
            c.active = true;
            for (var i = 0, n = b.vars.length; i < n; ++i) {
                var v = b.vars[i];
                v.offset += dist;
                this.addVariable(v);
            }
            this.posn = this.ps.getPosn();
        }

        cost(): number {
            var sum = 0, i = this.vars.length;
            while (i--) {
                var v = this.vars[i],
                    d = v.position() - v.desiredPosition;
                sum += d * d * v.weight;
            }
            return sum;
        }

/* DEBUG
        toString(): string {
            var cs = [];
            this.traverse(c=> c.toString() + "\n", cs)
            return "b"+this.blockInd + "@" + this.posn + ": vars=" + this.vars.map(v=> v.toString()+":"+v.offset) + ";\n cons=\n" + cs;
        }
DEBUG */
    }

    export class Blocks {
        private list: Block[];

        constructor(public vs: Variable[]) {
            var n = vs.length;
            this.list = new Array(n);
            while (n--) {
                var b = new Block(vs[n]);
                this.list[n] = b;
                b.blockInd = n;
            }
        }

        cost(): number {
            var sum = 0, i = this.list.length;
            while (i--) sum += this.list[i].cost();
            return sum;
        }

        insert(b: Block) {
/* DEBUG
            console.assert(!this.contains(b), "blocks error: tried to reinsert block " + b.blockInd)
DEBUG */
            b.blockInd = this.list.length;
            this.list.push(b);
/* DEBUG
            console.log("insert block: " + b.blockInd);
            this.contains(b);
DEBUG */
        }

        remove(b: Block) {
/* DEBUG
            console.log("remove block: " + b.blockInd);
            console.assert(this.contains(b));
DEBUG */
            var last = this.list.length - 1;
            var swapBlock = this.list[last];
            this.list.length = last;
            if (b !== swapBlock) {
                this.list[b.blockInd] = swapBlock;
                swapBlock.blockInd = b.blockInd;
/* DEBUG
                console.assert(this.contains(swapBlock));
DEBUG */
            }
        }

        // merge the blocks on either side of the specified constraint, by copying the smaller block into the larger
        // and deleting the smaller.
        merge(c: Constraint): void {
            var l = c.left.block, r = c.right.block;
/* DEBUG
            console.assert(l!==r, "attempt to merge within the same block");
DEBUG */
            var dist = c.right.offset - c.left.offset - c.gap;
            if (l.vars.length < r.vars.length) {
                r.mergeAcross(l, c, dist);
                this.remove(l);
            } else {
                l.mergeAcross(r, c, -dist);
                this.remove(r);
            }
/* DEBUG
            console.assert(Math.abs(c.slack()) < 1e-6, "Error: Constraint should be at equality after merge!");
            console.log("merged on " + c);
DEBUG */
        }

        forEach(f: (b: Block, i: number) => void ) {
            this.list.forEach(f);
        }
        
        // useful, for example, after variable desired positions change.
        updateBlockPositions(): void {
            this.list.forEach(b=> b.updateWeightedPosition());
        }

        // split each block across its constraint with the minimum lagrangian 
        split(inactive: Constraint[]): void {
            this.updateBlockPositions();
            this.list.forEach(b=> {
                var v = b.findMinLM();
                if (v !== null && v.lm < Solver.LAGRANGIAN_TOLERANCE) {
                    b = v.left.block;
                    Block.split(v).forEach(nb=>this.insert(nb));
                    this.remove(b);
                    inactive.push(v);
/* DEBUG
                    console.assert(this.contains(v.left.block));
                    console.assert(this.contains(v.right.block));
DEBUG */
                }
            });
        }
        
/* DEBUG
        // checks b is in the block, and does a sanity check over list index integrity
        contains(b: Block): boolean {
            var result = false;
            this.list.forEach((bb, i) => {
                if (bb.blockInd !== i) {
                    console.error("blocks error, blockInd " + b.blockInd + " found at " + i);
                    return false;
                }
                result = result || b === bb;
            });
            return result;
        }

        toString(): string {
            return this.list.toString();
        }
DEBUG */
    }

    export class Solver {
        bs: Blocks;
        inactive: Constraint[];

        static LAGRANGIAN_TOLERANCE = -1e-4;
        static ZERO_UPPERBOUND = -1e-10;

        constructor(public vs: Variable[], public cs: Constraint[]) {
            this.vs = vs;
            vs.forEach(v => {
                v.cIn = [], v.cOut = [];
/* DEBUG
                v.toString = () => "v" + vs.indexOf(v);
DEBUG */
            });
            this.cs = cs;
            cs.forEach(c => {
                c.left.cOut.push(c);
                c.right.cIn.push(c);
/* DEBUG
                c.toString = () => c.left + "+" + c.gap + "<=" + c.right + " slack=" + c.slack() + " active=" + c.active;
DEBUG */
            });
            this.inactive = cs.map(c=> { c.active = false; return c; });
            this.bs = null;
        }

        cost(): number {
            return this.bs.cost();
        }

        // set starting positions without changing desired positions.
        // Note: it throws away any previous block structure.
        setStartingPositions(ps: number[]): void {
            this.inactive = this.cs.map(c=> { c.active = false; return c; });
            this.bs = new Blocks(this.vs);
            this.bs.forEach((b, i) => b.posn = ps[i]);
        }

        setDesiredPositions(ps: number[]): void {
            this.vs.forEach((v, i) => v.desiredPosition = ps[i]);
        }

/* DEBUG
        private getId(v: Variable): number {
            return this.vs.indexOf(v);
        }

        // sanity check of the index integrity of the inactive list
        checkInactive(): void {
            var inactiveCount = 0;
            this.cs.forEach(c=> {
                var i = this.inactive.indexOf(c);
                console.assert(!c.active && i >= 0 || c.active && i < 0, "constraint should be in the inactive list if it is not active: " + c);
                if (i >= 0) {
                    inactiveCount++;
                } else {
                    console.assert(c.active, "inactive constraint not found in inactive list: " + c);
                }
            });
            console.assert(inactiveCount === this.inactive.length, inactiveCount + " inactive constraints found, " + this.inactive.length + "in inactive list");
        }
        // after every call to satisfy the following should check should pass
        checkSatisfied(): void {
            this.cs.forEach(c=>console.assert(c.slack() >= vpsc.Solver.ZERO_UPPERBOUND, "Error: Unsatisfied constraint! "+c));
        }
DEBUG */

        private mostViolated(): Constraint {
            var minSlack = Number.MAX_VALUE,
                v: Constraint = null,
                l = this.inactive,
                n = l.length,
                deletePoint = n;
            for (var i = 0; i < n; ++i) {
                var c = l[i];
                if (c.unsatisfiable) continue;
                var slack = c.slack();
                if (c.equality || slack < minSlack) {
                    minSlack = slack;
                    v = c;
                    deletePoint = i;
                    if (c.equality) break;
                }
            }
            if (deletePoint !== n &&
                (minSlack < Solver.ZERO_UPPERBOUND && !v.active || v.equality))
            {
                l[deletePoint] = l[n - 1];
                l.length = n - 1;
            }
            return v;
        }

        // satisfy constraints by building block structure over violated constraints
        // and moving the blocks to their desired positions
        satisfy(): void {
            if (this.bs == null) {
                this.bs = new Blocks(this.vs);
            }
/* DEBUG
            console.log("satisfy: " + this.bs);
DEBUG */
            this.bs.split(this.inactive);
            var v: Constraint = null;
            while ((v = this.mostViolated()) && (v.equality || v.slack() < Solver.ZERO_UPPERBOUND && !v.active)) {
                var lb = v.left.block, rb = v.right.block;
/* DEBUG
                console.log("most violated is: " + v);
                this.bs.contains(lb);
                this.bs.contains(rb);
DEBUG */
                if (lb !== rb) {
                    this.bs.merge(v);
                } else {
                    if (lb.isActiveDirectedPathBetween(v.right, v.left)) {
                        // cycle found!
                        v.unsatisfiable = true;
                        continue;
                    }
                    // constraint is within block, need to split first
                    var split = lb.splitBetween(v.left, v.right);
                    if (split !== null) {
                        this.bs.insert(split.lb);
                        this.bs.insert(split.rb);
                        this.bs.remove(lb);
                        this.inactive.push(split.constraint);
                    } else {
/* DEBUG
                        console.log("unsatisfiable constraint found");
DEBUG */
                        v.unsatisfiable = true;
                        continue;
                    }
                    if (v.slack() >= 0) {
/* DEBUG
                        console.log("violated constraint indirectly satisfied: " + v);
DEBUG */
                        // v was satisfied by the above split!
                        this.inactive.push(v);
                    } else {
/* DEBUG
                        console.log("merge after split:");
DEBUG */
                        this.bs.merge(v);
                    }
                }
/* DEBUG
                this.bs.contains(v.left.block);
                this.bs.contains(v.right.block);
                this.checkInactive();
DEBUG */
            }
/* DEBUG
            this.checkSatisfied();
DEBUG */
        }

        // repeatedly build and split block structure until we converge to an optimal solution
        solve(): number {
            this.satisfy();
            var lastcost = Number.MAX_VALUE, cost = this.bs.cost();
            while (Math.abs(lastcost - cost) > 0.0001) {
                this.satisfy();
                lastcost = cost;
                cost = this.bs.cost();
            }
            return cost;
        }
    }
}   