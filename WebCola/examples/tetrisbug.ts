///<reference path="../src/vpsc.ts"/>
///<reference path="../extern/jquery.d.ts"/>

module tetrisbug {
    var width = 1280,
        height = 800;

    var color = d3.scale.category20();

    var makeEdgeBetween;
    var colans = <any>cola;
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
        var d3cola = colans.d3adaptor()
            .linkDistance(80)
            .avoidOverlaps(true)
            .size([width, height]);

        var svg = makeSVG();

        d3.json("graphdata/tetriscodemapmultiedges.json", function (error, graph) {
            graph.nodes.forEach(v=> {
                v.width = 140; v.height = 50;
            });
            d3cola
                .nodes(graph.nodes)
                .links(graph.links)
                .start(10, 10, 10);

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

                label.attr("x", d => d.x)
                    .attr("y", function (d) {
                        var h = this.getBBox().height;
                        return d.y + h / 3.5;
                    });
            });
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

        d3.json("graphdata/tetriscodemapmultiedges.json", function (error, graph) {
            graph.nodes.forEach((v, i) => {
                v.index = i;
                v.width = 140;
                v.height = 50;
            });
            var powerGraph;

            var doLayout = function (response) {
                var vs = response.nodes.filter(v=> v.label);
                vs.forEach(v=> {
                    var index = Number(v.label) - 1;
                    var node = graph.nodes[index];
                    node.x = Number(v.x) * 1.5 + 50;
                    node.y = Number(v.y) / 1.2 + 50;
                    node.fixed = 1;
                });
                d3cola.start(1, 1, 1);

                var group = svg.selectAll(".group")
                    .data(powerGraph.groups)
                    .enter().append("rect")
                    .attr("rx", 8).attr("ry", 8)
                    .attr("class", "group");

                var link = svg.selectAll(".link")
                    .data(powerGraph.powerEdges)
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
                        d => {
                            d.bounds.setXCentre(d.x);
                            d.bounds.setYCentre(d.y);
                            d.innerBounds = d.bounds.inflate(-margin);
                        });
                    group.each(d => d.innerBounds = d.bounds.inflate(-margin));
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

                    group.attr("x", d => d.innerBounds.x)
                        .attr("y", d => d.innerBounds.y)
                        .attr("width", d => d.innerBounds.width())
                        .attr("height", d => d.innerBounds.height());

                    label.attr("x", d => d.x)
                        .attr("y", function (d) {
                            var h = this.getBBox().height;
                            return d.y + h / 3.5;
                        });
                });
            }
            var linkTypes = {};
            graph.links.forEach(l=> linkTypes[l.type] = {});
            var typeCount = 0;
            for (var type in linkTypes) {
                linkTypes[type] = typeCount++;
            }
            d3cola
                .nodes(graph.nodes)
                .links(graph.links)
                .linkType(l => linkTypes[l.type])
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
            } else {
                d3.json("graphdata/tetrisbugresponse.json", function (error, response) {
                    doLayout(response);
                });
            }
        });

    }

    function isIE() { return ((navigator.appName == 'Microsoft Internet Explorer') || ((navigator.appName == 'Netscape') && (new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})").exec(navigator.userAgent) != null))); }

    flatGraph();
    powerGraph();
}