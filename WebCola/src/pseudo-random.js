define(["require", "exports"], function(require, exports) {
    var PseudoRandom = (function () {
        function PseudoRandom(seed) {
            if (typeof seed === "undefined") { seed = 1; }
            this.seed = seed;
            this.a = 214013;
            this.c = 2531011;
            this.m = 2147483648;
            this.range = 32767;
        }
        PseudoRandom.prototype.getNext = function () {
            this.seed = (this.seed * this.a + this.c) % this.m;
            return (this.seed >> 16) / this.range;
        };

        PseudoRandom.prototype.getNextBetween = function (min, max) {
            return min + this.getNext() * (max - min);
        };
        return PseudoRandom;
    })();
    exports.PseudoRandom = PseudoRandom;
});
//# sourceMappingURL=pseudo-random.js.map
