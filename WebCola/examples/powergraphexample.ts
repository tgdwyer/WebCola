///<reference path="../src/vpsc.ts"/>

var width = 350,
    height = 350;

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
        .attr('fill', '#555');
    return svg;
}
function flatGraph() {
    var d3cola = colans.d3adaptor()
        .linkDistance(80)
        .avoidOverlaps(true)
        .size([width, height]);

    var svg = makeSVG();

    //d3.json("graphdata/n7e23.json", function (error, graph) {
    d3.json("graphdata/miserables.json", function (error, graph) {
        graph.nodes.forEach(v=> {
            v.width = 10; v.height = 10;
        });
        d3cola
            .nodes(graph.nodes)
            .links(graph.links)
            .start(10, 10, 10);

        var link = svg.selectAll(".link")
            .data(graph.links)
            .enter().append("line")
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
            node.each(d => d.innerBounds = d.bounds.inflate(-margin));
            link.each(function (d) {
                makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
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

function powerGraph() {
    var d3cola = colans.d3adaptor()
        .linkDistance(80)
        .handleDisconnected(false)
        .avoidOverlaps(true)
        .size([width, height]);

    var svg = makeSVG();

    d3.json("graphdata/miserables.json", function (error, graph) {

        var powerGraph;

        d3cola
            .nodes(graph.nodes)
            .links(graph.links)
            .powerGraphGroups(d => (powerGraph = d).groups.forEach(v => v.padding = 20))
            .start(50, 10, 10);

        var group = svg.selectAll(".group")
            .data(powerGraph.groups)
            .enter().append("rect")
            .attr("rx", 8).attr("ry", 8)
            .attr("class", "group")
            .style("fill", (d, i) => color(i));

        var link = svg.selectAll(".link")
            .data(powerGraph.powerEdges)
            .enter().append("line")
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
            node.each(d => d.innerBounds = d.bounds.inflate(-margin));
            group.each(d => d.innerBounds = d.bounds.inflate(-margin));
            link.each(function (d) {
                makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
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
    });
}

function confluent() {
    var d3cola = colans.d3adaptor()
        .linkDistance(80)
        .avoidOverlaps(true)
        .size([width, height]);

    var svg = makeSVG();

    d3.json("graphdata/miserables.json", function (error, graph) {

        var powerGraph;

        var linkAccessor = {
            getSourceIndex: l => l.source,
            getTargetIndex: l => l.target
        };

        var g = cola.powergraph.getGroups(graph.nodes, graph.links, linkAccessor);

        d3cola
            .nodes(graph.nodes)
            .links(graph.links)
            .powerGraphGroups(d => (powerGraph = d).groups.forEach(v => v.padding = 20))
            .start(10, 10, 10);

        var group = svg.selectAll(".group")
            .data(powerGraph.groups)
            .enter().append("rect")
            .attr("rx", 8).attr("ry", 8)
            .attr("class", "group")
            .style("fill", (d, i) => color(i));

        var link = svg.selectAll(".link")
            .data(powerGraph.powerEdges)
            .enter().append("line")
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
            node.each(d => d.innerBounds = d.bounds.inflate(-margin));
            group.each(d => d.innerBounds = d.bounds.inflate(-margin));
            link.each(function (d) {
                makeEdgeBetween(d, d.source.innerBounds, d.target.innerBounds, 5);
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
    });
}
function isIE() { return ((navigator.appName == 'Microsoft Internet Explorer') || ((navigator.appName == 'Netscape') && (new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})").exec(navigator.userAgent) != null))); }

flatGraph();
powerGraph();
//confluent();