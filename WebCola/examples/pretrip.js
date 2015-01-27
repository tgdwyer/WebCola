///<reference path="../src/vpsc.ts"/>
///<reference path="../extern/jquery.d.ts"/>
///<reference path="../extern/d3.d.ts"/>
var tetrisbug;
(function (tetrisbug) {
    var width = 1280, height = 500;
    var color = d3.scale.category10();
    var makeEdgeBetween;
    var colans = cola;
    var graphfile = "graphdata/pre_trip.json";
    function makeSVG() {
        var svg = d3.select("body").append("svg").attr("width", width).attr("height", height);
        // define arrow markers for graph links
        svg.append('svg:defs').append('svg:marker').attr('id', 'end-arrow').attr('viewBox', '0 -5 10 10').attr('refX', 5).attr('markerWidth', 3).attr('markerHeight', 3).attr('orient', 'auto').append('svg:path').attr('d', 'M0,-5L10,0L0,5L2,0').attr('stroke-width', '0px');
        //.attr('fill', '#661141');
        return svg;
    }
    function flatGraph() {
        var d3cola = colans.d3adaptor().linkDistance(150).avoidOverlaps(true).size([width, height]);
        var svg = makeSVG();
        d3.json(graphfile, function (error, graph) {
            graph.nodes.forEach(function (v) {
                v.width = 200;
                v.height = 50;
            });
            d3cola.nodes(graph.nodes).links(graph.links).start(10, 10, 10);
            var linkTypes = getLinkTypes(graph.links);
            var link = svg.selectAll(".link").data(graph.links).enter().append("line").attr("stroke", function (l) { return color(linkTypes.lookup[l.type]); }).attr("fill", function (l) { return color(linkTypes.lookup[l.type]); }).attr("class", "link");
            var margin = 10;
            var node = svg.selectAll(".node").data(graph.nodes).enter().append("rect").attr("class", "node").attr("width", function (d) { return d.width + 2 * margin; }).attr("height", function (d) { return d.height + 2 * margin; }).attr("rx", 4).attr("ry", 4).call(d3cola.drag);
            var label = svg.selectAll(".label").data(graph.nodes).enter().append("text").attr("class", "label").text(function (d) { return d.name; }).call(d3cola.drag);
            node.append("title").text(function (d) { return d.name; });
            d3cola.on("tick", function () {
                node.each(function (d) { return d.innerBounds = d.bounds.inflate(-margin); });
                link.each(function (d) {
                    cola.vpsc.makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
                    if (isIE())
                        this.parentNode.insertBefore(this, this);
                });
                link.attr("x1", function (d) { return d.sourceIntersection.x; }).attr("y1", function (d) { return d.sourceIntersection.y; }).attr("x2", function (d) { return d.arrowStart.x; }).attr("y2", function (d) { return d.arrowStart.y; });
                node.attr("x", function (d) { return d.innerBounds.x; }).attr("y", function (d) { return d.innerBounds.y; }).attr("width", function (d) { return d.innerBounds.width(); }).attr("height", function (d) { return d.innerBounds.height(); });
                label.attr("x", function (d) { return d.x; }).attr("y", function (d) {
                    var h = this.getBBox().height;
                    return d.y + h / 3.5;
                });
            });
            var indent = 100, topindent = 120;
            var swatches = svg.selectAll('.swatch').data(linkTypes.list).enter().append('rect').attr('x', indent).attr('y', function (l, i) { return topindent + 40 * i; }).attr('width', 30).attr('height', 30).attr('fill', function (l, i) { return color(i); }).attr('class', 'swatch');
            var swatchlabels = svg.selectAll('.swatchlabel').data(linkTypes.list).enter().append('text').text(function (t) { return t ? t : "Any"; }).attr('x', indent + 40).attr('y', function (l, i) { return topindent + 20 + 40 * i; }).attr('fill', 'black').attr('class', 'swatchlabel');
        });
    }
    function expandGroup(g, ms) {
        if (g.groups) {
            g.groups.forEach(function (cg) { return expandGroup(cg, ms); });
        }
        if (g.leaves) {
            g.leaves.forEach(function (l) {
                ms.push(l.index + 1);
            });
        }
    }
    function getId(v, n) {
        return (typeof v.index === 'number' ? v.index : v.id + n) + 1;
    }
    function powerGraph() {
        var d3cola = colans.d3adaptor().linkDistance(80).handleDisconnected(false).avoidOverlaps(true).size([width, height]);
        var svg = makeSVG();
        d3.json(graphfile, function (error, graph) {
            graph.nodes.forEach(function (v, i) {
                v.index = i;
                v.width = 200;
                v.height = 50;
            });
            var powerGraph;
            var doLayout = function (response) {

                var vs = response.nodes.filter(function (v) { return v.label; });
                vs.forEach(function (v) {
                    var index = Number(v.label) - 1;
                    var node = graph.nodes[index];
                    node.y = Number(v.x) / 1.5 + 50;
                    node.x = Number(v.y) * 2 + 50;
                    node.fixed = 1;
                });
                d3cola.start(1, 1, 1);
                var group = svg.selectAll(".group").data(powerGraph.groups).enter().append("rect").attr("rx", 8).attr("ry", 8).attr("class", "group");
                var link = svg.selectAll(".link").data(powerGraph.powerEdges).enter().append("line").attr("stroke", function (l) { return color(l.type); }).attr("fill", function (l) { return color(l.type); }).attr("class", "link");
                var margin = 10;
                var node = svg.selectAll(".node").data(graph.nodes).enter().append("rect").attr("class", "node").attr("width", function (d) { return d.width + 2 * margin; }).attr("height", function (d) { return d.height + 2 * margin; }).attr("rx", 4).attr("ry", 4).call(d3cola.drag);
                var label = svg.selectAll(".label").data(graph.nodes).enter().append("text").attr("class", "label").text(function (d) { return d.name; }).call(d3cola.drag);
                node.append("title").text(function (d) { return d.name; });
                d3cola.on("tick", function () {
                    node.each(function (d) {
                        d.bounds.setXCentre(d.x);
                        d.bounds.setYCentre(d.y);
                        d.innerBounds = d.bounds.inflate(-margin);
                    });
                    group.each(function (d) { return d.innerBounds = d.bounds.inflate(-margin); });
                    link.each(function (d) {
                        cola.vpsc.makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
                        if (isIE())
                            this.parentNode.insertBefore(this, this);
                    });
                    link.attr("x1", function (d) { return d.sourceIntersection.x; }).attr("y1", function (d) { return d.sourceIntersection.y; }).attr("x2", function (d) { return d.arrowStart.x; }).attr("y2", function (d) { return d.arrowStart.y; });
                    node.attr("x", function (d) { return d.innerBounds.x; }).attr("y", function (d) { return d.innerBounds.y; }).attr("width", function (d) { return d.innerBounds.width(); }).attr("height", function (d) { return d.innerBounds.height(); });
                    group.attr("x", function (d) { return d.innerBounds.x; }).attr("y", function (d) { return d.innerBounds.y; }).attr("width", function (d) { return d.innerBounds.width(); }).attr("height", function (d) { return d.innerBounds.height(); });
                    label.attr("x", function (d) { return d.x; }).attr("y", function (d) {
                        var h = this.getBBox().height;
                        return d.y + h / 3.5;
                    });
                });
            };
            var linkTypes = getLinkTypes(graph.links);
            d3cola.nodes(graph.nodes).links(graph.links).linkType(function (l) { return linkTypes.lookup[l.type]; }).powerGraphGroups(function (d) { return (powerGraph = d).groups.forEach(function (v) { return v.padding = 10; }); });
            var modules = { N: graph.nodes.length, ms: [], edges: [] };
            var n = modules.N;
            powerGraph.groups.forEach(function (g) {
                var m = [];
                expandGroup(g, m);
                modules.ms.push(m);
            });
            powerGraph.powerEdges.forEach(function (e) {
                var N = graph.nodes.length;
                modules.edges.push({ source: getId(e.source, N), target: getId(e.target, N) });
            });
            {
                d3.json(graphfile.replace(/.json/, 'pgresponse.json'), function (error, response) {
                    doLayout(response);
                });
            }
        });
    }
    function getLinkTypes(links) {
        var linkTypes = { list: [], lookup: {} };
        links.forEach(function (l) { return linkTypes.lookup[l.type] = {}; });
        var typeCount = 0;
        for (var type in linkTypes.lookup) {
            linkTypes.list.push(type);
            linkTypes.lookup[type] = typeCount++;
        }
        return linkTypes;
    }
    function isIE() {
        return ((navigator.appName == 'Microsoft Internet Explorer') || ((navigator.appName == 'Netscape') && (new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})").exec(navigator.userAgent) != null)));
    }
    flatGraph();
    powerGraph();
})(tetrisbug || (tetrisbug = {}));
