/**
 * Descent respects a collection of locks over nodes that should not move
 * @class Locks
 */
var Locks = (function () {
    function Locks() {
        this.locks = {};
    }
    /**
     * add a lock on the node at index id
     * @method add
     * @param id index of node to be locked
     * @param x required position for node
     */
    Locks.prototype.add = function (id, x) {
        if (isNaN(x[0]) || isNaN(x[1]))
            debugger;
        this.locks[id] = x;
    };
    /**
     * @method clear clear all locks
     */
    Locks.prototype.clear = function () {
        this.locks = {};
    };
    /**
     * @isEmpty
     * @returns false if no locks exist
     */
    Locks.prototype.isEmpty = function () {
        for (var l in this.locks)
            return false;
        return true;
    };
    /**
     * perform an operation on each lock
     * @apply
     */
    Locks.prototype.apply = function (f) {
        for (var l in this.locks) {
            f(l, this.locks[l]);
        }
    };
    return Locks;
})();
exports.Locks = Locks;
