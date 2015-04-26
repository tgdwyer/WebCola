var NodeWrapper = (function () {
    function NodeWrapper(id, rect, children) {
        this.id = id;
        this.rect = rect;
        this.children = children;
        this.leaf = typeof children === 'undefined' || children.length === 0;
    }
    return NodeWrapper;
})();
exports.NodeWrapper = NodeWrapper;
//# sourceMappingURL=node-wrapper.js.map
