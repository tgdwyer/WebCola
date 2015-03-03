module cola {
    var packingOptions = {
        PADDING: 10,
        GOLDEN_SECTION: (1 + Math.sqrt(5)) / 2,
        FLOAT_EPSILON: 0.0001,
        MAX_INERATIONS: 100
    };

    // assign x, y to nodes while using box packing algorithm for disconnected graphs
    export function applyPacking(graphs:Array<any>, w, h, node_size, desired_ratio = 1) {

        var init_x = 0,
            init_y = 0,

            svg_width = w,
            svg_height = h,

            desired_ratio = typeof desired_ratio !== 'undefined' ? desired_ratio : 1,
            node_size = typeof node_size !== 'undefined' ? node_size : 0,

            real_width = 0,
            real_height = 0,
            min_width = 0,

            global_bottom = 0,
            line = [];

        if (graphs.length == 0)
            return;

        /// that would take care of single nodes problem
        // graphs.forEach(function (g) {
        //     if (g.array.length == 1) {
        //         g.array[0].x = 0;
        //         g.array[0].y = 0;
        //     }
        // });

        calculate_bb(graphs);
        apply(graphs, desired_ratio);
        put_nodes_to_right_positions(graphs);

        // get bounding boxes for all separate graphs
        function calculate_bb(graphs) {

            graphs.forEach(function (g) {
                calculate_single_bb(g)
            });

            function calculate_single_bb(graph) {
                var min_x = Number.MAX_VALUE, min_y = Number.MAX_VALUE,
                    max_x = 0, max_y = 0;

                graph.array.forEach(function (v) {
                    var w = typeof v.width !== 'undefined' ? v.width : node_size;
                    var h = typeof v.height !== 'undefined' ? v.height : node_size;
                    w /= 2;
                    h /= 2;
                    max_x = Math.max(v.x + w, max_x);
                    min_x = Math.min(v.x - w, min_x);
                    max_y = Math.max(v.y + h, max_y);
                    min_y = Math.min(v.y - h, min_y);
                });

                graph.width = max_x - min_x;
                graph.height = max_y - min_y;
            }
        }

        //function plot(data, left, right, opt_x, opt_y) {
        //    // plot the cost function
        //    var plot_svg = d3.select("body").append("svg")
        //        .attr("width", function () { return 2 * (right - left); })
        //        .attr("height", 200);


        //    var x = d3.time.scale().range([0, 2 * (right - left)]);

        //    var xAxis = d3.svg.axis().scale(x).orient("bottom");
        //    plot_svg.append("g").attr("class", "x axis")
        //        .attr("transform", "translate(0, 199)")
        //        .call(xAxis);

        //    var lastX = 0;
        //    var lastY = 0;
        //    var value = 0;
        //    for (var r = left; r < right; r += 1) {
        //        value = step(data, r);
        //        // value = 1;

        //        plot_svg.append("line").attr("x1", 2 * (lastX - left))
        //            .attr("y1", 200 - 30 * lastY)
        //            .attr("x2", 2 * r - 2 * left)
        //            .attr("y2", 200 - 30 * value)
        //            .style("stroke", "rgb(6,120,155)");

        //        lastX = r;
        //        lastY = value;
        //    }

        //    plot_svg.append("circle").attr("cx", 2 * opt_x - 2 * left).attr("cy", 200 - 30 * opt_y)
        //        .attr("r", 5).style('fill', "rgba(0,0,0,0.5)");

        //}

        // actual assigning of position to nodes
        function put_nodes_to_right_positions(graphs) {
            graphs.forEach(function (g) {
                // calculate current graph center:
                var center = { x: 0, y: 0 };

                g.array.forEach(function (node) {
                    center.x += node.x;
                    center.y += node.y;
                });

                center.x /= g.array.length;
                center.y /= g.array.length;

                // calculate current top left corner:
                var corner = { x: center.x - g.width / 2, y: center.y - g.height / 2 };
                var offset = { x: g.x - corner.x, y: g.y - corner.y };

                // put nodes:
                g.array.forEach(function (node) {
                    node.x = node.x + offset.x + svg_width / 2 - real_width / 2;
                    node.y = node.y + offset.y + svg_height / 2 - real_height / 2;
                });
            });
        }

        // starts box packing algorithm
        // desired ratio is 1 by default
        function apply(data, desired_ratio) {
            var curr_best_f = Number.POSITIVE_INFINITY;
            var curr_best = 0;
            data.sort(function (a, b) { return b.height - a.height; });

            min_width = data.reduce(function (a, b) {
                return a.width < b.width ? a.width : b.width;
            });

            var left = x1 = min_width;
            var right = x2 = get_entire_width(data);
            var iterationCounter = 0;

            var f_x1 = Number.MAX_VALUE;
            var f_x2 = Number.MAX_VALUE;
            var flag = -1; // determines which among f_x1 and f_x2 to recompute


            var dx = Number.MAX_VALUE;
            var df = Number.MAX_VALUE;

            while ((dx > min_width) || df > packingOptions.FLOAT_EPSILON) {

                if (flag != 1) {
                    var x1 = right - (right - left) / packingOptions.GOLDEN_SECTION;
                    var f_x1 = step(data, x1);
                }
                if (flag != 0) {
                    var x2 = left + (right - left) / packingOptions.GOLDEN_SECTION;
                    var f_x2 = step(data, x2);
                }

                dx = Math.abs(x1 - x2);
                df = Math.abs(f_x1 - f_x2);

                if (f_x1 < curr_best_f) {
                    curr_best_f = f_x1;
                    curr_best = x1;
                }

                if (f_x2 < curr_best_f) {
                    curr_best_f = f_x2;
                    curr_best = x2;
                }

                if (f_x1 > f_x2) {
                    left = x1;
                    x1 = x2;
                    f_x1 = f_x2;
                    flag = 1;
                } else {
                    right = x2;
                    x2 = x1;
                    f_x2 = f_x1;
                    flag = 0;
                }

                if (iterationCounter++ > 100) {
                    break;
                }
            }
            // plot(data, min_width, get_entire_width(data), curr_best, curr_best_f);
            step(data, curr_best);
        }

        // one iteration of the optimization method
        // (gives a proper, but not necessarily optimal packing)
        function step(data, max_width) {
            line = [];
            real_width = 0;
            real_height = 0;
            global_bottom = init_y;

            for (var i = 0; i < data.length; i++) {
                var o = data[i];
                put_rect(o, max_width);
            }

            return Math.abs(get_real_ratio() - desired_ratio);
        }

        // looking for a position to one box 
        function put_rect(rect, max_width) {


            var parent = undefined;

            for (var i = 0; i < line.length; i++) {
                if ((line[i].space_left >= rect.height) && (line[i].x + line[i].width + rect.width + packingOptions.PADDING - max_width) <= packingOptions.FLOAT_EPSILON) {
                    parent = line[i];
                    break;
                }
            }

            line.push(rect);

            if (parent !== undefined) {
                rect.x = parent.x + parent.width + packingOptions.PADDING;
                rect.y = parent.bottom;
                rect.space_left = rect.height;
                rect.bottom = rect.y;
                parent.space_left -= rect.height + packingOptions.PADDING;
                parent.bottom += rect.height + packingOptions.PADDING;
            } else {
                rect.y = global_bottom;
                global_bottom += rect.height + packingOptions.PADDING;
                rect.x = init_x;
                rect.bottom = rect.y;
                rect.space_left = rect.height;
            }

            if (rect.y + rect.height - real_height > -packingOptions.FLOAT_EPSILON) real_height = rect.y + rect.height - init_y;
            if (rect.x + rect.width - real_width > -packingOptions.FLOAT_EPSILON) real_width = rect.x + rect.width - init_x;
        };

        function get_entire_width(data) {
            var width = 0;
            data.forEach(function (d) { return width += d.width + packingOptions.PADDING; });
            return width;
        }

        function get_real_ratio() {
            return (real_width / real_height);
        }
    }

    // seraration of disconnected graphs
    // returns an array of {}
    export function separateGraphs(nodes, links) {
        var marks = {};
        var ways = {};
        var graphs = [];
        var clusters = 0;

        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var n1 = link.source;
            var n2 = link.target;
            if (ways[n1.index])
                ways[n1.index].push(n2);
            else
                ways[n1.index] = [n2];

            if (ways[n2.index])
                ways[n2.index].push(n1);
            else
                ways[n2.index] = [n1];
        }

        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (marks[node.index]) continue;
            explore_node(node, true);
        }

        function explore_node(n, is_new) {
            if (marks[n.index] !== undefined) return;
            if (is_new) {
                clusters++;
                graphs.push({ array: [] });
            }
            marks[n.index] = clusters;
            graphs[clusters - 1].array.push(n);
            var adjacent = ways[n.index];
            if (!adjacent) return;

            for (var j = 0; j < adjacent.length; j++) {
                explore_node(adjacent[j], false);
            }
        }

        return graphs;
    }
}
