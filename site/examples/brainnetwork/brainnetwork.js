var width = 960,
    height = 500;

var color = d3.scale.category20();

var d3cola = cola.d3adaptor()
    .linkDistance(10)
    .size([width, height]);

var svg = d3.select("#example").append("svg")
    .attr("width", width)
    .attr("height", height);
var linkLayer = svg.append("g");
var nodeLayer = svg.append("g");

var matrix = [];
var nodes = [];
var labels = [];

var edgeMinLength = Number.MAX_VALUE;
var edgeMaxLength = 0;

d3.text("../../data/CCsum.txt",
    function (error, text) {
        var lines = text.split('\n').map(function (s) { return s.trim() });
        lines.forEach(function (l) {
            if (l.length > 0) {
                matrix.push(l.split(',').map(function (d) {
                    var l = 300 / (Number(d) + 1);
                    edgeMinLength = Math.min(edgeMinLength, l);
                    edgeMaxLength = Math.max(edgeMaxLength, l);
                    return l;
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

var links = null;
var linkSelection = null;

function loaded() {
    if (nodes.length == 0 || matrix.length == 0 || labels.length == 0) return;

    svg.select("#edgeThresholdSlider").attr("max", edgeMaxLength);
    svg.select("#edgeThresholdSlider").attr("min", edgeMinLength - 1);

    d3cola
        .distanceMatrix(matrix)
        .nodes(nodes)
        .start();

    links = [];

    var node = nodeLayer.selectAll(".node")
        .data(nodes)
      .enter().append("circle")
        .attr("class", "node")
        .attr("r", 5)
        .style("fill", function (d) { return color(d.group); })
        .call(d3cola.drag);

    node.append("title")
        .text(function (d) { return labels[d.id]; });

    d3cola.on("tick", function () {
        node.attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; });

        if (linkSelection) {
            linkSelection.attr("x1", function (d) { return d.source.x; })
                .attr("y1", function (d) { return d.source.y; })
                .attr("x2", function (d) { return d.target.x; })
                .attr("y2", function (d) { return d.target.y; });
        }
    });
}

var previousThreshold = 0;
var linkid = 0;
function setEdgeThreshold(t) {
    if (links) {
        links = links.filter(function (l) {
            return l.length < t;
        });

        var n = nodes.length;
        for (var i = 0; i < n - 1; ++i) {
            for (var j = i + 1; j < n; ++j) {
                var l = matrix[i][j];
                if (l >= previousThreshold && l < t) {
                    links.push({ source: nodes[i], target: nodes[j], length: l, id: linkid++ });
                }
            }
        }
        previousThreshold = t;
        linkSelection = linkLayer.selectAll(".link").data(links, function (l) { return l.id });
        linkSelection.exit().remove();
        linkSelection.enter().append("line")
            .attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; })
            .attr("class", "link")
            .style("stroke-width", function (d) { return Math.sqrt(d.value); });
    }
}

d3.select("#edgeThresholdSlider").on("input", function(){
  setEdgeThreshold(this.value);
});
