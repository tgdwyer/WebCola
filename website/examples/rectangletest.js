var canvaswidth = 800;
var canvasheight = 600;
var rectminsize = 60;
var rectmaxsize = 100;
var rectcount = 20;
var draw;
var rs;
var undoStack = [];
var animate = false;
var touchStart = window.navigator.msPointerEnabled ? "MSPointerDown" : "touchstart";
var touchMove = window.navigator.msPointerEnabled ? "MSPointerMove" : "touchmove";
var touchEnd = window.navigator.msPointerEnabled ? "MSPointerUp" : "touchend";
function toggleAnimation() {
    animate = !animate;
}

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
    draw = SVG('canvas').size(canvaswidth = x - 30, canvasheight = y - 100);
    var svg = draw.node;
    svg.addEventListener(touchMove, onTouchMove);
    svg.addEventListener(touchEnd, onTouchEnd);
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
        var rect = draw.rect(d.w, d.h).move(d.x, d.y).attr('fill-opacity', 0.5);
        if (touchStart !== "MSPointerDown") {
            rect.draggable();
            rect.dragmove = function (delta, event) {
                removeOverlaps(rs);
            };
        }
        rect.node.addEventListener(touchStart, onTouchStart);
        rect.node.style.msTouchAction = "none";
        rs.push(rect); 
    }
    undoStack.push(dims);
    dump(rs);
    return rs;
}

var dragRects = {};

function getTouchPoint(e, o, id) {
    var m = o.getScreenCTM();
    var p = draw.node.createSVGPoint();
    if (!e.clientX) {
        for (var i = 0; i < e.targetTouches.length; ++i) {
            var t = e.targetTouches[i];
            if (t.identifier == id) {
                e = t;
                break;
            }
        }
    }
    p.x = e.clientX || e.changedTouches[0].clientX;
    p.y = e.clientY || e.targetTouches[0].clientY;
    return p.matrixTransform(m.inverse());
}

function getTouchId(e) {
    if (typeof e.pointerId !== 'undefined') {
        return e.pointerId;
    }
    if (typeof e.identifier !== 'undefined') {
        return e.identifier;
    }
    return e.changedTouches[0].identifier;
}

function onTouchStart(e) {
    var touchId = getTouchId(e);
    var o = dragRects[touchId] = e.srcElement;
    var p = getTouchPoint(e, o, touchId);
    var rx = Number(o.getAttribute("x"));
    var ry = Number(o.getAttribute("y"));
    offset = { x: p.x - rx, y: p.y - ry };
    o.setAttribute("fill", "green");
}

function onTouchMove(e) {
    var handleTouch = function (t) {
        var tid = getTouchId(t);
        if (tid in dragRects) {
            var re = dragRects[tid];
            var p = getTouchPoint(t, re, tid);
            re.setAttribute("x", p.x - offset.x);
            re.setAttribute("y", p.y - offset.y);
            removeOverlaps(rs);
            e.preventDefault();
        }
    }
    if (e.changedTouches) {
        var i = e.changedTouches.length;
        while (i--) handleTouch(e.changedTouches[i]);
    } else {
        handleTouch(e);
    }
}

function onTouchEnd(e) {
    var tid = getTouchId(e);
    var handleTouch = function (t) {
        if (tid in dragRects) {
            var re = dragRects[tid];
            re.setAttribute("fill", "black");
            delete dragRects[tid];
        }
    }
    if (e.changedTouches) {
        var i = e.changedTouches.length;
        while (i--) handleTouch(e.changedTouches[i]);
    } else {
        handleTouch(e);
    }
}

function removeOverlaps(rects) {
    var rs = new Array(rects.length);
    var dims = [];
    rects.forEach(function (r, i) {
        var x = r.attr('x'), y = r.attr('y'), w = r.attr('width'), h = r.attr('height');
        dims.push({ x: x, y: y, w: w, h: h });
        rs[i] = new cola.Rectangle(x, x + w, y, y + h);
    });
    undoStack.push(dims);
    cola.removeOverlaps(rs);
    rects.forEach(function (r, i) {
        var t = rs[i];
        if (animate) {
            r.animate().move(t.x, t.y);
        } else {
            r.move(t.x, t.y);
        }
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