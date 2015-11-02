///<reference path="../extern/d3.d.ts"/>
///<reference path="../src/layout.ts"/>
///<reference path="../src/vpsc.ts"/>
///<reference path="../src/rectangle.ts"/>
///<reference path="../src/gridrouter.ts"/>
///<reference path="../src/geom.ts"/>
///<reference path="../extern/jquery.d.ts"/>

module vhybridize{
var color = d3.scale.category10();

var makeEdgeBetween;
var colans = <any>cola;

var graphfile = "graphdata/set1/n7e23.json";
var maxwidth = 4;
    var maxheight = 4;

    var modules;

function makeSVG(addGridLines, mywidth, myheight):any {
    var svg = d3.select("#mysoloresults").append("svg")
        .attr("width", mywidth)
        .attr("height", myheight);
    // define arrow markers for graph links
    /*svg.append('svg:defs').append('svg:marker')
        .attr('id', 'end-arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 5)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5L2,0')
        .attr('stroke-width', '0px')
*/
    if (addGridLines) {
        var i = 50;
        while (i < 1200) {
            svg.append("line")
                .attr("x1", 1 * i)
                .attr("y1", 50)
                .attr("x2", 1 * i)
                .attr("y2", 650)
                .attr("stroke-width", 1)
                .attr("stroke", "black");
            i = i + 62.5;   // + 50 is enough
            svg.append("line")
                .attr("x1", 1 * i)
                .attr("y1", 50)
                .attr("x2", 1 * i)
                .attr("y2", 650)
                .attr("stroke-width", 0.1)
                .attr("stroke", "grey");
            i = i + 62.5;
        }
        i = 50;
        while (i < 650) {
            svg.append("line")
                .attr("x1", 50)
                .attr("y1", 1 * i)
                .attr("x2", 1200)
                .attr("y2", 1 * i)
                .attr("stroke-width", 1)
                .attr("stroke", "black");
            i = i + 62.5;

            svg.append("line")
                .attr("x1", 50)
                .attr("y1", 1 * i)
                .attr("x2", 1200)
                .attr("y2", 1 * i)
                .attr("stroke-width", 0.1)
                .attr("stroke", "grey");
            i = i + 62.5;
        }
    }
    return svg;
}

function flatGraph() {
    var d3cola = colans.d3adaptor().linkDistance(80).avoidOverlaps(true).size([2000, 2000]);
    var svg = makeSVG(false, 2000, 2000);
    inputjson.nodes.forEach(function (v) {
            v.width = 50;
            v.height = 50;
        });
    d3cola.nodes(inputjson.nodes).links(inputjson.links).start(10, 10, 10);
    var linkTypes = getLinkTypes(inputjson.links);
    var link = svg.selectAll(".link").data(inputjson.links).enter().append("line").attr("stroke", function (l) { return color(l.type); }).attr("fill", function (l) { return color(l.type); }).attr("class", "link");
        var margin = 10;
    var node = svg.selectAll(".node").data(inputjson.nodes).enter().append("rect").attr("class", "node").attr("width", function (d) { return d.width + 2 * margin; }).attr("height", function (d) { return d.height + 2 * margin; }).attr("rx", 4).attr("ry", 4).call(d3cola.drag);
    var label = svg.selectAll(".label").data(inputjson.nodes).enter().append("text").attr("class", "label").text(function (d) { return d.name; }).call(d3cola.drag);
        node.append("title").text(function (d) { return d.name; });
        d3cola.on("tick", function () {
            node.each(function (d) { return d.innerBounds = d.bounds.inflate(-margin); });
            link.each(function (d) {
                d.route = cola.vpsc.makeEdgeBetween(d.source.innerBounds, d.target.innerBounds, 5);
                if (isIE())
                    this.parentNode.insertBefore(this, this);
            })
                .attr("x1", function (d) { return d.route.sourceIntersection.x; })
                .attr("y1", function (d) { return d.route.sourceIntersection.y; })
                .attr("x2", function (d) { return d.route.arrowStart.x; })
                .attr("y2", function (d) { return d.route.arrowStart.y; });

            node.attr("x", function (d) { return d.innerBounds.x; })
                .attr("y", function (d) { return d.innerBounds.y; })
                .attr("width", function (d) { return d.innerBounds.width(); })
                .attr("height", function (d) { return d.innerBounds.height(); });
            label.attr("x", function (d) { return d.x; }).attr("y", function (d) {
                var h = this.getBBox().height;
                return d.y + h / 3.5;
            });
        });
        var indent = 100, topindent = 150;
        var swatches = svg.selectAll('.swatch').data(linkTypes.list).enter().append('rect').attr('x', indent).attr('y', function (l, i) { return topindent + 40 * i; }).attr('width', 30).attr('height', 30).attr('fill', function (l, i) { return color(i); }).attr('class', 'swatch');
        var swatchlabels = svg.selectAll('.swatchlabel').data(linkTypes.list).enter().append('text').text(function (t) { return t ? t : "Any"; }).attr('x', indent + 40).attr('y', function (l, i) { return topindent + 20 + 40 * i; }).attr('fill', 'black').attr("font-size", "15").attr('class', 'swatchlabel');
     modules = {
        N: inputjson.nodes.length, nodes: [], edges: []
    };
    inputjson.links.forEach(e => {
        modules.edges.push({ source: getId(e.source, inputjson.nodes.length), target: getId(e.target, inputjson.nodes.length) });
    });
    inputjson.nodes.forEach(n => {
        modules.nodes.push({ id: n.index+1, x: n.bounds.x, y: n.bounds.y });
    });
}

function expandGroup(g, ms) {
    if (g.groups) {
        g.groups.forEach(cg => expandGroup(cg, ms));
    }
    if (g.leaves) {
        g.leaves.forEach(l => {
            ms.push(l.index + 1);
        });
    }
}

function getId(v, n) {
    return (typeof v.index === 'number' ? v.index : v.id + n) + 1;
}

function getLinkTypes(links) {
    var linkTypes = { list: [], lookup: {} };
    links.forEach(l=> linkTypes.lookup[l.type] = {});
    var typeCount = 0;
    for (var type in linkTypes.lookup) {
        linkTypes.list.push(type);
        linkTypes.lookup[type] = typeCount++;
    }
    return linkTypes;
}

function isIE() { return ((navigator.appName == 'Microsoft Internet Explorer') || ((navigator.appName == 'Netscape') && (new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})").exec(navigator.userAgent) != null))); }

function heuristicPowerGraphLayout(graph, size) {
    // compute power graph
    var powerGraph;
    var d3cola = colans.d3adaptor()
        .avoidOverlaps(false)
        .nodes(graph.nodes)
        .links(graph.links)
        .powerGraphGroups(function (d) {
            powerGraph = d;
            powerGraph.groups.forEach(function (v) { v.padding = 0.01 });
        });

    // construct a flat graph with dummy nodes for the groups and edges connecting group dummy nodes to their children
    // power edges attached to groups are replaced with edges connected to the corresponding group dummy node
    var n = graph.nodes.length;
    var edges = [];
    var vs = graph.nodes.slice(0);
    vs.forEach((v, i) => v.index = i);
    powerGraph.groups.forEach(g => {
        var sourceInd = g.index = g.id + n;
        vs.push(g);
        if (typeof g.leaves !== 'undefined')
            g.leaves.forEach(v => edges.push({ source: sourceInd, target: v.index }));
        if (typeof g.groups !== 'undefined')
            g.groups.forEach(gg => edges.push({ source: sourceInd, target: gg.id + n }));
    });
    powerGraph.powerEdges.forEach(e=> {
        edges.push({ source: e.source.index, target: e.target.index });
    });

    // layout the flat graph with dummy nodes and edges
    d3cola = colans.d3adaptor()
        .size(size)
        .nodes(vs)
        .links(edges)
        .avoidOverlaps(false)
        .symmetricDiffLinkLengths(5)
        .start(100);

    // final layout taking node positions from above as starting positions
    // subject to group containment constraints
    d3cola = colans.d3adaptor()
        .size(size)
        .avoidOverlaps(true)
        .nodes(graph.nodes)
        .links(graph.links)
        //.flowLayout('y', 30)
        .groupCompactness(1e-4)
        .powerGraphGroups(function (d) {
            powerGraph = d;
            powerGraph.groups.forEach(function (v) {
                v.padding = 0.01
                });
        }).start(100, 0, 50, 50);
    return { cola: d3cola, powerGraph: powerGraph };
}

function powerGraph2(callback) {
    var size = [1000, 1000];

    var svg = makeSVG(false, 2000, 2000);


    inputjson.nodes.forEach(v=> {
        v.width = 50;
        v.height = 50;
    });

    var pgLayout = heuristicPowerGraphLayout(inputjson, size);

    // filter duplicate links:
    var es = pgLayout.powerGraph.powerEdges;
    var copy = [];
    var n = pgLayout.cola.nodes().length;

    for (var i = 0; i < es.length; i++) {
        var e = es[i];
        var dupFound = false;
        for (var j = i + 1; j < es.length; j++) {
            var f = es[j];
            dupFound = ((getId(e.source, n) == getId(f.source, n)) && (getId(e.target, n) == getId(f.target, n)))
            || ((getId(e.target, n) == getId(f.source, n)) && (getId(e.source, n) == getId(f.target, n)));
            if (dupFound) break;
        }
        if (!dupFound) copy.push(e);
    }
    pgLayout.powerGraph.powerEdges = copy;

        var group = svg.selectAll(".group")
            .data(pgLayout.powerGraph.groups)
            .enter().append("rect")
            .attr("rx", 8).attr("ry", 8)
            .attr("class", "group")
            .style("fill", function (d, i) { return color(i); });

        //var link = svg.selectAll(".link")
        //    .data(pgLayout.powerGraph.powerEdges)
        //    .enter().append("line")
        //    .attr("class", "link")
        //    .style("stroke", "black");

        var margin = 15;
        var groupMargin = 10;
        var node = svg.selectAll(".node")
            .data(inputjson.nodes)
            .enter().append("rect")
            .attr("class", "node")
            .attr("width", d=> d.width + 2 * margin)
            .attr("height", d=> d.height + 2 * margin)
            .attr("rx", 4).attr("ry", 4)
            .call(pgLayout.cola.drag);

        var label = svg.selectAll(".label")
            .data(inputjson.nodes)
            .enter().append("text")
            .attr("class", "label")
            .text(d=> d.name).call(pgLayout.cola.drag);

        node.append("title").text(d=> d.name);

        pgLayout.cola.on("tick", function () {
            node.each(function (d) { d.innerBounds = d.bounds.inflate(-margin) });
            group.each(function (d) { d.innerBounds = d.bounds.inflate(-groupMargin) });
            //link.each(function (d) {
            //    cola.vpsc.makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
            //    if (isIE()) this.parentNode.insertBefore(this, this);

            //});

            //link.attr("x1", function (d) { return d.sourceIntersection.x; })
            //    .attr("y1", function (d) { return d.sourceIntersection.y; })
            //    .attr("x2", function (d) { return d.targetIntersection.x; })
            //    .attr("y2", function (d) { return d.targetIntersection.y; });

            node.attr("x", function (d) { return d.innerBounds.x; })
                .attr("y", function (d) { return d.innerBounds.y; })
                .attr("width", function (d) { return d.innerBounds.width(); })
                .attr("height", function (d) { return d.innerBounds.height(); });

            group.attr("x", function (d) { return d.innerBounds.x; })
                .attr("y", function (d) { return d.innerBounds.y; })
                .attr("width", function (d) { return d.innerBounds.width(); })
                .attr("height", function (d) { return d.innerBounds.height(); });

            label.attr("x", function (d) { return d.x; })
                .attr("y", function (d) {
                var h = this.getBBox().height;
                return d.y + h / 3.5;

            });
        }).on('end', function () {
            var n = pgLayout.cola.nodes().length,
                _id = v => getId(v, n) - 1,
                g = {
                    nodes: pgLayout.cola.nodes().map(d=> <any>{
                        id: _id(d),
                        name: d.name,
                        bounds: new cola.vpsc.Rectangle(d.innerBounds.x, d.innerBounds.X, d.innerBounds.y, d.innerBounds.Y)
                    }).concat(
                        pgLayout.powerGraph.groups.map(d=> <any>{
                            id: _id(d),
                            children: (typeof d.groups !== 'undefined' ? d.groups.map(c=> n + c.id) : [])
                                .concat(typeof d.leaves !== 'undefined' ? d.leaves.map(c=> c.index) : [])
                        })),
                    edges: pgLayout.powerGraph.powerEdges.map(e=> <any>{
                        source: _id(e.source),
                        target: _id(e.target),
                        type: e.type
                    })
                };
            var gridrouter = new cola.GridRouter(g.nodes, {
                getChildren: function (v: any) {
                    return v.children;
                },
                getBounds: function (v: any) {
                    return v.bounds;
                }
            },
                5);

            var gs = gridrouter.backToFront.filter(v=> !v.leaf);
            var routes = gridrouter.routeEdges<any>(g.edges, 5, e=> e.source, e=> e.target);
            g.edges.forEach((e, j) => {
                var route = routes[j];
                var id = 'e' + e.source + '-' + e.target;
                var cornerradius = 5;
                var arrowwidth = 3;
                var arrowheight = 0;
                var c = color(e.type);
                var linewidth = 2;
                var path = 'M ' + route[0][0].x + ' ' + route[0][0].y + ' ';
                if (route.length > 1) {
                    for (var i = 0; i < route.length; i++) {
                        var li = route[i];
                        var x = li[1].x, y = li[1].y;
                        var dx = x - li[0].x;
                        var dy = y - li[0].y;
                        if (i < route.length - 1) {
                            if (Math.abs(dx) > 0) {
                                x -= dx / Math.abs(dx) * cornerradius;
                            } else {
                                y -= dy / Math.abs(dy) * cornerradius;
                            }
                            path += 'L ' + x + ' ' + y + ' ';
                            var l = route[i + 1];
                            var x0 = l[0].x, y0 = l[0].y;
                            var x1 = l[1].x;
                            var y1 = l[1].y;
                            dx = x1 - x0;
                            dy = y1 - y0;
                            var angle = cola.GridRouter.angleBetween2Lines(li, l) < 0 ? 1 : 0;
                            console.log(cola.GridRouter.angleBetween2Lines(li, l))
                            var x2, y2;
                            if (Math.abs(dx) > 0) {
                                x2 = x0 + dx / Math.abs(dx) * cornerradius;
                                y2 = y0;
                            } else {
                                x2 = x0;
                                y2 = y0 + dy / Math.abs(dy) * cornerradius;
                            }
                            var cx = Math.abs(x2 - x);
                            var cy = Math.abs(y2 - y);
                            path += 'A ' + cx + ' ' + cy + ' 0 0 ' + angle + ' ' + x2 + ' ' + y2 + ' ';
                        } else {
                            var arrowtip = [x, y];
                            var arrowcorner1, arrowcorner2;
                            if (Math.abs(dx) > 0) {
                                x -= dx / Math.abs(dx) * arrowheight;
                                arrowcorner1 = [x, y + arrowwidth];
                                arrowcorner2 = [x, y - arrowwidth];
                            } else {
                                y -= dy / Math.abs(dy) * arrowheight;
                                arrowcorner1 = [x + arrowwidth, y];
                                arrowcorner2 = [x - arrowwidth, y];
                            }
                            path += 'L ' + x + ' ' + y + ' ';
                            if (arrowheight > 0) {
                                svg.append('path')
                                    .attr('d', 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                                    + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1] + ' Z')
                                    .attr('stroke', '#550000')
                                    .attr('stroke-width', 2);
                                svg.append('path')
                                    .attr('d', 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                                    + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1])
                                    .attr('stroke', 'none')
                                    .attr('fill', c);
                            }
                        }
                    }
                } else {
                    var li = route[0];
                    var x = li[1].x, y = li[1].y;
                    var dx = x - li[0].x;
                    var dy = y - li[0].y;
                    var arrowtip = [x, y];
                    var arrowcorner1, arrowcorner2;
                    if (Math.abs(dx) > 0) {
                        x -= dx / Math.abs(dx) * arrowheight;
                        arrowcorner1 = [x, y + arrowwidth];
                        arrowcorner2 = [x, y - arrowwidth];
                    } else {
                        y -= dy / Math.abs(dy) * arrowheight;
                        arrowcorner1 = [x + arrowwidth, y];
                        arrowcorner2 = [x - arrowwidth, y];
                    }
                    path += 'L ' + x + ' ' + y + ' ';
                    if (arrowheight > 0) {
                        svg.append('path')
                            .attr('d', 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                            + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1] + ' Z')
                            .attr('stroke', '#550000')
                            .attr('stroke-width', 2);
                        svg.append('path')
                            .attr('d', 'M ' + arrowtip[0] + ' ' + arrowtip[1] + ' L ' + arrowcorner1[0] + ' ' + arrowcorner1[1]
                            + ' L ' + arrowcorner2[0] + ' ' + arrowcorner2[1])
                            .attr('stroke', 'none')
                            .attr('fill', c);
                    }
                }
                svg.append('path')
                    .attr('d', path)
                    .attr('fill', 'none')
                    .attr('stroke', '#550000')
                    .attr('stroke-width', linewidth + 2);
                svg.append('path')
                    .attr('id', id)
                    .attr('d', path)
                    .attr('fill', 'none')
                    .attr('stroke', c)
                    .attr('stroke-width', linewidth);
            });
        });

