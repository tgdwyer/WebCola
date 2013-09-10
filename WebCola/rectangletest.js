var canvaswidth = 800;
var canvasheight = 600;
var rectminsize = 60;
var rectmaxsize = 100;
var rectcount = 10;
var draw;
var rs;
var undoStack = [];
function undo() {
    if (undoStack.length > 0) {
        draw.clear();
        rs = [];
        var prev = undoStack.pop();
        prev.forEach(function (r) {
            rs.push(draw.rect(r.w, r.h).move(r.x, r.y).attr('fill-opacity', 0.5).draggable());
        });
    }
}
function init() {
    var w = window,
        d = document,
        e = d.documentElement,
        g = d.getElementsByTagName('body')[0],
        x = w.innerWidth || e.clientWidth || g.clientWidth,
        y = w.innerHeight || e.clientHeight || g.clientHeight;
    draw = SVG('canvas').size(canvaswidth = x, canvasheight = y);
}

function updateRectCount(n) {
    rectcount = n;
    rs = drawRects();
}
function drawRects() {
    draw.clear();
    var r = Math.random;
    var rs = [];
    var dims = [];
    for (var i = 0; i < rectcount; ++i) {
        var w = rectminsize + (rectmaxsize - rectminsize) * r();
        var h = rectminsize + (rectmaxsize - rectminsize) * r();
        var d = {
            w: w,
            h: h,
            x: (canvaswidth - w) * r(),
            y: (canvasheight - h) * r(),
        };
        dims.push(d);
        rs.push(draw.rect(d.w, d.h).move(d.x, d.y).attr('fill-opacity', 0.5).draggable());
    }
    rs.forEach(function (r) {
        r.dragmove = function (delta, event) {
            removeOverlaps(rs);
        };
    });
    undoStack.push(dims);
    dump(rs);
    return rs;
}

function removeOverlaps(rects) {
    var rs = new Array(rects.length);
    var dims = [];
    rects.forEach(function (r, i) {
        var x = r.attr('x'), y = r.attr('y'), w = r.attr('width'), h = r.attr('height');
        dims.push({ x: x, y: y, w: w, h: h });
        rs[i] = new vpsc.Rectangle(x, x + w, y, y + h);
    });
    undoStack.push(dims);
    vpsc.removeOverlaps(rs);
    rects.forEach(function (r, i) {
        var o = rs[i];
        r.move(o.x, o.y);
    });
    //o.vs.forEach(function (v, i) {
    //    v.id = i;
    //});
    //o.cs.forEach(function (c) {
    //    var l = rs[c.left.id];
    //    var r = rs[c.right.id];
    //    draw.line(l.cx(), l.cy(), r.cx(), r.cy()).stroke({ width: 1, color: "orange" });
    //});
}

function dump(rs) {
    var e = document.getElementById("dump");
    e.innerHTML = "";
    rs.forEach(function (r) {
        var x = r.attr('x'), y = r.attr('y'), w = r.attr('width'), h = r.attr('height');
        var s = x + "," + (x + w) + "," + y + "," + (y + h);
        var node = document.createTextNode(s);
        var para = document.createElement("p");
        para.appendChild(node);
        e.appendChild(para);
    });
}