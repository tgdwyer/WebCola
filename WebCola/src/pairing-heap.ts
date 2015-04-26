
export class PairingHeap<T> {
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