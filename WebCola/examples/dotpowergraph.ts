///<reference path="../extern/d3.d.ts"/>
///<reference path="../src/layout.ts"/>
///<reference path="../src/d3adaptor.ts"/>
///<reference path="../src/vpsc.ts"/>
///<reference path="../src/rectangle.ts"/>
///<reference path="../src/gridrouter.ts"/>
///<reference path="../src/geom.ts"/>
///<reference path="../extern/jquery.d.ts"/>
var graphlibDot: any;

module dotpowergraph {
    var color = d3.scale.category10();

    function makeSVG(addGridLines, mywidth, myheight) {
        var svg = d3.select("#mysoloresults").append("svg")
            .attr("width", mywidth)
            .attr("height", myheight);
        // define arrow markers for graph links
        svg.append('svg:defs').append('svg:marker')
            .attr('id', 'end-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 5)
            .attr('markerWidth', 3)
            .attr('markerHeight', 3)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M0,-5L10,0L0,5L2,0')
            .attr('stroke-width', '0px')

        return svg;
    }

    function getId(v, n) {
        return (typeof v.index === 'number' ? v.index : v.id + n) + 1;
    }

    function isIE() { return ((navigator.appName == 'Microsoft Internet Explorer') || ((navigator.appName == 'Netscape') && (new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})").exec(navigator.userAgent) != null))); }

    function heuristicPowerGraphLayout(graph, size, grouppadding) {
        // compute power graph
        var powerGraph;
        var d3cola = cola.d3adaptor()
            .avoidOverlaps(false)
            .nodes(graph.nodes)
            .links(graph.links)
            .powerGraphGroups(function (d) {
            powerGraph = d;
            powerGraph.groups.forEach(v=> v.padding = grouppadding);
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
        d3cola = cola.d3adaptor()
            .size(size)
            .nodes(vs)
            .links(edges)
            .avoidOverlaps(false)
            .symmetricDiffLinkLengths(5)
            .start(100);

        // final layout taking node positions from above as starting positions
        // subject to group containment constraints
        d3cola = cola.d3adaptor()
            .size(size)
            .avoidOverlaps(true)
            .nodes(graph.nodes)
            .links(graph.links)
        //.flowLayout('y', 30)
            .groupCompactness(1e-4)
            .symmetricDiffLinkLengths(3)
            .powerGraphGroups(function (d) {
                powerGraph = d;
                powerGraph.groups.forEach(function (v) {
                    v.padding = grouppadding
                });
            }).start(50, 0, 50);
        return { cola: d3cola, powerGraph: powerGraph };
    }

    function createPowerGraph(inputjson) {
        var size = [700, 700];

        var svg = makeSVG(false, size[0], size[1]);
        var grouppadding = 0.01;

        inputjson.nodes.forEach(v=> {
            v.width = 70;
            v.height = 70;
        });

        var pgLayout = heuristicPowerGraphLayout(inputjson, size, grouppadding);

        // filter duplicate links:
        //var es = pgLayout.powerGraph.powerEdges;
        //var copy = [];
        //var n = pgLayout.cola.nodes().length;

        //for (var i = 0; i < es.length; i++) {
        //    var e = es[i];
        //    var dupFound = false;
        //    for (var j = i + 1; j < es.length; j++) {
        //        var f = es[j];
        //        dupFound = ((getId(e.source, n) == getId(f.source, n)) && (getId(e.target, n) == getId(f.target, n)))
        //        || ((getId(e.target, n) == getId(f.source, n)) && (getId(e.source, n) == getId(f.target, n)));
        //        if (dupFound) break;
        //    }
        //    if (!dupFound) copy.push(e);
        //}
        //pgLayout.powerGraph.powerEdges = copy;

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

        var margin = 20;
        var groupMargin = 15;
        var node = svg.selectAll(".node")
            .data(inputjson.nodes)
            .enter().append("rect")
            .attr("class", "node")
            .attr("rx", 4).attr("ry", 4)
            .call((<cola.D3StyleLayoutAdaptor>pgLayout.cola).drag);

        var label = svg.selectAll(".label")
            .data(inputjson.nodes)
            .enter().append("text")
            .attr("class", "label")
            .text(d=> d.name.replace(/^u/,'')).call((<cola.D3StyleLayoutAdaptor>pgLayout.cola).drag);

        node.append("title").text(d=> d.name);

        pgLayout.cola.on("tick", function () {
            node.each(function (d) { d.innerBounds = d.bounds.inflate(-margin) });
            group.each(function (d) { d.innerBounds = d.bounds.inflate(-groupMargin) });
            link.each(function (d) {
                cola.vpsc.makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
                if (isIE()) this.parentNode.insertBefore(this, this);

            });

            link.attr("x1", function (d) { return d.sourceIntersection.x; })
                .attr("y1", function (d) { return d.sourceIntersection.y; })
                .attr("x2", function (d) { return d.targetIntersection.x; })
                .attr("y2", function (d) { return d.targetIntersection.y; });

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
            var cc = cola.d3adaptor()
                .size(size)
                .avoidOverlaps(true)
                .nodes(pgLayout.cola.nodes())
                .links(pgLayout.cola.links())
            //.flowLayout('y', 30)
                .groupCompactness(1e-4)
                .symmetricDiffLinkLengths(3)
                .powerGraphGroups(function (d) {
                    d.groups.forEach(function (v) {
                    v.padding = grouppadding
                });
                }).start(0, 0, 50, 50);
            node.each(function (d) { d.innerBounds = d.bounds.inflate(-margin) });
            group.each(function (d) { d.innerBounds = d.bounds.inflate(-groupMargin) });
            label.transition().attr("x", function (d) { return d.innerBounds.cx(); })
                .attr("y", function (d) {
                var h = this.getBBox().height;
                return d.innerBounds.cy() + h / 3.5;
            });

            node.transition().attr("x", function (d) { return d.innerBounds.x; })
                .attr("y", function (d) { return d.innerBounds.y; })
                .attr("width", function (d) { return d.innerBounds.width(); })
                .attr("height", function (d) { return d.innerBounds.height(); });
            svg.selectAll(".link").remove();
            svg.selectAll("path").remove();
            var n = pgLayout.cola.nodes().length,
                _id = v => getId(v, n) - 1,
                g = {
                    nodes: pgLayout.cola.nodes().map((d: any)=> <any>{
                        id: _id(d),
                        name: d.name,
                        bounds: new cola.vpsc.Rectangle(d.innerBounds.x, d.innerBounds.X, d.innerBounds.y, d.innerBounds.Y)
                    }).concat(
                        pgLayout.powerGraph.groups.map(d=> <any>{
                            id: _id(d),
                            bounds: new cola.vpsc.Rectangle(d.innerBounds.x, d.innerBounds.X, d.innerBounds.y, d.innerBounds.Y),
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
                getChildren: v => v.children,
                getBounds: v => v.bounds},
                margin - groupMargin);

            var gs = gridrouter.groups;
            group.transition().attr('x',(g, i) => gs[i].rect.x).attr('y',(g, i) => gs[i].rect.y)
                .attr('width',(g, i) => gs[i].rect.width()).attr('height',(g, i) => gs[i].rect.height())
                .style("fill",(g, i) => color(i));
            var routes = gridrouter.routeEdges<any>(g.edges, 5, e=> e.source, e=> e.target);
            routes.forEach(route => {
                var cornerradius = 5;
                var arrowwidth = 3;
                var arrowheight = 7;
                var p = cola.GridRouter.getRoutePath(route, cornerradius, arrowwidth, arrowheight);
                var c = color(0);
                var linewidth = 2;
                if (arrowheight > 0) {
                    svg.append('path')
                        .attr('d', p.arrowpath + ' Z')
                        .attr('stroke', '#550000')
                        .attr('stroke-width', 2);
                    svg.append('path')
                        .attr('d', p.arrowpath)
                        .attr('stroke', 'none')
                        .attr('fill', c);
                }
                svg.append('path')
                    .attr('d', p.routepath)
                    .attr('fill', 'none')
                    .attr('stroke', '#550000')
                    .attr('stroke-width', linewidth + 2);
                svg.append('path')
                    .attr('d', p.routepath)
                    .attr('fill', 'none')
                    .attr('stroke', c)
                    .attr('stroke-width', linewidth);
            });
        });
    }

    d3.text("graphdata/n26e35.dot", function (f) {
        var digraph = graphlibDot.parse(f);

        var nodeNames = digraph.nodes();
        var nodes = new Array(nodeNames.length);
        nodeNames.forEach(function (name, i) {
            var v = nodes[i] = digraph._nodes[nodeNames[i]];
            v.id = i;
            v.name = name;
        });

        var edges = [];
        for (var e in digraph._edges) {
            var edge = digraph._edges[e];
            edges.push({ source: digraph._nodes[edge.u].id, target: digraph._nodes[edge.v].id });
        }
        createPowerGraph({ nodes: nodes, links: edges });
    });
}