    var N = inputjson.nodes.length;

    var noparentnodes = inputjson.nodes.filter(function (nv) {
            return nv.parent == null;
        });
    var parentnodes = inputjson.nodes.filter(nv => nv.parent);

        var noparentgroups = pgLayout.powerGraph.groups.filter(function (ng) {
            return ng.parent == null;
        });
        var parentgroups = pgLayout.powerGraph.groups.filter(ng => ng.parent);

        var left = [];
        var above = [];
        var xoverlap = [];
        var yoverlap = [];

        noparentnodes.forEach(np => {
            noparentnodes.forEach(npv => {
                if (npv.index != np.index) {
                    if ((npv.bounds.X <= np.bounds.x) && (((npv.bounds.y <= np.bounds.y) && (npv.bounds.Y >= np.bounds.y)) ||
                        ((np.bounds.y <= npv.bounds.y) && (np.bounds.Y >= npv.bounds.y)))) {
                        left.push({ source: getId(npv, N), target: getId(np, N) });
                    }
                    if ((npv.bounds.Y <= np.bounds.y) && (((npv.bounds.x <= np.bounds.x) && (npv.bounds.X >= np.bounds.x)) || ((np.bounds.x <= npv.bounds.x) && (np.bounds.X >= npv.bounds.x))) ) {
                        above.push({ source: getId(npv, N), target: getId(np, N) });
                    }
                   
                }
            });
        });

