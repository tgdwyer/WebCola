var width = 1000,
    height = 500;

var color = d3.scale.category20();
var graphDiv = d3.select("#example").append("div");

GraphCanvas = function () {
    var gc = {};
    gc.init = function (id, width, height, linkDistance) {
        gc.cola = cola.d3adaptor()
                .linkDistance(linkDistance)
                .size([width, height]);

        gc.svg = graphDiv.append("svg")
                .attr("id", id)
                .attr("width", width)
                .attr("height", height);

        gc.linkLayer = gc.svg.append("g");
        gc.nodeLayer = gc.svg.append("g");
        return gc;
    }
    return gc;
};
var gc1 = GraphCanvas().init("mdsview", 400, height, 10);

d3.select("#example").append("button").attr("id", "relaxButton").attr("disabled","true").text("Relax Edges").on("click", relaxEdges);

var matrix = [];
var nodes = [];
var labels = [];

var edgeMinLength = Number.MAX_VALUE;
var edgeMaxLength = 0;

var percentiles = new Array(101);
var orderedWeights = [];

d3.text("../../data/signed_weighted.txt",
    function (error, text) {
        var lines = text.split('\n').map(function (s) { return s.trim() });
        lines.forEach(function (l) {
            if (l.length > 0) {
                matrix.push(l.split(',').map(function (d) {
                    var l = 150 / (Number(d) + 1);
                    edgeMinLength = Math.min(edgeMinLength, l);
                    edgeMaxLength = Math.max(edgeMaxLength, l);
                    return l;
                }));
            }
        });
        for (var i = 0; i < matrix.length; ++i) {
            var row = matrix[i];
            for (var j = 0; j < row.length; ++j) {
                orderedWeights.push(row[j]);
            }
        }
        orderedWeights.sort(function (a, b) { return a - b });
        var k = orderedWeights.length / 100;
        for (var i = 0; i < 100; ++i) {
            percentiles[i] = orderedWeights[Math.floor(i * k)];
        }
        percentiles[100] = orderedWeights[orderedWeights.length - 1];
        loaded();
    });

d3.text("../../data/signed_weighted_affil.txt",
    function (error, text) {
        var lines = text.split(',').map(function (s) { return s.trim() });
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

    gc1.svg.select("#edgeThresholdSlider").attr("max", edgeMaxLength);
    gc1.svg.select("#edgeThresholdSlider").attr("min", edgeMinLength - 1);

    gc1.cola
        .distanceMatrix(matrix)
        .nodes(nodes)
        .start(100);

    links = [];

    var node = gc1.nodeLayer.selectAll(".node")
        .data(nodes)
      .enter().append("circle")
        .attr("class", "node")
        .attr("r", 5)
        .style("fill", function (d) { return color(d.group); })
        .call(gc1.cola.drag);

    node.append("title")
        .text(function (d) { return labels[d.id]; });

    gc1.cola.on("tick", function () {
        updatePositions(node, linkSelection);
    });
}
var previousThreshold = 0;
var linkid = 0;
function setEdgeThreshold(p) {
    var t = percentiles[p];
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

        if (links.length > 0) {

            d3.select("#relaxButton").attr("disabled", null);

        }

        previousThreshold = t;
        linkSelection = gc1.linkLayer.selectAll(".link").data(links, function (l) { return l.id });
        linkSelection.exit().remove();
        updatePositions(null, linkSelection.enter().append("line")
            .attr("class", "link")
            .style("stroke-width", function (d) { return Math.sqrt(d.value); }));
    }
}

function updatePositions(circles, lines) {
    if (circles) {
        circles.transition().duration(0.01)
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
    }
    if (lines) {
        lines.transition().duration(0.01).attr("x1", function (d) { return d.source.x; })
             .attr("y1", function (d) { return d.source.y; })
             .attr("x2", function (d) { return d.target.x; })
             .attr("y2", function (d) { return d.target.y; });
    }
}

function updatePositionsAnimated(circles, lines) {
    if (circles) {
        circles.transition().duration(2000)
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
    }
    if (lines) {
        lines.transition().duration(2000)
            .attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });
    }
}

function movex(e, delay, dx) {
    e.style("transition", "transform " + delay)
     .style("transform", "translateX(" + dx + "px)")
     .style("-webkit-transition", "-webkit-transform " + delay)
     .style("-webkit-transform", "translate(" + dx + "px, 0px)");
}
var relaxedGraph = null;
var gc2 = null;
function relaxEdges() {

    // construct a relaxed graph from the positions
    if (!relaxedGraph) {
        relaxedGraph = {};
    }
    if (gc2) {

        gc2.cola.on("tick", null);

        gc2.svg.remove();

    }

    gc2 = GraphCanvas().init("graphview", 400, height, 25);

    relaxedGraph.nodes = nodes.map(function (u) {
        return { id: u.id, group: u.group, x: u.x, y: u.y };
    });

    var neighbours = {};
    relaxedGraph.links = links.map(function (l) {
        neighbours[l.source.id] = true;
        neighbours[l.target.id] = true;
        return { source: relaxedGraph.nodes[l.source.id], target: relaxedGraph.nodes[l.target.id], id: l.id };
    });

    relaxedGraph.nodes = relaxedGraph.nodes.filter(function (v) {
        if (v.id in neighbours) return true;
        return false;
    });

    var linkQuery = gc2.linkLayer.selectAll(".link")
        .data(relaxedGraph.links, function (d) { return d.id });

    linkQuery.enter().append("line")
        .attr("class", "link")
        .style("stroke-width", function (d) { return Math.sqrt(d.value); });

    linkQuery.exit().remove();

    var nodeQuery = gc2.nodeLayer.selectAll(".node")
        .data(relaxedGraph.nodes, function (d) { return d.id });
            
    nodeQuery.enter().append("circle")
        .attr("class", "node")
        .attr("r", 5)
        .style("fill", function (d) { return color(d.group); })
        .call(gc2.cola.drag)
        .append("title")
        .text(function (d) { return labels[d.id]; });

    nodeQuery.exit().remove();

    updatePositions(
        relaxedGraph.circles = nodeQuery,
        relaxedGraph.lines = linkQuery);

    gc2.cola
        .nodes(relaxedGraph.nodes)
        .links(relaxedGraph.links)
        .handleDisconnected(false)
        //.symmetricDiffLinkLengths(1)
        .start(20,20,60);
    gc2.cola.stop();

        var dx = gc1.svg[0][0].getBoundingClientRect().left - gc2.svg[0][0].getBoundingClientRect().left;
        var transitionEndCallback = function () {

            updatePositionsAnimated(relaxedGraph.circles, relaxedGraph.lines);

            gc2.svg.style("visibility", "visible");
            var setTickFunc = function () {

                gc2.cola.resume();

                gc2.cola.on("tick", function () {

                    updatePositions(relaxedGraph.circles, relaxedGraph.lines);

                });
                gc2.svg.on('webkitTransitionEnd', null).on('transitionend', null);

            }
            gc2.svg.on('webkitTransitionEnd', setTickFunc).on('transitionend', setTickFunc);
            movex(gc2.svg, "2s", 0);

        }

        // first, really quickly move the right canvas left to overlay the original graph
        gc2.svg.on('webkitTransitionEnd', transitionEndCallback).on('transitionend', transitionEndCallback);
        gc2.svg.style("visibility", "hidden");
        movex(gc2.svg, "0.01s", dx);
}

d3.select(".slider").on("input", function(){
  d3.select("#sliderLabel").text(+this.value ?
    this.value + "th percentile" :
    "No Links");
  setEdgeThreshold(this.value);
});