
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
            var subheap = this.subheaps[i];
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

    public min() : T {
        return this.elem;
    }

    public empty() : boolean {
        return this.elem == null;
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
    public decreaseKey(subheap: PairingHeap<T>, newValue: T, lessThan: (a: T, b: T) => boolean): { root: PairingHeap<T>; newNode: PairingHeap<T> } {
        var newHeap = subheap.removeMin(lessThan);
        //reassign subheap values to preserve tree
        subheap.elem = newHeap.elem;
        subheap.subheaps = newHeap.subheaps;
        var pairingNode = new PairingHeap(newValue);
        var heap = this.merge(pairingNode, lessThan);
        return { root: heap, newNode: pairingNode};
    }
}

class PriorityQueue<T> {
    private root : PairingHeap<T>;
    private lessThan: (a: T, b: T) => boolean;
    constructor(lessThan: (a: T, b: T) => boolean) { this.lessThan = lessThan; }
    public top() : T {
        if (this.empty()) { return null; }
        return this.root.elem;
    }
    public push(...args: T[]): PairingHeap<T> {
        var pairingNode;
        for (var i = 0, arg; arg=args[i]; ++i) {
            pairingNode = new PairingHeap(arg);
            this.root = this.empty() ?
                pairingNode : this.root.merge(pairingNode, this.lessThan);
        }
        return pairingNode;
    }
    public empty(): boolean {
        return !this.root || !this.root.elem;
    }
    public pop(): T {
        if (this.empty()) {
            return null;
        }
        var obj = this.root.min();
        this.root = this.root.removeMin(this.lessThan);
        return obj;
    }
    public reduceKey(heapNode: PairingHeap<T>, newKey: T): PairingHeap<T> {
        var r = this.root.decreaseKey(heapNode, newKey, this.lessThan);
        this.root = r.root;
        return r.newNode;
    }
    public toString(selector) {
        return this.root.toString(selector);
    }
}