
var cola;
(function (cola) {
    var applyPacking = {}
    applyPacking.PADDING = 10;
    applyPacking.GOLDEN_SECTION = (1 + Math.sqrt(5)) / 2;
    applyPacking.FLOAT_EPSILON = 0.00001;

    // assign x, y to nodes while using box packing algorithm for disconnected graphs
    cola.applyPacking = function (graphs, w, h, node_size, desired_ratio){

        var init_x = 0,
            init_y = 0,

            svg_width = w,
            svg_height = h,

            desired_ratio = typeof desired_ratio !== 'undefined' ? desired_ratio : 1,
            node_size = typeof node_size !== 'undefined' ? node_size : 6,

            real_width,
            real_height,
            min_width,

            global_bottom,
            line;
	  
        if (graphs.length == 0)
            return;

        calculate_bb(graphs);
        apply(graphs);
        put_nodes_to_right_positions(graphs);

        // get bounding boxes for all separate graphs
        function calculate_bb(graphs){
            for (var i = 0; i < graphs.length; i++){
                var graph = graphs[i];
                calculate_single_bb(graph);
            }

            function calculate_single_bb(graph){
                var min_x = Number.MAX_VALUE, min_y = Number.MAX_VALUE,
                 max_x = 0, max_y = 0;

                for (var j = 0; j < graph.array.length; j++) {
                    var v = graph.array[j];
                    var w = typeof v.width !== 'undefined' ? v.width : node_size;
                    var h = typeof v.height !== 'undefined' ? v.height : node_size;
                    w /= 2;
                    h /= 2;
                    max_x = Math.max(v.x + w, max_x);
                    min_x = Math.min(v.x - w, min_x);
                    max_y = Math.max(v.y + h, max_y);
                    min_y = Math.min(v.y - h, min_y);
                }

                graph.width = max_x - min_x;
                graph.height = max_y - min_y;
            }
        }

        // actuall assigning of position to nodes
        function put_nodes_to_right_positions(graphs){
    

            for (var i = 0; i < graphs.length; i++){
                // calculate current graph center:
                var center = {x: 0, y: 0};
                for (var j = 0; j < graphs[i].array.length; j++){
                    var node = graphs[i].array[j];
                    center.x += node.x;
                    center.y += node.y;
                }
                center.x /= graphs[i].array.length;
                center.y /= graphs[i].array.length;
      
                // calculate current top left corner:
                var corner = {x: center.x - graphs[i].width/2, 
                    y: center.y - graphs[i].height/2}

                var offset = {x: graphs[i].x - corner.x,
                    y: graphs[i].y - corner.y}

                // put nodes:
                for (var j = 0; j < graphs[i].array.length; j++){
                    var node = graphs[i].array[j];
                    node.x = node.x + offset.x + svg_width/2 - real_width/2;
                    node.y = node.y + offset.y + svg_height/2 - real_height/2;
                }
            }
        }

        // starts box packing algorithm
        // desired ratio is 1 by default
        function apply(data, desired_ratio){
            data.sort(function (a, b) { return b.height - a.height; });

            min_width = data.reduce(function(a, b) {
                return a.width < b.width ? a.width : b.width;
            });

            var left = x1 = 10;
            var right = x2 = get_entire_width(data);
    
            f_x1 = 0;
            f_x2 = 10;

            while ((Math.abs(x1 - x2) > min_width) || Math.abs(f_x1 - f_x2) > applyPacking.FLOAT_EPSILON ) {

                var x1 = right - (right - left) / applyPacking.GOLDEN_SECTION;
                var x2 = left + (right - left) / applyPacking.GOLDEN_SECTION; 
                var f_x1 = step(data, x1);
                var f_x2 = step(data, x2);

                if (f_x1 > f_x2) left = x1; else right = x2;    
            }
        }

        // one iteration of the optimization method
        // (gives a proper, but not necessarily optimal packing)
        function step(data, max_width){
            line = [];
            real_width = 0;
            real_height = 0;
            global_bottom = init_y;

            for (var i = 0; i < data.length; i++){
                var o = data[i];
                put_rect(o, max_width);
            }

            return Math.abs(get_real_ratio() - desired_ratio);
        }

        // looking for a position to one box 
        function put_rect(rect, max_width){
            line.push(rect);

            var parent = undefined;

            for (var i = 0; i < line.length; i++){
                if ((line[i].space_left >= rect.height) && (line[i].x + line[i].width + rect.width + applyPacking.PADDING - max_width) <= applyPacking.FLOAT_EPSILON){
                    parent = line[i];
                    break;
                }
            }

            if (parent !== undefined){
                rect.x = parent.x + parent.width + applyPacking.PADDING;
                rect.y = parent.bottom;
                rect.space_left = rect.height;
                rect.bottom = rect.y;
                parent.space_left -= rect.height + applyPacking.PADDING;
                parent.bottom += rect.height + applyPacking.PADDING;
            } else {
                rect.y = global_bottom;
                global_bottom += rect.height + applyPacking.PADDING;
                rect.x = init_x;
                rect.bottom = rect.y;
                rect.space_left = rect.height;
            }

            if (rect.y + rect.height - real_height > -applyPacking.FLOAT_EPSILON) real_height = rect.y + rect.height - init_y;
            if (rect.x + rect.width - real_width > -applyPacking.FLOAT_EPSILON) real_width = rect.x + rect.width - init_x;
        };

        function get_entire_width(data){
            var width = 0;
            data.forEach(function (d) {return width += d.width + applyPacking.PADDING;});
            return width;
        }

        function get_real_ratio(){
            return (real_width / real_height);
        }
    }

    // seraration of disconnected graphs
    // returns an array of {}
    cola.separateGraphs = function(nodes, links){
        var marks = {};
        var ways = {};
        graphs = [];
        var clusters = 0;

        for (var i = 0; i < links.length; i++){
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

        for (var i = 0; i < nodes.length; i++){
            var node = nodes[i];
            if (marks[node.index]) continue;
            explore_node(node, true);
        }

        function explore_node(n, is_new){
            if (marks[n.index] !== undefined) return;
            if (is_new) {
                clusters++;
                graphs.push({array:[]});
            }
            marks[n.index] = clusters;
            graphs[clusters - 1].array.push(n);
            var adjacent = ways[n.index];
            if (!adjacent) return;
        
            for (var j = 0; j < adjacent.length; j++){
                explore_node(adjacent[j], false);
            }
        }
    
        return graphs;
    }
    return cola;
})(cola || (cola = {}))
