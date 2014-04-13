var width = 480,
    height = 500;

var color = d3.scale.category20();

var cola1 = cola.d3adaptor()
    .linkDistance(10)
    .size([width, height]);

var cola2 = cola.d3adaptor()
    .linkDistance(10)
    .size([width, height]);

var svg1 = d3.select("#example").append("svg")
    .attr("width", width)
    .attr("height", height);
var svg2 = d3.select("#example").append("svg")
    .attr("width", width)
    .attr("height", height);

var matrix = [];
var nodes = [];
var labels = [];

d3.text("../../data/CCsum.txt",
    function (error, text) {
        var lines = text.split('\n').map(function (s) { return s.trim() });
        lines.forEach(function (l) {
            if (l.length > 0) {
                matrix.push(l.split(',').map(function (d) {
                    return 300 / (Number(d) + 1);
                }));
            }
        });
        loaded();
    });

d3.text("../../data/affil.txt",
    function (error, text) {
        var lines = text.split('\n').map(function (s) { return s.trim() });
        nodes = lines.map(function (l, i) {
            return { id: i, group: Number(l) };
        });
        loaded();
    });

d3.text("../../data/labels.txt",
    function (error, text) {
        labels = text.split('\n').map(function (s) { return s.trim() });
        loaded();
    });

var linkid = 0;

function getGraph(nodes, m, t) {
    var g = { nodes: [], links: [] };
    nodes.forEach(function (v) {
        g.nodes.push({ id: v.id, x: v.x, y: v.y, group: v.group });
    });
    var n = nodes.length;
    for (var i = 0; i < n - 1; ++i) {
        for (var j = i + 1; j < n; ++j) {
            var w = matrix[i][j];
            if (w < t) {
                g.links.push({ source: i, target: j, length: w, id: linkid++ });
            }
        }
    }
    return g;
}

var threshold = 0.5;

function loaded() {
    if (nodes.length == 0 || matrix.length == 0 || labels.length == 0) return;
    cola1
        .distanceMatrix(matrix)
        .nodes(nodes)
        .start();

    var node1 = svg1.selectAll(".node")
        .data(nodes)
      .enter().append("circle")
        .attr("class", "node")
        .attr("r", 5)
        .style("fill", function (d) { return color(d.group); })
        .call(cola1.drag);

    node1.append("title")
        .text(function (d) { return labels[d.id]; });

    cola1.on("tick", function () {
        node1.attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; });
    });

    cola1.on("end", function () {

        var graph = getGraph(nodes, matrix, 500);
        cola2
            .nodes(graph.nodes)
            .links(graph.links)
            //.symmetricDiffLinkLengths(1)
            .start();

        var link = svg2.selectAll(".link")
            .data(graph.links, function (d) { return d.id })
            .enter().append("line")
            .attr("class", "link")
            .style("stroke-width", function (d) { return Math.sqrt(d.value); });

        var node2 = svg2.selectAll(".node")
            .data(graph.nodes)
            .enter().append("circle")
            .attr("class", "node")
            .attr("r", 5)
            .style("fill", function (d) { return color(d.group); })
            .call(cola2.drag);

        node2.append("title")
            .text(function (d) { return labels[d.id]; });

        cola2.on("tick", function () {
            link.attr("x1", function (d) { return d.source.x; })
                .attr("y1", function (d) { return d.source.y; })
                .attr("x2", function (d) { return d.target.x; })
                .attr("y2", function (d) { return d.target.y; });

            node2.attr("cx", function (d) { return d.x; })
                .attr("cy", function (d) { return d.y; });
        });

        var prevThreshold = 500;
        updateDetailGraph = function (threshold) {
            graph.links = graph.links.filter(function (l) {
                return l.length < threshold;
            });
            var n = graph.nodes.length;
            for (var i = 0; i < n - 1; ++i) {
                for (var j = i + 1; j < n; ++j) {
                    var w = matrix[i][j];
                    if (w >= prevThreshold && w < threshold) {
                        graph.links.push({ source: graph.nodes[i], target: graph.nodes[j], length: w, id: linkid++ });
                    }
                }
            }
            prevThreshold = threshold;
            //cola2
            //    .nodes(graph.nodes)
            //    .links(graph.links)
            //    .start();
            var linkSelection = svg2.selectAll(".link")
            .data(graph.links, function (d) { return d.id });

            linkSelection.exit().remove();
                
            linkSelection.enter().append("line")
                .attr("x1", function (d) { return d.source.x; })
                .attr("y1", function (d) { return d.source.y; })
                .attr("x2", function (d) { return d.target.x; })
                .attr("y2", function (d) { return d.target.y; })
                .attr("class", "link")
                .style("stroke-width", function (d) { return Math.sqrt(d.value); });

        }
    });
}
var updateDetailGraph = null;

function setThreshold(v) {
    if (updateDetailGraph)
        updateDetailGraph(v);
}

d3.select(".slider").on("input", function(){
  setThreshold(this.value);
});
