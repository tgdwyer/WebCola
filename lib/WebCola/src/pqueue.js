var PairingHeap = PairingHeap.PairingHeap;

var PriorityQueue = (function () {
    function PriorityQueue(lessThan) {
        this.lessThan = lessThan;
    }
    PriorityQueue.prototype.top = function () {
        if (this.empty()) {
            return null;
        }
        return this.root.elem;
    };

    PriorityQueue.prototype.push = function () {
        var args = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            args[_i] = arguments[_i + 0];
        }
        var pairingNode;
        for (var i = 0, arg; arg = args[i]; ++i) {
            pairingNode = new PairingHeap(arg);
            this.root = this.empty() ? pairingNode : this.root.merge(pairingNode, this.lessThan);
        }
        return pairingNode;
    };

    PriorityQueue.prototype.empty = function () {
        return !this.root || !this.root.elem;
    };

    PriorityQueue.prototype.isHeap = function () {
        return this.root.isHeap(this.lessThan);
    };

    PriorityQueue.prototype.forEach = function (f) {
        this.root.forEach(f);
    };

    PriorityQueue.prototype.pop = function () {
        if (this.empty()) {
            return null;
        }
        var obj = this.root.min();
        this.root = this.root.removeMin(this.lessThan);
        return obj;
    };

    PriorityQueue.prototype.reduceKey = function (heapNode, newKey, setHeapNode) {
        if (typeof setHeapNode === "undefined") { setHeapNode = null; }
        this.root = this.root.decreaseKey(heapNode, newKey, setHeapNode, this.lessThan);
    };
    PriorityQueue.prototype.toString = function (selector) {
        return this.root.toString(selector);
    };

    PriorityQueue.prototype.count = function () {
        return this.root.count();
    };
    return PriorityQueue;
})();
exports.PriorityQueue = PriorityQueue;
//# sourceMappingURL=pqueue.js.map
