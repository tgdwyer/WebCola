///<reference path="../extern/d3v3.d.ts"/>
import * as $ from 'jquery'

module tmdb {
    class NodeType {
        constructor(
            public type: string,
            public credits: string,
            public label: string,
            public imagesarray: string) { }

        toString(): string {
            return this.type;
        }

        next(): NodeType {
            return this === Movie ? Person : Movie;
        }

        makeEdge(thisName: string, otherName: string): Edge {
            return this === Movie ? new Edge(thisName, otherName) : new Edge(otherName, thisName);
        }
    }

    export var Movie = new NodeType("movie", "credits", "title", "posters");
    export var Person = new NodeType("person", "movie_credits", "name", "profiles");

    export class Node {
        imgurl: string;
        cast: any[];
        label: string;
        degree: number = 0;
        constructor(public type: NodeType, public id: number) { }
        name(): string { return this.type + this.id.toString(); }
        getImage(): JQueryPromise<Node> {
            var d = $.Deferred<Node>();
            var images = request(this.type, this.id, "images");
            $.when(images).then(i => {
                var paths = i[this.type.imagesarray];
                this.imgurl = paths.length > 0
                    ? 'http://image.tmdb.org/t/p/w185/' + paths[0].file_path
                    : 'http://upload.wikimedia.org/wikipedia/commons/3/37/No_person.jpg';
                d.resolve(this);
            });
            return d.promise();
        }
    }

    export class Edge {
        constructor(public source: string, public target: string) { }
        toString(): string {
            return this.source + '-' + this.target;
        }
    }
    const delay = 10000/40; // limit to 40 requests in 10 second span
    let last = 0;
    function request(type: NodeType, id: number, content: string = null, append: string = null): JQueryPromise<any> {
        var query = "https://api.themoviedb.org/3/" + type + "/" + id;
        if (content) {
            query += "/" + content;
        }
        query += "?api_key=1bba0362f468d50d2ec27acff6d5e05a";
        if (append) {
            query += "&append_to_response=" + append;
        }
        var dfd = $.Deferred();
        function defer() {
            if (last<1) {
                last++;
                setTimeout(()=>last--, delay);
                dfd.resolve($.get(query));
            } else 
                setTimeout(defer, delay);
            return dfd;
        }
        return defer();    
        //return $.get(query);
    }
    export class Graph {
        nodes: any = {};
        edges: any = {};
        expandNeighbours(node: Node, f: (v: Node) => void): JQueryPromise<Node[]> {
            var dn = node.cast.map(c => this.getNode(node.type.next(), c.id, v => {
                v.label = c[v.type.label];
                this.addEdge(node, v);
                f(v);
            }));
            var d = $.Deferred<Node[]>();
            $.when.apply($, dn)
                .then(function () {
                    var neighbours = Array.prototype.slice.call(arguments);
                    d.resolve(neighbours);
                });
            return d.promise();
        }
        fullyExpanded(node: Node): boolean {
            return node.cast && node.cast.every(v => (node.type.next() + v.id) in this.nodes);
        }
        addNode(type: NodeType, id: number): Node {
            var node = new Node(type, id);
            return this.nodes[node.name()] = node;
        }
        getNode(type: NodeType, id: number, f: (v: Node) => void): JQueryPromise<Node> {
            var d = $.Deferred<Node>();
            var name: string = type + id.toString();
            if (name in this.nodes) {
                return this.nodes[name];
            }
            var node = this.addNode(type, id);
            f(node);
            var cast = request(type, id, null, type.credits);
            $.when(cast).then(c => {
                node.label = c[type.label];
                (node.cast = c[type.credits].cast).forEach((v) => {
                    var neighbourname: string = type.next() + v.id.toString();
                    if (neighbourname in this.nodes) {
                        this.addEdge(node, this.nodes[neighbourname]);
                    }
                });
                d.resolve(node);
            });
            return d.promise();
        }
        addEdge(u: Node, v: Node) {
            var edge = u.type.makeEdge(u.name(), v.name());
            var ename = edge.toString();
            if (!(ename in this.edges)) {
                this.edges[ename] = edge;
            }
            ++u.degree, ++v.degree;
        }
    }
}

import * as cola from '../index'
var width = 960,
    height = 500,
    imageScale = 0.1;

var red = "rgb(254, 137, 137)";

var d3cola = cola.d3adaptor(d3)
    .linkDistance(60)
    .size([width, height]);

var outer = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("pointer-events", "all");

