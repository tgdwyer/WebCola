
class PairingHeap<T> {
    private subheaps : PairingHeap<T>[];
    // from: https://gist.github.com/nervoussystem
    //{elem:object, subheaps:[array of heaps]}
    constructor(public elem: T) {
        this.subheaps = [];
    }

    public toString(selector) : string {
        var str = "", needComma = false;
        for (var i = 0; i < this.subheaps.length; ++i) {
            var subheap: PairingHeap<T> = this.subheaps[i];
            if (!subheap.elem) {
                needComma = false;
                continue;
            }
            if (needComma) {
                str = str + ",";
            }
            str = str + subheap.toString(selector);
            needComma = true;
        }
        if (str !== "") {
            str = "(" + str + ")";
        }
        return (this.elem ? selector(this.elem) : "") + str;
    }

    public forEach(f) {
        if (!this.empty()) {
            f(this.elem, this);
            this.subheaps.forEach(s => s.forEach(f));
        }
    }

    public count(): number {
        return this.empty() ? 0 : 1 + this.subheaps.reduce((n: number, h: PairingHeap<T>) => {
            return n + h.count();
        }, 0);
    }

    public min() : T {
        return this.elem;
    }

    public empty() : boolean {
        return this.elem == null;
    }

    public contains(h: PairingHeap<T>): boolean {
        if (this === h) return true;
        for (var i = 0; i < this.subheaps.length; i++) {
            if (this.subheaps[i].contains(h)) return true;
        }
        return false;
    }

    public isHeap(lessThan: (a: T, b: T) => boolean): boolean {
        return this.subheaps.every(h=> lessThan(this.elem, h.elem) && h.isHeap(lessThan));
    }

    public insert(obj : T, lessThan) : PairingHeap<T> {
        return this.merge(new PairingHeap<T>(obj), lessThan);
    }

    public merge(heap2: PairingHeap<T>, lessThan): PairingHeap<T> {
        if (this.empty()) return heap2;
        else if (heap2.empty()) return this;
        else if (lessThan(this.elem, heap2.elem)) {
            this.subheaps.push(heap2);
            return this;
        } else {
            heap2.subheaps.push(this);
            return heap2;
        }
    }

    public removeMin(lessThan: (a: T, b: T) => boolean): PairingHeap<T> {
        if (this.empty()) return null;
        else return this.mergePairs(lessThan);
    }

    public mergePairs(lessThan: (a: T, b: T) => boolean) : PairingHeap<T> {
        if (this.subheaps.length == 0) return new PairingHeap<T>(null);
        else if (this.subheaps.length == 1) { return this.subheaps[0]; }
        else {
            var firstPair = this.subheaps.pop().merge(this.subheaps.pop(), lessThan);
            var remaining = this.mergePairs(lessThan);
            return firstPair.merge(remaining, lessThan);
        }
    }
    public decreaseKey(subheap: PairingHeap<T>, newValue: T, setHeapNode: (e: T, h: PairingHeap<T>)=>void, lessThan: (a: T, b: T) => boolean): PairingHeap<T> {
        var newHeap = subheap.removeMin(lessThan);
        //reassign subheap values to preserve tree
        subheap.elem = newHeap.elem;
        subheap.subheaps = newHeap.subheaps;
        if (setHeapNode !== null && newHeap.elem !== null) {
            setHeapNode(subheap.elem, subheap);
        }
        var pairingNode = new PairingHeap(newValue);
        if (setHeapNode !== null) {
            setHeapNode(newValue, pairingNode);
        }
        return this.merge(pairingNode, lessThan);
    }
}

/**
 * @class PriorityQueue a min priority queue backed by a pairing heap
 */
class PriorityQueue<T> {
    private root : PairingHeap<T>;
    constructor(private lessThan: (a: T, b: T) => boolean) { }
    /**
     * @method top
     * @return the top element (the min element as defined by lessThan)
     */
    public top() : T {
        if (this.empty()) { return null; }
        return this.root.elem;
    }
    /**
     * @method push
     * put things on the heap
     */
    public push(...args: T[]): PairingHeap<T> {
        var pairingNode;
        for (var i = 0, arg; arg=args[i]; ++i) {
            pairingNode = new PairingHeap(arg);
            this.root = this.empty() ?
                pairingNode : this.root.merge(pairingNode, this.lessThan);
        }
        return pairingNode;
    }
    /**
     * @method empty
     * @return true if no more elements in queue
     */
    public empty(): boolean {
        return !this.root || !this.root.elem;
    }
    /**
     * @method isHeap check heap condition (for testing)
     * @return true if queue is in valid state
     */
    public isHeap(): boolean {
        return this.root.isHeap(this.lessThan);
    }
    /**
     * @method forEach apply f to each element of the queue
     * @param f function to apply
     */
    public forEach(f) {
        this.root.forEach(f);
    }
    /**
     * @method pop remove and return the min element from the queue
     */
    public pop(): T {
        if (this.empty()) {
            return null;
        }
        var obj = this.root.min();
        this.root = this.root.removeMin(this.lessThan);
        return obj;
    }
    /**
     * @method reduceKey reduce the key value of the specified heap node
     */
    public reduceKey(heapNode: PairingHeap<T>, newKey: T, setHeapNode: (e: T, h: PairingHeap<T>)=>void = null): void {
        this.root = this.root.decreaseKey(heapNode, newKey, setHeapNode, this.lessThan);
    }
    public toString(selector) {
        return this.root.toString(selector);
    }
    /**
     * @method count
     * @return number of elements in queue
     */
    public count() {
        return this.root.count();
    }
}