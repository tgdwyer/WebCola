declare function require(name:string);
import PairingHeap = require('./pairing-heap');
var PairingHeap = PairingHeap.PairingHeap;



/**
 * @class PriorityQueue a min priority queue backed by a pairing heap
 */
export class PriorityQueue<T> {
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