        noparentgroups.forEach(np => {
            noparentgroups.forEach(npp => {
                if (getId(npp, N) != getId(np, N)) {
                    if ((npp.bounds.X - 20 <= np.bounds.x + 20) && (((npp.bounds.y+20 <= np.bounds.y) && (npp.bounds.Y -20 >= np.bounds.y)) || ((np.bounds.y <= npp.bounds.y + 20) && (np.bounds.Y >= npp.bounds.y + 20)))) {
                        left.push({ source: getId(npp, N), target: getId(np, N) });
                    }
                    if ((npp.bounds.Y - 20 <= np.bounds.y + 20) && (((npp.bounds.x + 20 <= np.bounds.x) && (npp.bounds.X -20 >= np.bounds.x)) || ((np.bounds.x <= npp.bounds.x  + 20) && (np.bounds.X >= npp.bounds.x + 20)))) {
                        above.push({ source: getId(npp, N), target: getId(np, N) });
                    }
                   
                }
            });
            noparentnodes.forEach(npv => {
                if ((npv.bounds.X <= np.bounds.x + 20) && (((npv.bounds.y <= np.bounds.y + 20) && (npv.bounds.Y >= np.bounds.y + 20)) || ((np.bounds.y+20 <= npv.bounds.y) && (np.bounds.Y-20 >= npv.bounds.y)))) {
                    left.push({ source: getId(npv, N), target: getId(np, N) });
                }
                else if ((np.bounds.X - 20 <= npv.bounds.x) && (((npv.bounds.y <= np.bounds.y+20) && (npv.bounds.Y >= np.bounds.y+20)) || ((np.bounds.y+20 <= npv.bounds.y) && (np.bounds.Y-20 >= npv.bounds.y)))) {
                    left.push({ source: getId(np, N), target: getId(npv, N) });
                }
                if ((npv.bounds.Y <= np.bounds.y + 20) && (((npv.bounds.x <= np.bounds.x+20) && (npv.bounds.X >= np.bounds.x+20)) || ((np.bounds.x+20 <= npv.bounds.x) && (np.bounds.X-20 >= npv.bounds.x)))) {
                    above.push({ source: getId(npv, N), target: getId(np, N) });
                }
                else if ((np.bounds.Y - 20 <= npv.bounds.y) && (((npv.bounds.x <= np.bounds.x+20) && (npv.bounds.X >= np.bounds.x+20)) || ((np.bounds.x+20 <= npv.bounds.x) && (np.bounds.X-20 >= npv.bounds.x)))) {
                    above.push({ source: getId(np, N), target: getId(npv, N) });
                }
                
            });
        });

        parentnodes.forEach(np => {
            parentnodes.forEach(npv => {
                if ((npv.index != np.index) && (getId(npv.parent, N) == getId(np.parent, N))) {
                    if ((npv.bounds.X <= np.bounds.x) && (((npv.bounds.y <= np.bounds.y) && (npv.bounds.Y >= np.bounds.y)) || ((np.bounds.y <= npv.bounds.y) && (np.bounds.Y >= npv.bounds.y)))) {
                        left.push({ source: getId(npv, N), target: getId(np, N) });
                    }
                    if ((npv.bounds.Y <= np.bounds.y) && (((npv.bounds.x <= np.bounds.x) && (npv.bounds.X >= np.bounds.x)) || ((np.bounds.x <= npv.bounds.x) && (np.bounds.X >= npv.bounds.x)))) {
                        above.push({ source: getId(npv, N), target: getId(np, N) });
                    }
                   
                }
            });
        });

