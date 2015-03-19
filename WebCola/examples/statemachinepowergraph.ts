///<reference path="../src/vpsc.ts"/>
///<reference path="../src/rectangle.ts"/>
///<reference path="../src/gridrouter.ts"/>
///<reference path="../src/layout.ts"/>
///<reference path="../extern/jquery.d.ts"/>
///<reference path="../extern/d3.d.ts"/>

module statemachine {
    var width = 1280,
        height = 800;

    var color = d3.scale.category10();

    var makeEdgeBetween;
    var graphfile = "graphdata/state_machine.json";
    function makeSVG() {
        var svg = d3.select("body").append("svg")
            .attr("width", width)
            .attr("height", height);
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
            //.attr('fill', '#661141');
        return svg;
    }
    function flatGraph() {
        var d3cola = cola.d3adaptor()
            .linkDistance(150)
            .avoidOverlaps(true)
            .size([width, height]);

        var svg = makeSVG();

        d3.json(graphfile, function (error, graph) {
            graph.nodes.forEach(v=> {
                v.width = 200; v.height = 50;
            });
            d3cola
                .nodes(graph.nodes)
                .links(graph.links)
                .start(10, 10, 10);

            var linkTypes = getLinkTypes(graph.links);

            var link = svg.selectAll(".link")
                .data(graph.links)
                .enter().append("line")
                .attr("stroke", l => color(linkTypes.lookup[l.type]))
                .attr("fill", l => color(linkTypes.lookup[l.type]))
                .attr("class", "link");

            var margin = 10;
            var node = svg.selectAll(".node")
                .data(graph.nodes)
                .enter().append("rect")
                .attr("class", "node")
                .attr("width", d => d.width + 2 * margin)
                .attr("height", d => d.height + 2 * margin)
                .attr("rx", 4).attr("ry", 4)
                .call((<any>d3cola).drag);
            var label = svg.selectAll(".label")
                .data(graph.nodes)
                .enter().append("text")
                .attr("class", "label")
                .text(d => d.name.replace(/_/g, ' '))
                .call((<any>d3cola).drag);

            node.append("title")
                .text(d => d.name);

            d3cola.on("tick", function () {
                node.each(
                    d => d.innerBounds = d.bounds.inflate(-margin)
                    );
                link.each(function (d) {
                    cola.vpsc.makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
                    if (isIE()) this.parentNode.insertBefore(this, this);
                });

                link.attr("x1", d => d.sourceIntersection.x)
                    .attr("y1", d => d.sourceIntersection.y)
                    .attr("x2", d => d.arrowStart.x)
                    .attr("y2", d => d.arrowStart.y);

                node.attr("x", d => d.innerBounds.x)
                    .attr("y", d => d.innerBounds.y)
                    .attr("width", d => d.innerBounds.width())
                    .attr("height", d => d.innerBounds.height());

                label.attr("x", d => d.innerBounds.x+7)
                    .attr("y", function (d) {
                        var h = this.getBBox().height;
                        return d.y + h / 3.5;
                    });
            });

            var indent = 0, topindent = 0;
            var swatches = svg.selectAll('.swatch')
                .data(linkTypes.list)
                .enter().append('rect').attr('x', indent).attr('y', (l, i) => topindent + 40 * i)
                .attr('width', 30).attr('height', 30).attr('fill', (l, i) => color(i))
                .attr('class', 'swatch');
            var swatchlabels = svg.selectAll('.swatchlabel')
                .data(linkTypes.list)
                .enter()
                .append('text').text(t => t ? t : "Start").attr('x', indent + 40).attr('y', (l, i) => topindent + 20 + 40 * i).attr('fill', 'black')
                .attr('class', 'swatchlabel');
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

    function powerGraph() {
        var d3cola = cola.d3adaptor()
            .linkDistance(80)
            .handleDisconnected(false)
            .avoidOverlaps(true)
            .size([width, height]);

        var svg = makeSVG();

        d3.json(graphfile, function (error, graph) {
            graph.nodes.forEach((v, i) => {
                v.index = i;
                v.width = 170;
                v.height = 110;
            });
            var powerGraph;

            var doLayout = function (response) {
                var vs = response.nodes.filter(v=> v.label);
                vs.forEach(v=> {
                    var index = Number(v.label) - 1;
                    var node = graph.nodes[index];
                    node.x = Number(v.y) * 1.7 - 70;
                    node.y = 700-Number(v.x) * 1.3;
                    node.fixed = 1;
                });
                var n = graph.nodes.length,
                    _id = v => getId(v,n)-1,
                    g = { 
                        nodes: graph.nodes.map(d=> <any>{
                            id: _id(d),
                            name: d.name, 
                            bounds: new cola.vpsc.Rectangle(d.x, d.x+d.width, d.y, d.y+d.height)
                            }).concat(
                                powerGraph.groups.map(d=> <any>{
                                id: _id(d),
                                children: (typeof d.groups !== 'undefined' ? d.groups.map(c=>n+c.id) : [])
                                    .concat(typeof d.leaves !== 'undefined' ? d.leaves.map(c=>c.index) : [])
                            })),
                        edges: powerGraph.powerEdges.map(e=> <any>{
                            source: _id(e.source),
                            target: _id(e.target),
                            type: e.type
                        })
                    };
                var gridrouter = new cola.GridRouter(g.nodes, {
                    getChildren: function(v:any) {
                        return v.children;
                    },
                    getBounds: function(v:any) {
                        return v.bounds;
                    }
                });

                var gs = gridrouter.backToFront.filter(v=>!v.leaf);
                var group = svg.selectAll(".group")
                    .data(gs)
                    .enter().append("rect")
                    .attr("rx", 8).attr("ry", 8)
                    .attr('x',d=>d.rect.x)
                    .attr('y',d=>d.rect.y)
                    .attr('width',d=>d.rect.width())
                    .attr('height',d=>d.rect.height())
                    .attr("class", "group");

                var margin = 10;
                var node = svg.selectAll(".node")
                    .data(graph.nodes)
                    .enter().append("rect")
                    .attr("class", "node")
                    .attr('x',d=>d.x)
                    .attr('y', d=> d.y += (d.name == 'starting_state' ||d.name == 'trip_cancelled'?30:0))
                    .attr("width", d => d.width)
                    .attr("height", d => d.height -= (d.name == 'starting_state' || d.name == 'trip_cancelled'? 30 : 0))
                    .attr("rx", 4).attr("ry", 4)
                    .call((<any>d3cola).drag);
                var label = svg.selectAll(".label")
                    .data(graph.nodes)
                    .enter().append("text")
                    .attr("class", "label")
                    .attr("transform", function (d) {
                        return "translate(" + (d.x + 10) + "," + d.y + ")";
                    });
                var detailLabel = svg.selectAll(".detailLabel")
                    .data(graph.nodes)
                    .enter().append("text")
                    .attr("class", "detailLabel")
                    .attr("transform", function (d) {
                    return "translate(" + (d.x + 10) + "," + d.y + ")";
                });
                    // .text(d => /*d.index +':' +*/ d.name)
                    // //.attr("x", d => d.x + d.width/2) // centred
                    // .style('text-anchor','start')
                    // .attr("x", d => d.x + 10)
                    // .attr("y", function (d) {
                    //     var h = this.getBBox().height;
                    //     return d.y + d.height/2 + h/2;
                    // })
                    // .call(d3cola.drag);
                var insertLinebreaks = function (d) {
                    var el = d3.select(this);
                    var words = d.name.split('_');
                    el.text('');
                    d.lines = [words[0]+' '+words[1]].concat(words.slice(2));
                    for (var i = 0; i < d.lines.length; i++) {
                        var tspan = el.append('tspan').text(d.lines[i]);
                        tspan.attr('x', 0).attr('dy', '20');
                    }
                };
                var insertDetailLinebreaks = function (d) {
                    if (!d.detail) return;

                    var text = d3.select(this),
                        words = d.detail.split(/\s+/).reverse(),
                        word,
                        line = [],
                        lineNumber = 0,
                        lineHeight = 1.2, // ems
                        width = 160,
                        y = d.lines.length * 20 + 20,//text.attr("y"),
                        dy = 0, //parseFloat(text.attr("dy")),
                        tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
                    while (word = words.pop()) {
                        line.push(word);
                        tspan.text(line.join(" "));
                        if ((<any>tspan.node()).getComputedTextLength() > width) {
                            line.pop();
                            tspan.text(line.join(" "));
                            line = [word];
                            tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                        }
                    }
                };

                label.each(insertLinebreaks);
                detailLabel.each(insertDetailLinebreaks);

                node.append("title")
                    .text(d => d.name);

                var routes = gridrouter.routeEdges<any>(g.edges, 18, e=> e.source, e=> e.target);
                routes.forEach((route, j) => {
                    var cornerradius = 15;
                    var arrowwidth = 13;
                    var arrowheight = 18;
                    var p = cola.GridRouter.getRoutePath(route, cornerradius, arrowwidth, arrowheight);
                    var c = color(g.edges[j].type);
                    var linewidth = 15;
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
            }
            var linkTypes = getLinkTypes(graph.links);
            d3cola
                .nodes(graph.nodes)
                .links(graph.links)
                .linkType(l => linkTypes.lookup[l.type])
                .powerGraphGroups(d => (powerGraph = d).groups.forEach(v => v.padding = 10));

            var modules = { N: graph.nodes.length, ms: [], edges: [] };
            var n = modules.N;
            powerGraph.groups.forEach(g => {
                var m = [];
                expandGroup(g, m);
                modules.ms.push(m);
            });
            powerGraph.powerEdges.forEach(e => {
                var N = graph.nodes.length;
                modules.edges.push({ source: getId(e.source, N), target: getId(e.target, N) });
            });
            if (document.URL.toLowerCase().indexOf('marvl.infotech.monash.edu') >= 0) {
                $.ajax({
                    type: 'post',
                    url: 'http://marvl.infotech.monash.edu/cgi-bin/test.py',
                    data: JSON.stringify(modules),
                    datatype: "json",
                    success: function (response) {
                        doLayout(response);
                    },
                    error: function (jqXHR, status, err) {
                        alert(status);
                    }
                });
            } else
            {
                d3.json(graphfile.replace(/.json/,'pgresponse.json'), function (error, response) {
                    doLayout(response);
                });
            }
        });
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

    flatGraph();
    powerGraph();
}