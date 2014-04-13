var width = 800,
    height = 500;

var color = d3.scale.category20();

var d3cola = cola.d3adaptor()
    .size([width, height]);

var svg = d3.select("#example").append("svg")
    .attr("width", width)
    .attr("height", height);
svg.append("clipPath")
    .attr("id","clipMask")
   .append("rect").attr("x", 320).attr("y", 120).attr("width", 600).attr("height", 650);

//svg.append("image")
//  .attr("xlink:href", "graphdata/ariel/australia.png")
//  .attr("width", "800")
//  .attr("clip-path", "url(#clipMask)")
//  .attr("height", "600");

var g = { nodes: [], links: [] };
var edgeLookup = {};
var dates = [];

var minFlow = Number.MAX_VALUE, maxFlow = -Number.MAX_VALUE;
var node;
d3.csv("../../data/ariel/geofudge.csv", function (d) {

    if (d.Node.length > 0) {

        var label = d["Node"];

        if (label.length === 0) {

            label = d.Node;

        }

        g.nodes.push({ name: label/*, x: parseFloat(d["x"]), y: parseFloat(d["y"]), fixed: true */ });

    }

}, function (error, rows) {

    d3.csv("../../data/ariel/EdgeTopology.csv", function (d) {

        var edge = { source: d["Node From"] - 1, target: d["Node To"] - 1, flows: [] };

        g.links.push(edge);

        edgeLookup[d.Line] = edge;

    }, function (error, rows) {

        //d3.text("graphdata/ariel/dailyflow.csv", function (error, d) {

        //    d3.csv.parseRows(d, function (d) {

        //        var eid = d[0];

        //        if (eid in edgeLookup) {

        //            var e = edgeLookup[eid];

        //            e.flows.push(d[1]);

        //        }

        //    });

        d3.text("../../data/ariel/Flows.csv", function (error, d) {

            d3.csv.parseRows(d, function (d) {

                var property = d[4];

                if (property === "Flow") {

                    var eid = d[2];

                    if (eid === "01. 1-2") {

                        dates.push(d[6]);

                    }

                    if (eid in edgeLookup) {

                        var e = edgeLookup[eid];

                        var flow = d[9] - 0;

                        minFlow = Math.min(minFlow, flow);

                        maxFlow = Math.max(maxFlow, flow);

                        e.flows.push(flow);

                    }

                }

            });



            g.links.forEach(function (l) {

                l.length = (100 + l.flows[0]);

            });

            d3cola
                .linkDistance(function (l) { return l.length })
                .nodes(g.nodes)
                .links(g.links)
                .handleDisconnected(false)
                //.symmetricDiffLinkLengths()
                .start();

            var link = svg.selectAll(".link")
                .data(g.links)
              .enter().append("line")
                .attr("class", "link")
                .style("stroke-width", function (d) { return Math.log(Math.abs(d.flows[0])); });

            changeData(0);

            node = svg.selectAll(".node")
                .data(g.nodes)
              .enter().append("circle")
                .attr("class", "node")
                .attr("r", 5)
                .style("fill", function (d) { return color(d.group); })
                .call(d3cola.drag);

            node.on("click", function (d) {

                if (d3.event.shiftKey) {

                    d.fixed = true;

                    this.setAttribute("r", 3);

                }

            })

            var label = svg.selectAll(".label")
                .data(g.nodes)
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

                node.attr("cx", function (d) { return d.x; })
                    .attr("cy", function (d) { return d.y; });

                label
                    .attr("x", function (d) { return d.x })
                    .attr("y", function (d) { return d.y + 10 });

            });

        });

    });

});

function changeData(v) {

    var l = document.getElementById("sliderLabel");

    l.textContent = dates[v];

    var min = Number.MAX_VALUE, max = -Number.MAX_VALUE;

    g.links.forEach(function (l) {

        var f = Math.log(Math.abs(l.flows[v]) + 1);

        l.delta = typeof l.value === "undefined" ? 0 : f - l.value;

        l.value = f;

        min = Math.min(min, l.delta);

        max = Math.max(max, l.delta);

        l.length = (50 + Math.abs(l.flows[v]));

    });

    var color = d3.scale.linear().domain([min, 0, max]).range(["green", "gray", "red"]);

    svg.selectAll(".link")
                .attr("class", "link")
                .style("stroke-width", function (d) { return d.value; })
                .transition().duration(0).style("stroke", function (d) { return color(d.delta) })

                .transition().duration(1000).style("stroke", "gray");

    d3cola.start();

}



var positionText = null;

function showPositions() {

    var ps = "";

    node.each(function (d) {

        ps += d.name + "," + d.x + "," + d.y + "<br>";

    });

    if (positionText === null) {

        positionText = d3.select("body").append("div").attr("id", "positions");

    }

    positionText.html(ps);

}

d3.select("#dateSlider").on("input", function(){
  changeData(this.value);
});
 
d3.select(".showPositions").on("click", function(){
  showPositions();
});