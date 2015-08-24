module cola {
    export function powerGraphGridLayout(
        graph: { nodes: Node[], links: Link<Node>[] },
        size: number[],
        grouppadding: number,
        margin: number,
        groupMargin: number)
    {
        // compute power graph
        var powerGraph;
        cola.d3adaptor()
            .avoidOverlaps(false)
            .nodes(graph.nodes)
            .links(graph.links)
            .powerGraphGroups(function (d) {
                powerGraph = d;
                powerGraph.groups.forEach(v=> v.padding = grouppadding);
            });

        // construct a flat graph with dummy nodes for the groups and edges connecting group dummy nodes to their children
        // power edges attached to groups are replaced with edges connected to the corresponding group dummy node
        var n = graph.nodes.length;
        var edges = [];
        var vs = graph.nodes.slice(0);
        vs.forEach((v, i) => (<any>v).index = i);
        powerGraph.groups.forEach(g => {
            var sourceInd = g.index = g.id + n;
            vs.push(g);
            if (typeof g.leaves !== 'undefined')
                g.leaves.forEach(v => edges.push({ source: sourceInd, target: v.index }));
            if (typeof g.groups !== 'undefined')
                g.groups.forEach(gg => edges.push({ source: sourceInd, target: gg.id + n }));
        });
        powerGraph.powerEdges.forEach(e=> {
            edges.push({ source: e.source.index, target: e.target.index });
        });

        // layout the flat graph with dummy nodes and edges
        cola.d3adaptor()
            .size(size)
            .nodes(vs)
            .links(edges)
            .avoidOverlaps(false)
            .linkDistance(30)
            .symmetricDiffLinkLengths(5)
            .convergenceThreshold(1e-4)
            .start(100, 0, 0, 0, false);

        // final layout taking node positions from above as starting positions
        // subject to group containment constraints
        // and then gridifying the layout
        return {
            cola: cola.d3adaptor()
                .convergenceThreshold(1e-3)
                .size(size)
                .avoidOverlaps(true)
                .nodes(graph.nodes)
                .links(graph.links)
            //.flowLayout('y', 30)
                .groupCompactness(1e-4)
                .linkDistance(30)
                .symmetricDiffLinkLengths(5)
                .powerGraphGroups(function (d) {
                    powerGraph = d;
                    powerGraph.groups.forEach(function (v) {
                        v.padding = grouppadding
                    });
                }).start(50, 0, 100, 0, false),
            powerGraph: powerGraph
        };
    }
}