///<reference path="../src/vpsc.ts"/>
///<reference path="../src/rectangle.ts"/>
///<reference path="../src/gridrouter.ts"/>
///<reference path="../extern/jquery.d.ts"/>
///<reference path="../extern/d3.d.ts"/>

module tetrisbug {
    var width = 1280,
        height = 800;

    var color = d3.scale.category10();

    var makeEdgeBetween;
    var colans = <any>cola;
    var graphfile = "graphdata/tetrisbugmultiedges.json";
    function makeSVG():any {
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
        var d3cola = colans.d3adaptor()
            .linkDistance(80)
            .avoidOverlaps(true)
            .size([width, height]);

        var svg = makeSVG();

        d3.json(graphfile, function (error, graph) {
            graph.nodes.forEach(v=> {
                v.width = 180; v.height = 50;
            });
            d3cola
                .nodes(graph.nodes)
                .links(graph.links)
                .start(10, 10, 10);

            var linkTypes = getLinkTypes(graph.links);

            var link = svg.selectAll(".link")
                .data(graph.links)
                .enter().append("line")
                .attr("stroke", l => color(l.type))
                .attr("fill", l => color(l.type))
                .attr("class", "link");

            var margin = 10;
            var node = svg.selectAll(".node")
                .data(graph.nodes)
                .enter().append("rect")
                .attr("class", "node")
                .attr("width", d => d.width + 2 * margin)
                .attr("height", d => d.height + 2 * margin)
                .attr("rx", 4).attr("ry", 4)
                .call(d3cola.drag);
            var label = svg.selectAll(".label")
                .data(graph.nodes)
                .enter().append("text")
                .attr("class", "label")
                .text(d => d.name)
                .call(d3cola.drag);

            node.append("title")
                .text(d => d.name);

            d3cola.on("tick", function () {
                node.each(
                    d => d.innerBounds = d.bounds.inflate(-margin)
                    );
                link.each(function (d) {
                    d.route = cola.vpsc.makeEdgeBetween(d.source.innerBounds, d.target.innerBounds, 5);
                    if (isIE()) this.parentNode.insertBefore(this, this);
                });

                link.attr("x1", d => d.route.sourceIntersection.x)
                    .attr("y1", d => d.route.sourceIntersection.y)
                    .attr("x2", d => d.route.arrowStart.x)
                    .attr("y2", d => d.route.arrowStart.y);

                node.attr("x", d => d.innerBounds.x)
                    .attr("y", d => d.innerBounds.y)
                    .attr("width", d => d.innerBounds.width())
                    .attr("height", d => d.innerBounds.height());

                label.attr("x", d => d.x)
                    .attr("y", function (d) {
                        var h = this.getBBox().height;
                        return d.y + h / 3.5;
                    });
            });
            var indent = 100, topindent = 150;
            var swatches = svg.selectAll('.swatch')
                .data(linkTypes.list)
                .enter().append('rect').attr('x', indent).attr('y', (l, i) => topindent + 40 * i)
                .attr('width', 30).attr('height', 30).attr('fill', (l, i) => color(i))
                .attr('class', 'swatch');
            var swatchlabels = svg.selectAll('.swatchlabel')
                .data(linkTypes.list)
                .enter()
                .append('text').text(t => t ? t : "Any").attr('x', indent + 40).attr('y', (l, i) => topindent + 20 + 40 * i)
                .attr('fill', 'black')
                .attr("font-size", "15")
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
        var d3cola = colans.d3adaptor()
            .linkDistance(80)
            .handleDisconnected(false)
            .avoidOverlaps(true)
            .size([width, height]);

        var svg = makeSVG();

        d3.json(graphfile, function (error, graph) {
            graph.nodes.forEach((v, i) => {
                v.index = i;
                v.width = 133;
                v.height = 35;
            });
            var powerGraph;

            var doLayout = function (response) {
                var vs = response.nodes.filter(v=> v.label);
                vs.forEach(v=> {
                    var index = Number(v.label) - 1;
                    var node = graph.nodes[index];
                    node.y = Number(v.y) / 1.2 + 50;
                    node.x = Number(v.x) * 1.6;
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
                var gridrouter = new cola.GridRouter(g.nodes,{
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
                    .attr('y',d=>d.y)
                    .attr("width", d => d.width)
                    .attr("height", d => d.height)
                    .attr("rx", 4).attr("ry", 4)
                    .call(d3cola.drag);
                var label = svg.selectAll(".label")
                    .data(graph.nodes)
                    .enter().append("text")
                    .attr("class", "label")
                    .text(d => /*d.index +':' +*/ d.name)
                //.attr("x", d => d.x + d.width/2) // centred
                    .style('text-anchor', 'start')
                    .attr("x", d => d.x + 10)
                    .attr("y", function (d) {
                        var h = this.getBBox().height;
                        return d.y + d.height / 2 + h / 2;
                    });
                    //.call(d3cola.drag);

                node.append("title")
                    .text(d => d.name);

                var routes = gridrouter.routeEdges<any>(g.edges, 10, e=> e.source, e=> e.target);

                function angleBetween2Lines(line1, line2)
                {
                    var angle1 = Math.atan2(line1[0].y - line1[1].y,
                                               line1[0].x - line1[1].x);
                    var angle2 = Math.atan2(line2[0].y - line2[1].y,
                                               line2[0].x - line2[1].x);
                    return angle1-angle2;
                }
                g.edges.forEach((e,ri)=> {
                    var shortestPath = routes[ri];
                    var id = 'e'+e.source+'-'+e.target;

                    var cornerradius = 10;
                    var arrowwidth = 6;
                    var arrowheight = 12;
                    var c = color(e.type);
                    var linewidth = 5;
                    var path= 'M '+shortestPath[0][0].x+' '+shortestPath[0][0].y+' ';
                    if (shortestPath.length > 1) {
                        for (var i = 0; i < shortestPath.length; i++) {
                            var li = shortestPath[i];
                            var x = li[1].x, y=li[1].y;
                            var dx = x - li[0].x;
                            var dy = y - li[0].y;
                            if (i < shortestPath.length - 1) {
                                if (Math.abs(dx) > 0) {
                                    x -= dx/Math.abs(dx)*cornerradius;
                                } else {
                                    y -= dy/Math.abs(dy)*cornerradius;
                                }
                                path += 'L '+x+' '+y+' ';
                                var l = shortestPath[i+1];
                                var x0 = l[0].x, y0 = l[0].y;
                                var x1 = l[1].x;
                                var y1 = l[1].y;
                                dx = x1 - x0;
                                dy = y1 - y0;
                                var angle = angleBetween2Lines(li, l) < 0 ? 1 : 0;
                                var x2, y2;
                                if (Math.abs(dx) > 0) {
                                    x2 = x0 + dx/Math.abs(dx)*cornerradius;
                                    y2 = y0;
                                } else {
                                    x2 = x0;
                                    y2 = y0 + dy/Math.abs(dy)*cornerradius;
                                }
                                var cx = Math.abs(x2-x);
                                var cy = Math.abs(y2-y);
                                path += 'A '+cx+' '+cy+' 0 0 '+angle+' '+x2+' '+y2+' ';
                            } else {
                                var arrowtip = [x,y];
                                var arrowcorner1, arrowcorner2;
                                if (Math.abs(dx) > 0) {
                                    x -= dx/Math.abs(dx)*arrowheight;
                                    arrowcorner1 = [x,y+arrowwidth];
                                    arrowcorner2 = [x,y-arrowwidth];
                                } else {
                                    y -= dy/Math.abs(dy)*arrowheight;
                                    arrowcorner1 = [x+arrowwidth,y];
                                    arrowcorner2 = [x-arrowwidth,y];
                                }
                                path += 'L '+x+' '+y+' ';
                                svg.append('path')
                                    .attr('d', 'M '+arrowtip[0]+' '+arrowtip[1]+' L '+arrowcorner1[0]+' '+arrowcorner1[1]
                                        +' L '+arrowcorner2[0]+ ' '+arrowcorner2[1])
                                    .attr('stroke','none')
                                    .attr('fill',c);
                            }
                        }
                    } else {
                        var li = shortestPath[0];
                        var x = li[1].x, y=li[1].y;
                        var dx = x - li[0].x;
                        var dy = y - li[0].y;
                        var arrowtip = [x,y];
                        var arrowcorner1, arrowcorner2;
                        if (Math.abs(dx) > 0) {
                            x -= dx/Math.abs(dx)*arrowheight;
                            arrowcorner1 = [x,y+arrowwidth];
                            arrowcorner2 = [x,y-arrowwidth];
                        } else {
                            y -= dy/Math.abs(dy)*arrowheight;
                            arrowcorner1 = [x+arrowwidth,y];
                            arrowcorner2 = [x-arrowwidth,y];
                        }
                        path += 'L '+x+' '+y+' ';
                        svg.append('path')
                            .attr('d', 'M '+arrowtip[0]+' '+arrowtip[1]+' L '+arrowcorner1[0]+' '+arrowcorner1[1]
                                +' L '+arrowcorner2[0]+ ' '+arrowcorner2[1])
                            .attr('stroke','none')
                            .attr('fill',c);
                    }
                    svg.append('path')
                        .attr('d',path)
                        .attr('fill','none')
                        .attr('stroke', c)
                        .attr('stroke-width',linewidth);
                });
                // g.edges.forEach(e=> {
                //     var shortestPath = gridrouter.route(e.source, e.target)
                //     svg.append('line')
                //         .attr('x1',gridrouter.nodes[e.source].rect.cx())
                //         .attr('y1',gridrouter.nodes[e.source].rect.cy())
                //         .attr('x2',gridrouter.nodes[e.target].rect.cx())
                //         .attr('y2',gridrouter.nodes[e.target].rect.cy())
                //         .style('stroke-width',2)
                //         .style('stroke','black');

                // });


                // d3cola.on("tick", function () {
                //     node.each(
                //         d => {
                //             d.bounds.setXCentre(d.x);
                //             d.bounds.setYCentre(d.y);
                //             d.innerBounds = d.bounds.inflate(-margin);
                //         });
                //     //group.each(d => d.innerBounds = d.bounds.inflate(-margin));
                //     link.each(function (d) {
                //         cola.vpsc.makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
                //         if (isIE()) this.parentNode.insertBefore(this, this);
                //     });

                //     link.attr("x1", d => d.sourceIntersection.x)
                //         .attr("y1", d => d.sourceIntersection.y)
                //         .attr("x2", d => d.arrowStart.x)
                //         .attr("y2", d => d.arrowStart.y);

                //     node.attr("x", d => d.innerBounds.x)
                //         .attr("y", d => d.innerBounds.y)
                //         .attr("width", d => d.innerBounds.width())
                //         .attr("height", d => d.innerBounds.height());

                //     label.attr("x", d => d.x)
                //         .attr("y", function (d) {
                //             var h = this.getBBox().height;
                //             return d.y + h / 3.5;
                //         });
                // }).on('end', function () {
                //     var n = graph.nodes.length,
                //         _id = v => getId(v,n)-1,
                //         g = { 
                //             nodes: graph.nodes.map(d=> <any>{
                //                 id: _id(d),
                //                 name: d.name, 
                //                 bounds: d.innerBounds 
                //                 }).concat(
                //                     powerGraph.groups.map(d=> <any>{
                //                     id: _id(d),
                //                     bounds: d.innerBounds,
                //                     children: (typeof d.groups !== 'undefined' ? d.groups.map(c=>n+c.id) : [])
                //                         .concat(typeof d.leaves !== 'undefined' ? d.leaves.map(c=>c.index) : [])
                //                 })),
                //             edges: powerGraph.powerEdges.map(e=> <any>{
                //                 source: _id(e.source),
                //                 target: _id(e.target)
                //             })
                //         };
                //     console.log(JSON.stringify(g));
                // });
            }
            var linkTypes = {};
            graph.links.forEach(l=> linkTypes[l.type] = {});
            var typeCount = 0;
            var linkTypesList = [];
            for (var type in linkTypes) {
                linkTypesList.push(type);
                linkTypes[type] = typeCount++;
            }
            d3cola
                .nodes(graph.nodes)
                .links(graph.links)
                .linkType(l => linkTypes[l.type])
                .powerGraphGroups(d => (powerGraph = d).groups.forEach(v => v.padding = 5));

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
                $.ajax(<JQueryAjaxSettings>{
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
            } else {
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