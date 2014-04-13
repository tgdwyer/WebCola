var width = 800,
    height = 400;

var color = d3.scale.category20();

var d3cola = cola.d3adaptor()
    .linkDistance(120)
    .avoidOverlaps(true)
    .size([width, height]);

var svg = d3.select("#example").append("svg")
    .attr("width", width)
    .attr("height", height);

d3.json("../../data/alignmentconstraints.json", function (error, graph) {
    graph.nodes.forEach(function (v) { v.x = 400, v.y = 20 });
    d3cola
        .nodes(graph.nodes)
        .links(graph.links)
        .constraints(graph.constraints)
        .start(10,10,10);

    var link = svg.selectAll(".link")
        .data(graph.links)
      .enter().append("line")
        .attr("class", "link");

    var guideline = svg.selectAll(".guideline")
        .data(graph.constraints.filter(function (c) { return c.type === 'alignment' }))
      .enter().append("line")
        .attr("class", "guideline")
        .attr("stroke-dasharray", "5,5");

    var node = svg.selectAll(".node")
        .data(graph.nodes)
      .enter().append("rect")
        .attr("class", "node")
        .attr("width", function (d) { return d.width; })
        .attr("height", function (d) { return d.height; })
        .attr("rx", 5).attr("ry", 5)
        .style("fill", function (d) { return color(1); })
        .call(d3cola.drag);

    var label = svg.selectAll(".label")
        .data(graph.nodes)
       .enter().append("text")
        .attr("class", "label")
        .text(function (d) { return d.name; })
        .call(d3cola.drag);

    node.append("title")
        .text(function (d) { return d.name; });

    d3cola.on("tick", function () {
        link.attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });

        guideline
            .attr("x1", function (d) { return getAlignmentBounds(graph.nodes, d).x; })
            .attr("y1", function (d) {
                return d.bounds.y;
            })
            .attr("x2", function (d) { return d.bounds.X; })
            .attr("y2", function (d) {
                return d.bounds.Y;
            });

        node.attr("x", function (d) { return d.x - d.width / 2; })
            .attr("y", function (d) { return d.y - d.height / 2; });

        label.attr("x", function (d) { return d.x; })
             .attr("y", function (d) {
                 var h = this.getBBox().height;
                 return d.y + h/4;
             });
    });
});

function getAlignmentBounds(vs, c) {
    var os = c.offsets;
    if (c.axis === 'x') {
        var x = vs[os[0].node].x;
        c.bounds = new cola.vpsc.Rectangle(x, x, 
            Math.min.apply(Math, os.map(function (o) { return vs[o.node].bounds.y - 20; })),
            Math.max.apply(Math, os.map(function (o) { return vs[o.node].bounds.Y + 20; })));
    } else {
        var y = vs[os[0].node].y;
        c.bounds = new cola.vpsc.Rectangle(
            Math.min.apply(Math, os.map(function (o) { return vs[o.node].bounds.x - 20; })),
            Math.max.apply(Math, os.map(function (o) { return vs[o.node].bounds.X + 20; })),
            y, y);
    }
    return c.bounds;
}
