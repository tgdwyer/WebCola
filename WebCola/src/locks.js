define(["require", "exports"], function(require, exports) {
    var Locks = (function () {
        function Locks() {
            this.locks = {};
        }
        Locks.prototype.add = function (id, x) {
            if (isNaN(x[0]) || isNaN(x[1]))
                debugger;
            this.locks[id] = x;
        };

        Locks.prototype.clear = function () {
            this.locks = {};
        };

        Locks.prototype.isEmpty = function () {
            for (var l in this.locks)
                return false;
            return true;
        };

        Locks.prototype.apply = function (f) {
            for (var l in this.locks) {
                f(l, this.locks[l]);
            }
        };
        return Locks;
    })();
    exports.Locks = Locks;
});
//# sourceMappingURL=locks.js.map