        parentgroups.forEach(np => {
            parentgroups.forEach(npp => {
                if ((getId(npp, N) != getId(np, N)) && (getId(npp.parent, N) == getId(np.parent, N))) {
                    if ((npp.bounds.X - 20 <= np.bounds.x + 20) && (((npp.bounds.y +20 <= np.bounds.y+20) && (npp.bounds.Y-20 >= np.bounds.y+20)) || ((np.bounds.y+20 <= npp.bounds.y+20) && (np.bounds.Y-20 >= npp.bounds.y+20)))) {
                        left.push({ source: getId(npp, N), target: getId(np, N) });
                    }
                    if ((npp.bounds.Y - 20 <= np.bounds.y + 20) && (((npp.bounds.x+20 <= np.bounds.x+20) && (npp.bounds.X -20 >= np.bounds.x+20)) || ((np.bounds.x+20 <= npp.bounds.x+20) && (np.bounds.X-20 >= npp.bounds.x+20)))) {
                        above.push({ source: getId(npp, N), target: getId(np, N) });
                    }
                    
                }
            });
            parentnodes.forEach(npv => {
                if (getId(npv.parent, N) == getId(np.parent, N)) {
                    if ((npv.bounds.X <= np.bounds.x + 20) && (((npv.bounds.y <= np.bounds.y+20) && (npv.bounds.Y >= np.bounds.y+20)) || ((np.bounds.y+20 <= npv.bounds.y) && (np.bounds.Y -20 >= npv.bounds.y)))) {
                        left.push({ source: getId(npv, N), target: getId(np, N) });
                    }
                    else if ((np.bounds.X - 20 <= npv.bounds.x) && (((npv.bounds.y <= np.bounds.y+20) && (npv.bounds.Y >= np.bounds.y+20)) || ((np.bounds.y+20 <= npv.bounds.y) && (np.bounds.Y-20 >= npv.bounds.y)))) {
                        left.push({ source: getId(np, N), target: getId(npv, N) });
                    }
                    if ((npv.bounds.Y <= np.bounds.y + 20) && (((npv.bounds.x <= np.bounds.x+20) && (npv.bounds.X >= np.bounds.x+20)) || ((np.bounds.x+20 <= npv.bounds.x) && (np.bounds.X-20 >= npv.bounds.x)))) {
                        above.push({ source: getId(npv, N), target: getId(np, N) });
                    }
                    else if ((np.bounds.Y - 20 <= npv.bounds.y) && (((npv.bounds.x <= np.bounds.x+20) && (npv.bounds.X >= np.bounds.x+20)) || ((np.bounds.x+20 <= npv.bounds.x) && (np.bounds.X-20 >= npv.bounds.x)))) {
                        above.push({ source: getId(np, N), target: getId(npv, N) });
                    }
                   
                }
            });

        });

       
        var modules = { N: N, ms: [], edges: [], maxwidth: maxwidth.toString(), maxheight: maxheight.toString(), left: left, above: above, xoverlap: xoverlap, yoverlap: yoverlap };
        pgLayout.powerGraph.groups.forEach(g => {
            var m = [];
            expandGroup(g, m);
            modules.ms.push(m);
        });
        pgLayout.powerGraph.powerEdges.forEach(e => {
            modules.edges.push({ source: getId(e.source, N), target: getId(e.target, N) });
        });

    d3.select("#mysoloresults").append("p").text(JSON.stringify(modules));
}

    function alladjacency(callback) {
        var size = [1000, 1000];

        var svg = makeSVG(false, 2000, 2000);


        inputjson.nodes.forEach(v=> {
            v.width = 50;
            v.height = 50;
        });
        var pgLayout = heuristicPowerGraphLayout(inputjson, size);

        var group = svg.selectAll(".group")
            .data(pgLayout.powerGraph.groups)
            .enter().append("rect")
            .attr("rx", 8).attr("ry", 8)
            .attr("class", "group")
            .style("fill", function (d, i) { return color(i); });

        var link = svg.selectAll(".link")
            .data(pgLayout.powerGraph.powerEdges)
            .enter().append("line")
            .attr("class", "link")
            .style("stroke", "black");

        var margin = 10;
        var node = svg.selectAll(".node")
            .data(inputjson.nodes)
            .enter().append("rect")
            .attr("class", "node")
            .attr("width", d=> d.width + 2 * margin)
            .attr("height", d=> d.height + 2 * margin)
            .attr("rx", 4).attr("ry", 4)
            .call(pgLayout.cola.drag);

        var label = svg.selectAll(".label")
            .data(inputjson.nodes)
            .enter().append("text")
            .attr("class", "label")
            .text(d=> d.name).call(pgLayout.cola.drag);

        node.append("title").text(d=> d.name);

        pgLayout.cola.on("tick", function () {
            node.each(function (d) { d.innerBounds = d.bounds.inflate(-margin) });
            group.each(function (d) { d.innerBounds = d.bounds.inflate(-20) });
            link.each(function (d) {
                d.route = cola.vpsc.makeEdgeBetween(d.source.innerBounds, d.target.innerBounds, 5);
                if (isIE()) this.parentNode.insertBefore(this, this);

            });

            link.attr("x1", function (d) { return d.route.sourceIntersection.x; })
                .attr("y1", function (d) { return d.route.sourceIntersection.y; })
                .attr("x2", function (d) { return d.route.targetIntersection.x; })
                .attr("y2", function (d) { return d.route.targetIntersection.y; });

            node.attr("x", function (d) { return d.innerBounds.x; })
                .attr("y", function (d) { return d.innerBounds.y; })
                .attr("width", function (d) { return d.innerBounds.width(); })
                .attr("height", function (d) { return d.innerBounds.height(); });

            group.attr("x", function (d) { return d.innerBounds.x; })
                .attr("y", function (d) { return d.innerBounds.y; })
                .attr("width", function (d) { return d.innerBounds.width(); })
                .attr("height", function (d) { return d.innerBounds.height(); });

            label.attr("x", function (d) { return d.x; })
                .attr("y", function (d) {
                    var h = this.getBBox().height;
                    return d.y + h / 3.5;

                });
        });



        var N = inputjson.nodes.length;

        var noparentnodes = inputjson.nodes.filter(function (nv) {
            return nv.parent == null;
        });
        var parentnodes = inputjson.nodes.filter(nv => nv.parent);

        var noparentgroups = pgLayout.powerGraph.groups.filter(function (ng) {
            return ng.parent == null;
        });
        var parentgroups = pgLayout.powerGraph.groups.filter(ng => ng.parent);

        var left = [];
        var above = [];
        var xoverlap = [];
        var yoverlap = [];

        var myobjects = [];

        noparentnodes.forEach(np => {
            myobjects.push({ id: getId(np, N), x: np.bounds.x + ((np.bounds.X - np.bounds.x) / 2), y: np.bounds.y + ((np.bounds.Y - np.bounds.y) / 2) });
        });

        noparentgroups.forEach(np => {
            myobjects.push({ id: getId(np, N), x: np.bounds.x + ((np.bounds.X - np.bounds.x) / 2), y: np.bounds.y + ((np.bounds.Y - np.bounds.y) / 2) });
        });

        myobjects.sort(function (a, b) { return parseFloat(a.x) - parseFloat(b.x) });
        //-1 because we take pairs
        for (var i = 0; i < myobjects.length - 1; i++) {
            left.push({
                source: myobjects[i].id, target: myobjects[i + 1].id
            });
        }
        myobjects.sort(function (a, b) { return parseFloat(a.y) - parseFloat(b.y) });
        //-1 because we take pairs
        for (var i = 0; i < myobjects.length - 1; i++) {
            above.push({
                source: myobjects[i].id, target: myobjects[i + 1].id
            });
        }

        var myobjects = [];
        //if not middle ordinate change x+((X-x)/2) to x or X depending on starting or end point
        parentgroups.forEach(np => {
            var myobjects = [];
            myobjects.push({ id: getId(np, N), x: np.bounds.x + ((np.bounds.X - np.bounds.x) / 2), y: np.bounds.y + ((np.bounds.Y - np.bounds.y) / 2) });
            parentgroups.forEach(npp => {
                if ((getId(npp, N) != getId(np, N)) && (getId(npp.parent, N) == getId(np.parent, N))) {
                    myobjects.push({ id: getId(npp, N), x: npp.bounds.x + ((npp.bounds.X - npp.bounds.x) / 2), y: npp.bounds.y + ((npp.bounds.Y - npp.bounds.y) / 2) });
                }
            });
            parentnodes.forEach(npv => {
                if (getId(npv.parent, N) == getId(np.parent, N)) {
                    myobjects.push({ id: getId(npv, N), x: npv.bounds.x + ((npv.bounds.X - npv.bounds.x) / 2), y: npv.bounds.y + ((npv.bounds.Y - npv.bounds.y) / 2) });
                }
            });

            myobjects.sort(function (a, b) { return parseFloat(a.x) - parseFloat(b.x) });
            //-1 because we take pairs
            for (var i = 0; i < myobjects.length - 1; i++) {
                left.push({
                    source: myobjects[i].id, target: myobjects[i + 1].id
                });
            }
            myobjects.sort(function (a, b) { return parseFloat(a.y) - parseFloat(b.y) });
            //-1 because we take pairs
            for (var i = 0; i < myobjects.length - 1; i++) {
                above.push({
                    source: myobjects[i].id, target: myobjects[i + 1].id
                });
            }
        });

        var myobjects = [];
        parentnodes.forEach(np => {
            var myobjects = [];
            myobjects.push({ id: getId(np, N), x: np.bounds.x + ((np.bounds.X - np.bounds.x) / 2), y: np.bounds.y + ((np.bounds.Y - np.bounds.y) / 2) });
            parentgroups.forEach(npp => {
                if  (getId(npp.parent, N) == getId(np.parent, N)) {
                    myobjects.push({ id: getId(npp, N), x: npp.bounds.x + ((npp.bounds.X - npp.bounds.x) / 2), y: npp.bounds.y + ((npp.bounds.Y - npp.bounds.y) / 2) });
                }
            });
            parentnodes.forEach(npv => {
                if ((getId(npv, N) != getId(np, N)) && (getId(npv.parent, N) == getId(np.parent, N))) {
                    myobjects.push({ id: getId(npv, N), x: npv.bounds.x + ((npv.bounds.X - npv.bounds.x) / 2), y: npv.bounds.y + ((npv.bounds.Y - npv.bounds.y) / 2) });
                }
            });

            myobjects.sort(function (a, b) { return parseFloat(a.x) - parseFloat(b.x) });
            //-1 because we take pairs
            for (var i = 0; i < myobjects.length - 1; i++) {
                left.push({
                    source: myobjects[i].id, target: myobjects[i + 1].id
                });
            }
            myobjects.sort(function (a, b) { return parseFloat(a.y) - parseFloat(b.y) });
            //-1 because we take pairs
            for (var i = 0; i < myobjects.length - 1; i++) {
                above.push({
                    source: myobjects[i].id, target: myobjects[i + 1].id
                });
            }
        });


        var modules = { N: N, ms: [], edges: [], maxwidth: maxwidth.toString(), maxheight: maxheight.toString(), left: left, above: above };
        pgLayout.powerGraph.groups.forEach(g => {
            var m = [];
            expandGroup(g, m);
            modules.ms.push(m);
        });
        pgLayout.powerGraph.powerEdges.forEach(e => {
            modules.edges.push({ source: getId(e.source, N), target: getId(e.target, N) });
        });

        d3.select("#mysoloresults").append("p").text(JSON.stringify(modules));
    }