var zoom = d3.behavior.zoom();
outer.append('rect')
    .attr('class', 'background')
    .attr('width', "100%")
    .attr('height', "100%")
    .call(zoom.on("zoom", redraw))
    .on("dblclick.zoom", zoomToFit);

var defs = outer.append("svg:defs");

function addGradient(id, colour1, opacity1, colour2, opacity2) {
    var gradient = defs.append("svg:linearGradient")
        .attr("id", id)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%")
        .attr("spreadMethod", "pad");

    gradient.append("svg:stop")
        .attr("offset", "0%")
        .attr("stop-color", colour1)
        .attr("stop-opacity", opacity1);

    gradient.append("svg:stop")
        .attr("offset", "100%")
        .attr("stop-color", colour2)
        .attr("stop-opacity", opacity2);
}

addGradient("SpikeGradient", "red", 1, "red", 0);
addGradient("EdgeGradient", red, 1, "darkgray", 1);
addGradient("ReverseEdgeGradient", "darkgray", 1, red, 1);

var vis = outer.append('g');
var edgesLayer = vis.append("g");
var nodesLayer = vis.append("g");

var nodeMouseDown = false;

function redraw(transition) {
    // if mouse down then we are dragging not panning
    if (nodeMouseDown) return;
    (transition ? vis.transition() : vis)
        .attr("transform", "translate(" + zoom.translate() + ") scale(" + zoom.scale() + ")");
}

var modelgraph = new tmdb.Graph();
var viewgraph = { nodes: [], links: [] };

var nodeWidth = 30, nodeHeight = 35;

function refocus(focus) {
    var neighboursExpanded = modelgraph.expandNeighbours(focus, function (v: ViewNode) {
        if (!inView(v)) addViewNode(v, focus);
    });
    refreshViewGraph();
    $.when(neighboursExpanded).then(function f() {
        refreshViewGraph();
    });
}

function refreshViewGraph() {
    viewgraph.links = [];
    viewgraph.nodes.forEach(function (v) {
        var fullyExpanded = modelgraph.fullyExpanded(v);
        v.colour = fullyExpanded ? "darkgrey" : red
        if (!v.cast) return;
    });
    Object.keys(modelgraph.edges).forEach(function (e) {
        var l = modelgraph.edges[e];
        var u = modelgraph.nodes[l.source], v = modelgraph.nodes[l.target];
        if (inView(u) && inView(v)) viewgraph.links.push({ source: u, target: v });
        if (inView(u) && !inView(v)) u.colour = red;
        if (!inView(u) && inView(v)) v.colour = red;
    });
    update();
}

function hintNeighbours(v) {
    if (!v.cast) return;
    var hiddenEdges = v.cast.length + 1 - v.degree;
    var r = 2 * Math.PI / hiddenEdges;
    for (var i = 0; i < hiddenEdges; ++i) {
        var w = nodeWidth - 6,
            h = nodeHeight - 6,
            x = w / 2 + 25 * Math.cos(r * i),
            y = h / 2 + 30 * Math.sin(r * i),
            rect = new cola.Rectangle(0, w, 0, h),
            vi = rect.rayIntersection(x, y);
        var dview = d3.select("#" + v.name() + "_spikes");

        dview.append("rect")
            .attr("class", "spike")
            .attr("rx", 1).attr("ry", 1)
            .attr("x", 0).attr("y", 0)
            .attr("width", 10).attr("height", 2)
            .attr("transform", "translate(" + vi.x + "," + vi.y + ") rotate(" + (360 * i / hiddenEdges) + ")")
            .on("click", function () { click(v) });
    }
}

function unhintNeighbours(v) {
    var dview = d3.select("#" + v.name() + "_spikes");
    dview.selectAll(".spike").remove();
}

function inView(v) { return typeof v.viewgraphid !== 'undefined'; }

interface ViewNode extends tmdb.Node {
    viewgraphid: number;
    x: number;
    y: number;
    colour: string;
}
function addViewNode(v: ViewNode, startpos?) {
    v.viewgraphid = viewgraph.nodes.length;
    var d = v.getImage();
    $.when(d).then(function (node: ViewNode) {
        d3.select("#" + node.name()).append("image")
            .attr("width",0)
            .attr("height",0)
            .attr("transform", "translate(2,2)")
            .attr("xlink:href", function (v) {
                var url = v.imgurl;
                var simg = this;
                var img = new Image();
                img.onload = function () {
                    simg.setAttribute("width", nodeWidth - 4);
                    simg.setAttribute("height", nodeHeight - 4);
                }
                return img.src = url;
            }).on("click", function () { click(node) })
    });
    if (typeof startpos !== 'undefined') {
        v.x = startpos.x;
        v.y = startpos.y;
    }
    viewgraph.nodes.push(v);
}

