define(["require", "exports"], function(require, exports) {
    var Variable = (function () {
        function Variable(desiredPosition, weight, scale) {
            if (typeof weight === "undefined") { weight = 1; }
            if (typeof scale === "undefined") { scale = 1; }
            this.desiredPosition = desiredPosition;
            this.weight = weight;
            this.scale = scale;
            this.offset = 0;
        }
        Variable.prototype.dfdv = function () {
            return 2.0 * this.weight * (this.position() - this.desiredPosition);
        };

        Variable.prototype.position = function () {
            return (this.block.ps.scale * this.block.posn + this.offset) / this.scale;
        };

        Variable.prototype.visitNeighbours = function (prev, f) {
            var ff = function (c, next) {
                return c.active && prev !== next && f(c, next);
            };
            this.cOut.forEach(function (c) {
                return ff(c, c.right);
            });
            this.cIn.forEach(function (c) {
                return ff(c, c.left);
            });
        };
        return Variable;
    })();
    exports.Variable = Variable;
});
//# sourceMappingURL=variable.js.map