d3.select("#HybridizeButton").on("click", function () {
    d3.select("#mysoloresults").html("");
    inputjson = JSON.parse($('textarea[id=inputjsontext]').val());
    d3.select("#mysoloresults").append("p").text(JSON.stringify(inputjson));
    powerGraph2(function () { });
});
    //graph 50 1
    //var inputjson = JSON.parse('{"nodes":[{"name":"0"},{"name":"1"},{"name":"2"},{"name":"3"},{"name":"4"},{"name":"5"},{"name":"6"},{"name":"7"},{"name":"8"},{"name":"9"},{"name":"10"},{"name":"11"},{"name":"12"},{"name":"13"},{"name":"14"},{"name":"15"},{"name":"16"},{"name":"17"},{"name":"18"},{"name":"19"},{"name":"20"},{"name":"21"},{"name":"22"},{"name":"23"},{"name":"24"},{"name":"25"},{"name":"26"},{"name":"27"},{"name":"28"},{"name":"29"},{"name":"30"},{"name":"31"},{"name":"32"},{"name":"33"},{"name":"34"},{"name":"35"},{"name":"36"},{"name":"37"},{"name":"38"},{"name":"39"},{"name":"40"},{"name":"41"},{"name":"42"},{"name":"43"},{"name":"44"},{"name":"45"},{"name":"46"},{"name":"47"},{"name":"48"},{"name":"49"}],"links":[{"source":0,"target":31},{"source":0,"target":6},{"source":0,"target":5},{"source":0,"target":1},{"source":1,"target":10},{"source":1,"target":40},{"source":1,"target":4},{"source":1,"target":2},{"source":1,"target":0},{"source":2,"target":14},{"source":2,"target":24},{"source":2,"target":7},{"source":2,"target":6},{"source":2,"target":3},{"source":2,"target":1},{"source":3,"target":19},{"source":3,"target":11},{"source":3,"target":9},{"source":3,"target":8},{"source":3,"target":2},{"source":4,"target":17},{"source":4,"target":11},{"source":4,"target":35},{"source":4,"target":1},{"source":5,"target":26},{"source":5,"target":9},{"source":5,"target":0},{"source":6,"target":27},{"source":6,"target":2},{"source":6,"target":0},{"source":7,"target":2},{"source":8,"target":3},{"source":9,"target":22},{"source":9,"target":15},{"source":9,"target":27},{"source":9,"target":43},{"source":9,"target":3},{"source":9,"target":5},{"source":10,"target":20},{"source":10,"target":16},{"source":10,"target":14},{"source":10,"target":42},{"source":10,"target":1},{"source":10,"target":39},{"source":11,"target":13},{"source":11,"target":12},{"source":11,"target":33},{"source":11,"target":28},{"source":11,"target":3},{"source":11,"target":4},{"source":12,"target":14},{"source":12,"target":47},{"source":12,"target":11},{"source":13,"target":18},{"source":13,"target":34},{"source":13,"target":25},{"source":13,"target":11},{"source":14,"target":12},{"source":14,"target":2},{"source":14,"target":10},{"source":15,"target":28},{"source":15,"target":9},{"source":16,"target":45},{"source":16,"target":10},{"source":17,"target":21},{"source":17,"target":4},{"source":17,"target":49},{"source":17,"target":48},{"source":17,"target":29},{"source":18,"target":13},{"source":19,"target":3},{"source":20,"target":10},{"source":21,"target":17},{"source":22,"target":23},{"source":22,"target":32},{"source":22,"target":9},{"source":23,"target":22},{"source":24,"target":37},{"source":24,"target":2},{"source":25,"target":13},{"source":26,"target":5},{"source":27,"target":31},{"source":27,"target":30},{"source":27,"target":44},{"source":27,"target":34},{"source":27,"target":6},{"source":27,"target":9},{"source":28,"target":15},{"source":28,"target":11},{"source":28,"target":46},{"source":29,"target":17},{"source":29,"target":41},{"source":30,"target":36},{"source":30,"target":27},{"source":31,"target":0},{"source":31,"target":27},{"source":32,"target":22},{"source":33,"target":38},{"source":33,"target":11},{"source":34,"target":13},{"source":34,"target":27},{"source":35,"target":4},{"source":36,"target":30},{"source":37,"target":24},{"source":38,"target":33},{"source":39,"target":10},{"source":40,"target":1},{"source":41,"target":29},{"source":42,"target":10},{"source":43,"target":9},{"source":44,"target":27},{"source":45,"target":16},{"source":46,"target":28},{"source":47,"target":12},{"source":48,"target":17},{"source":49,"target":17}]}');
    //powerGraph2(function () { });