function click(node:ViewNode) {
    if (node.colour !== red) return;
    var focus = modelgraph.getNode(node.type, node.id, addViewNode);
    refocus(focus);
}

function update() {
    d3cola.nodes(viewgraph.nodes)
        .links(viewgraph.links)
        .start();

    var link = edgesLayer.selectAll(".link")
        .data(viewgraph.links);

    link.enter().append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("height", 2)
        .attr("class", "link");

    link.exit().remove();

    link
        .attr("fill", function (d) {
            if (d.source.colour === red && d.target.colour === red) return red;
            if (d.source.colour !== red && d.target.colour !== red) return "darkgray";
            return d.source.colour === red ? "url(#ReverseEdgeGradient)" : "url(#EdgeGradient)";
        });

    var node = nodesLayer.selectAll(".node")
        .data(viewgraph.nodes, function (d) { return d.viewgraphid; })

    var nodeEnter = node.enter().append("g")
        .attr("id", function (d) { return d.name() })
        .attr("class", "node")
        .on("mousedown", function () { nodeMouseDown = true; }) // recording the mousedown state allows us to differentiate dragging from panning
        .on("mouseup", function () { nodeMouseDown = false; })
        .on("touchmove", function () { d3.event.preventDefault() })
        .on("mouseenter", function (d) { hintNeighbours(d) }) // on mouse over nodes we show "spikes" indicating there are hidden neighbours
        .on("mouseleave", function (d) { unhintNeighbours(d) })
        .call((<any>d3cola).drag);

    nodeEnter.append("g").attr("id", function (d) { return d.name() + "_spikes" })
        .attr("transform", "translate(3,3)");

    nodeEnter.append("rect")
        .attr("rx", 5).attr("ry", 5)
        .style("stroke-width", "0")
        .attr("width", nodeWidth).attr("height", nodeHeight)
        .on("click", function (d) { click(d) })
        .on("touchend", function (d) { click(d) });
    nodeEnter.append("title")
        .text(function (d) { return d.label; });

    node.style("fill", function (d) { return d.colour; });

    d3cola.on("tick", function () {
        link.attr("transform", function (d) {
            var dx = d.source.x - d.target.x, dy = d.source.y - d.target.y;
            var r = 180 * Math.atan2(dy, dx) / Math.PI;
            return "translate(" + d.target.x + "," + d.target.y + ") rotate(" + r + ") ";
        }).attr("width", function (d) {
            var dx = d.source.x - d.target.x, dy = d.source.y - d.target.y;
            return Math.sqrt(dx * dx + dy * dy);
        });

        node.attr("transform", function (d) { return "translate(" + (d.x - nodeWidth / 2) + "," + (d.y - nodeHeight / 2) + ")"; });
    });
}
function graphBounds() {
    var x = Number.POSITIVE_INFINITY, X = Number.NEGATIVE_INFINITY, y = Number.POSITIVE_INFINITY, Y = Number.NEGATIVE_INFINITY;
    nodesLayer.selectAll(".node").each(function (v) {
        x = Math.min(x, v.x - nodeWidth / 2);
        X = Math.max(X, v.x + nodeWidth / 2);
        y = Math.min(y, v.y - nodeHeight / 2);
        Y = Math.max(Y, v.y + nodeHeight / 2);
    });
    return { x: x, X: X, y: y, Y: Y };
}
function fullScreenCancel() {
    outer.attr("width", width).attr("height", height);
    zoomToFit();
}
function zoomToFit() {
    var b = graphBounds();
    var w = b.X - b.x, h = b.Y - b.y;
    var cw = Number(outer.attr("width")), ch = Number(outer.attr("height"));
    var s = Math.min(cw / w, ch / h);
    var tx = (-b.x * s + (cw / s - w) * s / 2), ty = (-b.y * s + (ch / s - h) * s / 2);
    zoom.translate([tx, ty]).scale(s);
    redraw(true);
}
import * as fullscreen from 'fullscreen';
$().ready(()=>{
    $("#zoomToFitButton").click(zoomToFit);
    $("#fullScreenButton").click(()=>{
        let fs = fullscreen(outer[0][0]);
        fs.request();
        outer.attr('width',screen.width).attr('height',screen.height);
        zoomToFit();
        fs.on('release',fullScreenCancel);
    });
    // get first node
    var d = modelgraph.getNode(tmdb.Movie, 550, addViewNode);
    $.when(d).then(function (startNode) {
        refocus(startNode);
    });
});