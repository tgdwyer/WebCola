var Vert = (function () {
    function Vert(id, x, y, node, line) {
        if (typeof node === "undefined") { node = null; }
        if (typeof line === "undefined") { line = null; }
        this.id = id;
        this.x = x;
        this.y = y;
        this.node = node;
        this.line = line;
    }
    return Vert;
})();
exports.Vert = Vert;