var inputjson;
//d3.json('graphdata/n7e23.json', function (error, graph) {
//    inputjson = graph;
//    powerGraph2(function () { });
//    });

    //graph 50 2
    inputjson = JSON.parse('{     "nodes":[       {"name":"0"},       {"name":"1"},       {"name":"2"},       {"name":"3"},       {"name":"4"},       {"name":"5"},       {"name":"6"},       {"name":"7"},       {"name":"8"},       {"name":"9"},       {"name":"10"},       {"name":"11"},       {"name":"12"},       {"name":"13"},       {"name":"14"},       {"name":"15"},       {"name":"16"},       {"name":"17"},       {"name":"18"},       {"name":"19"},       {"name":"20"},       {"name":"21"},       {"name":"22"},       {"name":"23"},       {"name":"24"},       {"name":"25"},       {"name":"26"},       {"name":"27"},       {"name":"28"},       {"name":"29"},       {"name":"30"},       {"name":"31"},       {"name":"32"},       {"name":"33"},       {"name":"34"},       {"name":"35"},       {"name":"36"},       {"name":"37"},       {"name":"38"},       {"name":"39"},       {"name":"40"},       {"name":"41"},       {"name":"42"},       {"name":"43"},       {"name":"44"},       {"name":"45"},       {"name":"46"},       {"name":"47"},       {"name":"48"},       {"name":"49"}     ],     "links":[       {"source": 0, "target": 10},       {"source": 0, "target": 5},       {"source": 0, "target": 2},       {"source": 0, "target": 1},       {"source": 1, "target": 14},       {"source": 1, "target": 23},       {"source": 1, "target": 13},       {"source": 1, "target": 33},       {"source": 1, "target": 7},       {"source": 1, "target": 4},       {"source": 1, "target": 42},       {"source": 1, "target": 3},       {"source": 1, "target": 2},       {"source": 1, "target": 46},       {"source": 1, "target": 0},       {"source": 2, "target": 24},       {"source": 2, "target": 20},       {"source": 2, "target": 35},       {"source": 2, "target": 3},       {"source": 2, "target": 1},       {"source": 2, "target": 0},       {"source": 3, "target": 15},       {"source": 3, "target": 19},       {"source": 3, "target": 12},       {"source": 3, "target": 10},       {"source": 3, "target": 5},       {"source": 3, "target": 2},       {"source": 3, "target": 1},       {"source": 4, "target": 11},       {"source": 4, "target": 1},       {"source": 4, "target": 40},       {"source": 5, "target": 16},       {"source": 5, "target": 30},       {"source": 5, "target": 29},       {"source": 5, "target": 28},       {"source": 5, "target": 9},       {"source": 5, "target": 8},       {"source": 5, "target": 31},       {"source": 5, "target": 6},       {"source": 5, "target": 0},       {"source": 5, "target": 3},       {"source": 6, "target": 5},       {"source": 7, "target": 37},       {"source": 7, "target": 1},       {"source": 8, "target": 18},       {"source": 8, "target": 17},       {"source": 8, "target": 5},       {"source": 9, "target": 5},       {"source": 10, "target": 21},       {"source": 10, "target": 36},       {"source": 10, "target": 3},       {"source": 10, "target": 0},       {"source": 11, "target": 20},       {"source": 11, "target": 4},       {"source": 12, "target": 25},       {"source": 12, "target": 3},       {"source": 13, "target": 14},       {"source": 13, "target": 27},       {"source": 13, "target": 1},       {"source": 14, "target": 49},       {"source": 14, "target": 45},       {"source": 14, "target": 1},       {"source": 14, "target": 13},       {"source": 14, "target": 30},       {"source": 14, "target": 26},       {"source": 15, "target": 3},       {"source": 16, "target": 5},       {"source": 17, "target": 22},       {"source": 17, "target": 20},       {"source": 17, "target": 18},       {"source": 17, "target": 8},       {"source": 18, "target": 19},       {"source": 18, "target": 17},       {"source": 18, "target": 8},       {"source": 18, "target": 47},       {"source": 18, "target": 41},       {"source": 19, "target": 18},       {"source": 19, "target": 39},       {"source": 19, "target": 3},       {"source": 20, "target": 24},       {"source": 20, "target": 2},       {"source": 20, "target": 17},       {"source": 20, "target": 11},       {"source": 21, "target": 10},       {"source": 22, "target": 26},       {"source": 22, "target": 17},       {"source": 23, "target": 1},       {"source": 24, "target": 48},       {"source": 24, "target": 2},       {"source": 24, "target": 20},       {"source": 25, "target": 12},       {"source": 26, "target": 14},       {"source": 26, "target": 38},       {"source": 26, "target": 22},       {"source": 27, "target": 34},       {"source": 27, "target": 13},       {"source": 28, "target": 32},       {"source": 28, "target": 5},       {"source": 29, "target": 5},       {"source": 30, "target": 14},       {"source": 30, "target": 5},       {"source": 31, "target": 5},       {"source": 32, "target": 28},       {"source": 33, "target": 36},       {"source": 33, "target": 43},       {"source": 33, "target": 1},       {"source": 34, "target": 27},       {"source": 35, "target": 2},       {"source": 35, "target": 44},       {"source": 36, "target": 10},       {"source": 36, "target": 33},       {"source": 37, "target": 7},       {"source": 38, "target": 26},       {"source": 39, "target": 19},       {"source": 40, "target": 4},       {"source": 41, "target": 18},       {"source": 42, "target": 1},       {"source": 43, "target": 33},       {"source": 44, "target": 35},       {"source": 45, "target": 14},       {"source": 46, "target": 1},       {"source": 47, "target": 18},       {"source": 48, "target": 24},       {"source": 49, "target": 14}     ] }');
    powerGraph2(function () { });

    //graph 50 3
    //inputjson = JSON.parse('{     "nodes":[       {"name":"0"},       {"name":"1"},       {"name":"2"},       {"name":"3"},       {"name":"4"},       {"name":"5"},       {"name":"6"},       {"name":"7"},       {"name":"8"},       {"name":"9"},       {"name":"10"},       {"name":"11"},       {"name":"12"},       {"name":"13"},       {"name":"14"},       {"name":"15"},       {"name":"16"},       {"name":"17"},       {"name":"18"},       {"name":"19"},       {"name":"20"},       {"name":"21"},       {"name":"22"},       {"name":"23"},       {"name":"24"},       {"name":"25"},       {"name":"26"},       {"name":"27"},       {"name":"28"},       {"name":"29"},       {"name":"30"},       {"name":"31"},       {"name":"32"},       {"name":"33"},       {"name":"34"},       {"name":"35"},       {"name":"36"},       {"name":"37"},       {"name":"38"},       {"name":"39"},       {"name":"40"},       {"name":"41"},       {"name":"42"},       {"name":"43"},       {"name":"44"},       {"name":"45"},       {"name":"46"},       {"name":"47"},       {"name":"48"},       {"name":"49"}     ],     "links":[       {"source": 0, "target": 10},       {"source": 0, "target": 7},       {"source": 0, "target": 31},       {"source": 0, "target": 3},       {"source": 0, "target": 2},       {"source": 0, "target": 1},       {"source": 1, "target": 22},       {"source": 1, "target": 13},       {"source": 1, "target": 28},       {"source": 1, "target": 24},       {"source": 1, "target": 33},       {"source": 1, "target": 6},       {"source": 1, "target": 5},       {"source": 1, "target": 40},       {"source": 1, "target": 2},       {"source": 1, "target": 0},       {"source": 2, "target": 9},       {"source": 2, "target": 38},       {"source": 2, "target": 4},       {"source": 2, "target": 0},       {"source": 2, "target": 1},       {"source": 3, "target": 16},       {"source": 3, "target": 30},       {"source": 3, "target": 0},       {"source": 4, "target": 29},       {"source": 4, "target": 2},       {"source": 5, "target": 26},       {"source": 5, "target": 39},       {"source": 5, "target": 1},       {"source": 6, "target": 27},       {"source": 6, "target": 25},       {"source": 6, "target": 9},       {"source": 6, "target": 1},       {"source": 7, "target": 11},       {"source": 7, "target": 8},       {"source": 7, "target": 0},       {"source": 8, "target": 7},       {"source": 9, "target": 10},       {"source": 9, "target": 6},       {"source": 9, "target": 2},       {"source": 10, "target": 20},       {"source": 10, "target": 18},       {"source": 10, "target": 16},       {"source": 10, "target": 9},       {"source": 10, "target": 0},       {"source": 11, "target": 17},       {"source": 11, "target": 15},       {"source": 11, "target": 12},       {"source": 11, "target": 42},       {"source": 11, "target": 7},       {"source": 12, "target": 11},       {"source": 13, "target": 14},       {"source": 13, "target": 34},       {"source": 13, "target": 1},       {"source": 14, "target": 21},       {"source": 14, "target": 13},       {"source": 15, "target": 19},       {"source": 15, "target": 11},       {"source": 16, "target": 44},       {"source": 16, "target": 3},       {"source": 16, "target": 23},       {"source": 16, "target": 10},       {"source": 17, "target": 36},       {"source": 17, "target": 11},       {"source": 18, "target": 43},       {"source": 18, "target": 24},       {"source": 18, "target": 10},       {"source": 19, "target": 15},       {"source": 20, "target": 10},       {"source": 21, "target": 14},       {"source": 22, "target": 1},       {"source": 23, "target": 16},       {"source": 23, "target": 35},       {"source": 24, "target": 18},       {"source": 24, "target": 32},       {"source": 24, "target": 1},       {"source": 25, "target": 6},       {"source": 26, "target": 5},       {"source": 27, "target": 6},       {"source": 28, "target": 1},       {"source": 29, "target": 46},       {"source": 29, "target": 4},       {"source": 30, "target": 49},       {"source": 30, "target": 3},       {"source": 31, "target": 0},       {"source": 31, "target": 41},       {"source": 32, "target": 24},       {"source": 33, "target": 1},       {"source": 34, "target": 13},       {"source": 35, "target": 23},       {"source": 35, "target": 48},       {"source": 36, "target": 17},       {"source": 36, "target": 37},       {"source": 37, "target": 47},       {"source": 37, "target": 36},       {"source": 38, "target": 2},       {"source": 39, "target": 5},       {"source": 40, "target": 1},       {"source": 41, "target": 31},       {"source": 42, "target": 11},       {"source": 42, "target": 45},       {"source": 43, "target": 18},       {"source": 44, "target": 16},       {"source": 45, "target": 42},       {"source": 46, "target": 29},       {"source": 47, "target": 37},       {"source": 48, "target": 35},       {"source": 49, "target": 30}     ] }');
    //powerGraph2(function () { });

    //grpah 50 4
    //inputjson = JSON.parse('{     "nodes":[       {"name":"0"},       {"name":"1"},       {"name":"2"},       {"name":"3"},       {"name":"4"},       {"name":"5"},       {"name":"6"},       {"name":"7"},       {"name":"8"},       {"name":"9"},       {"name":"10"},       {"name":"11"},       {"name":"12"},       {"name":"13"},       {"name":"14"},       {"name":"15"},       {"name":"16"},       {"name":"17"},       {"name":"18"},       {"name":"19"},       {"name":"20"},       {"name":"21"},       {"name":"22"},       {"name":"23"},       {"name":"24"},       {"name":"25"},       {"name":"26"},       {"name":"27"},       {"name":"28"},       {"name":"29"},       {"name":"30"},       {"name":"31"},       {"name":"32"},       {"name":"33"},       {"name":"34"},       {"name":"35"},       {"name":"36"},       {"name":"37"},       {"name":"38"},       {"name":"39"},       {"name":"40"},       {"name":"41"},       {"name":"42"},       {"name":"43"},       {"name":"44"},       {"name":"45"},       {"name":"46"},       {"name":"47"},       {"name":"48"},       {"name":"49"}     ],     "links":[       {"source": 0, "target": 20},       {"source": 0, "target": 13},       {"source": 0, "target": 12},       {"source": 0, "target": 30},       {"source": 0, "target": 23},       {"source": 0, "target": 10},       {"source": 0, "target": 6},       {"source": 0, "target": 3},       {"source": 0, "target": 2},       {"source": 0, "target": 1},       {"source": 0, "target": 48},       {"source": 1, "target": 17},       {"source": 1, "target": 0},       {"source": 2, "target": 11},       {"source": 2, "target": 8},       {"source": 2, "target": 5},       {"source": 2, "target": 41},       {"source": 2, "target": 0},       {"source": 3, "target": 22},       {"source": 3, "target": 19},       {"source": 3, "target": 27},       {"source": 3, "target": 8},       {"source": 3, "target": 4},       {"source": 3, "target": 0},       {"source": 4, "target": 15},       {"source": 4, "target": 38},       {"source": 4, "target": 3},       {"source": 5, "target": 9},       {"source": 5, "target": 35},       {"source": 5, "target": 2},       {"source": 6, "target": 7},       {"source": 6, "target": 0},       {"source": 6, "target": 45},       {"source": 7, "target": 6},       {"source": 8, "target": 21},       {"source": 8, "target": 18},       {"source": 8, "target": 17},       {"source": 8, "target": 14},       {"source": 8, "target": 25},       {"source": 8, "target": 24},       {"source": 8, "target": 47},       {"source": 8, "target": 2},       {"source": 8, "target": 37},       {"source": 8, "target": 3},       {"source": 9, "target": 16},       {"source": 9, "target": 5},       {"source": 10, "target": 13},       {"source": 10, "target": 0},       {"source": 10, "target": 34},       {"source": 11, "target": 32},       {"source": 11, "target": 2},       {"source": 12, "target": 0},       {"source": 13, "target": 0},       {"source": 13, "target": 39},       {"source": 13, "target": 10},       {"source": 14, "target": 26},       {"source": 14, "target": 42},       {"source": 14, "target": 31},       {"source": 14, "target": 8},       {"source": 15, "target": 4},       {"source": 16, "target": 9},       {"source": 17, "target": 40},       {"source": 17, "target": 8},       {"source": 17, "target": 1},       {"source": 18, "target": 33},       {"source": 18, "target": 8},       {"source": 19, "target": 3},       {"source": 20, "target": 21},       {"source": 20, "target": 0},       {"source": 21, "target": 36},       {"source": 21, "target": 8},       {"source": 21, "target": 20},       {"source": 22, "target": 3},       {"source": 23, "target": 0},       {"source": 24, "target": 29},       {"source": 24, "target": 44},       {"source": 24, "target": 8},       {"source": 25, "target": 28},       {"source": 25, "target": 26},       {"source": 25, "target": 8},       {"source": 26, "target": 14},       {"source": 26, "target": 25},       {"source": 27, "target": 3},       {"source": 28, "target": 25},       {"source": 29, "target": 24},       {"source": 30, "target": 0},       {"source": 31, "target": 14},       {"source": 32, "target": 11},       {"source": 33, "target": 18},       {"source": 33, "target": 34},       {"source": 33, "target": 43},       {"source": 34, "target": 10},       {"source": 34, "target": 33},       {"source": 35, "target": 5},       {"source": 36, "target": 21},       {"source": 37, "target": 8},       {"source": 38, "target": 4},       {"source": 39, "target": 13},       {"source": 40, "target": 17},       {"source": 40, "target": 49},       {"source": 41, "target": 2},       {"source": 41, "target": 46},       {"source": 42, "target": 14},       {"source": 43, "target": 33},       {"source": 44, "target": 24},       {"source": 45, "target": 6},       {"source": 46, "target": 41},       {"source": 47, "target": 8},       {"source": 48, "target": 0},       {"source": 49, "target": 40}     ] }');
    //powerGraph2(function () { });

    //graph 50 5
    //inputjson = JSON.parse('{     "nodes":[       {"name":"0"},       {"name":"1"},       {"name":"2"},       {"name":"3"},       {"name":"4"},       {"name":"5"},       {"name":"6"},       {"name":"7"},       {"name":"8"},       {"name":"9"},       {"name":"10"},       {"name":"11"},       {"name":"12"},       {"name":"13"},       {"name":"14"},       {"name":"15"},       {"name":"16"},       {"name":"17"},       {"name":"18"},       {"name":"19"},       {"name":"20"},       {"name":"21"},       {"name":"22"},       {"name":"23"},       {"name":"24"},       {"name":"25"},       {"name":"26"},       {"name":"27"},       {"name":"28"},       {"name":"29"},       {"name":"30"},       {"name":"31"},       {"name":"32"},       {"name":"33"},       {"name":"34"},       {"name":"35"},       {"name":"36"},       {"name":"37"},       {"name":"38"},       {"name":"39"},       {"name":"40"},       {"name":"41"},       {"name":"42"},       {"name":"43"},       {"name":"44"},       {"name":"45"},       {"name":"46"},       {"name":"47"},       {"name":"48"},       {"name":"49"}     ],     "links":[       {"source": 0, "target": 15},       {"source": 0, "target": 14},       {"source": 0, "target": 19},       {"source": 0, "target": 13},       {"source": 0, "target": 7},       {"source": 0, "target": 6},       {"source": 0, "target": 3},       {"source": 0, "target": 2},       {"source": 0, "target": 1},       {"source": 1, "target": 11},       {"source": 1, "target": 5},       {"source": 1, "target": 2},       {"source": 1, "target": 0},       {"source": 2, "target": 16},       {"source": 2, "target": 15},       {"source": 2, "target": 14},       {"source": 2, "target": 22},       {"source": 2, "target": 9},       {"source": 2, "target": 8},       {"source": 2, "target": 39},       {"source": 2, "target": 36},       {"source": 2, "target": 5},       {"source": 2, "target": 3},       {"source": 2, "target": 0},       {"source": 2, "target": 1},       {"source": 3, "target": 12},       {"source": 3, "target": 38},       {"source": 3, "target": 4},       {"source": 3, "target": 2},       {"source": 3, "target": 0},       {"source": 4, "target": 28},       {"source": 4, "target": 23},       {"source": 4, "target": 3},       {"source": 5, "target": 8},       {"source": 5, "target": 1},       {"source": 5, "target": 2},       {"source": 6, "target": 24},       {"source": 6, "target": 0},       {"source": 7, "target": 0},       {"source": 8, "target": 20},       {"source": 8, "target": 10},       {"source": 8, "target": 5},       {"source": 8, "target": 2},       {"source": 9, "target": 17},       {"source": 9, "target": 45},       {"source": 9, "target": 2},       {"source": 10, "target": 18},       {"source": 10, "target": 23},       {"source": 10, "target": 11},       {"source": 10, "target": 35},       {"source": 10, "target": 46},       {"source": 10, "target": 44},       {"source": 10, "target": 8},       {"source": 11, "target": 10},       {"source": 11, "target": 42},       {"source": 11, "target": 1},       {"source": 12, "target": 15},       {"source": 12, "target": 3},       {"source": 13, "target": 19},       {"source": 13, "target": 0},       {"source": 14, "target": 43},       {"source": 14, "target": 0},       {"source": 14, "target": 25},       {"source": 14, "target": 2},       {"source": 15, "target": 34},       {"source": 15, "target": 2},       {"source": 15, "target": 0},       {"source": 15, "target": 12},       {"source": 16, "target": 21},       {"source": 16, "target": 2},       {"source": 17, "target": 9},       {"source": 18, "target": 29},       {"source": 18, "target": 10},       {"source": 18, "target": 23},       {"source": 18, "target": 33},       {"source": 18, "target": 26},       {"source": 19, "target": 22},       {"source": 19, "target": 13},       {"source": 19, "target": 0},       {"source": 20, "target": 8},       {"source": 21, "target": 16},       {"source": 22, "target": 30},       {"source": 22, "target": 19},       {"source": 22, "target": 2},       {"source": 23, "target": 18},       {"source": 23, "target": 10},       {"source": 23, "target": 4},       {"source": 24, "target": 6},       {"source": 25, "target": 14},       {"source": 25, "target": 27},       {"source": 26, "target": 18},       {"source": 27, "target": 31},       {"source": 27, "target": 25},       {"source": 28, "target": 32},       {"source": 28, "target": 4},       {"source": 29, "target": 18},       {"source": 29, "target": 47},       {"source": 29, "target": 41},       {"source": 30, "target": 22},       {"source": 31, "target": 27},       {"source": 32, "target": 28},       {"source": 33, "target": 18},       {"source": 34, "target": 15},       {"source": 35, "target": 10},       {"source": 36, "target": 37},       {"source": 36, "target": 2},       {"source": 37, "target": 39},       {"source": 37, "target": 48},       {"source": 37, "target": 36},       {"source": 38, "target": 40},       {"source": 38, "target": 3},       {"source": 39, "target": 37},       {"source": 39, "target": 2},       {"source": 40, "target": 38},       {"source": 41, "target": 29},       {"source": 42, "target": 11},       {"source": 42, "target": 49},       {"source": 43, "target": 14},       {"source": 44, "target": 10},       {"source": 45, "target": 9},       {"source": 46, "target": 10},       {"source": 47, "target": 29},       {"source": 48, "target": 37},       {"source": 49, "target": 42}     ] }');
    //powerGraph2(function () { });
    //alladjacency(function () { });
   // flatGraph();

}