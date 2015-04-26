var PairingHeap = require('./pairing-heap');
var PairingHeap = PairingHeap.PairingHeap;
/**
 * @class PriorityQueue a min priority queue backed by a pairing heap
 */
var PriorityQueue = (function () {
    function PriorityQueue(lessThan) {
        this.lessThan = lessThan;
    }
    /**
     * @method top
     * @return the top element (the min element as defined by lessThan)
     */
    PriorityQueue.prototype.top = function () {
        if (this.empty()) {
            return null;
        }
        return this.root.elem;
    };
    /**
     * @method push
     * put things on the heap
     */
    PriorityQueue.prototype.push = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        var pairingNode;
        for (var i = 0, arg; arg = args[i]; ++i) {
            pairingNode = new PairingHeap(arg);
            this.root = this.empty() ? pairingNode : this.root.merge(pairingNode, this.lessThan);
        }
        return pairingNode;
    };
    /**
     * @method empty
     * @return true if no more elements in queue
     */
    PriorityQueue.prototype.empty = function () {
        return !this.root || !this.root.elem;
    };
    /**
     * @method isHeap check heap condition (for testing)
     * @return true if queue is in valid state
     */
    PriorityQueue.prototype.isHeap = function () {
        return this.root.isHeap(this.lessThan);
    };
    /**
     * @method forEach apply f to each element of the queue
     * @param f function to apply
     */
    PriorityQueue.prototype.forEach = function (f) {
        this.root.forEach(f);
    };
    /**
     * @method pop remove and return the min element from the queue
     */
    PriorityQueue.prototype.pop = function () {
        if (this.empty()) {
            return null;
        }
        var obj = this.root.min();
        this.root = this.root.removeMin(this.lessThan);
        return obj;
    };
    /**
     * @method reduceKey reduce the key value of the specified heap node
     */
    PriorityQueue.prototype.reduceKey = function (heapNode, newKey, setHeapNode) {
        if (setHeapNode === void 0) { setHeapNode = null; }
        this.root = this.root.decreaseKey(heapNode, newKey, setHeapNode, this.lessThan);
    };
    PriorityQueue.prototype.toString = function (selector) {
        return this.root.toString(selector);
    };
    /**
     * @method count
     * @return number of elements in queue
     */
    PriorityQueue.prototype.count = function () {
        return this.root.count();
    };
    return PriorityQueue;
})();
exports.PriorityQueue = PriorityQueue;
