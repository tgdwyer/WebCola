/// <reference path="../extern/three.d.ts"/>
/// <reference path="../src/shortestpaths.ts"/>
/// <reference path="../src/linklengths.ts"/>
/// <reference path="../src/descent.ts"/>
module cola3 {
    export class Graph {
        parentObject;
        rootObject;
        nodeMeshes: any[];
        edgeList: Edge[] = [];

        constructor(parentObject, n: number, edges: { source: number; target: number }[], nodeColour: number[]) {
            this.parentObject = parentObject;
            this.rootObject = new THREE.Object3D();
            parentObject.add(this.rootObject);

            // Create all the node meshes
            this.nodeMeshes = Array(n);
            for (var i = 0; i < n; ++i) {
                var sphere = this.nodeMeshes[i] = new THREE.Mesh(
                    new THREE.SphereGeometry(1, 10, 10), new THREE.MeshLambertMaterial(
                        { color: nodeColour[i] }
                        )
                    );
                this.rootObject.add(sphere);
            }

            // Create all the edges
            edges.forEach(e => {
                this.edgeList.push(new Edge(this.rootObject, this.nodeMeshes[e.source].position, this.nodeMeshes[e.target].position));
            });
        }

        setNodePositions(colaCoords: number[][]) {
            var x = colaCoords[0], y = colaCoords[1], z = colaCoords[2];
            for (var i = 0; i < this.nodeMeshes.length; ++i) {
                var p = this.nodeMeshes[i].position;
                p.x = x[i];
                p.y = y[i];
                p.z = z[i];
            }
        }

        update() {
            this.edgeList.forEach(e => e.update());
        }

        // Remove self from the scene so that the object can be GC'ed
        destroy() {
            this.parentObject.remove(this.rootObject);
        }
    }

    export class Edge {
        shape;
        constructor(public parentObject, private sourcePoint, private targetPoint) {
            this.shape = this.makeCylinder();
            parentObject.add(this.shape);
        }

        makeCylinder() {
            var n = 12, points = [],
                cosh = v => (Math.pow(Math.E, v) + Math.pow(Math.E, -v)) / 2;
            var xmax = 2, m = 2 * cosh(xmax);
            for (var i = 0; i < n + 1; i++) {
                var x = 2 * xmax * (i - n / 2) / n;
                points.push(new THREE.Vector3(cosh(x) / m, 0, (i - n / 2) / n));
            }
            var material = new THREE.MeshLambertMaterial({ color: 0xcfcfcf }),
                geometry = new THREE.LatheGeometry(points, 12),
                cylinder = new THREE.Mesh(geometry, material);
            return cylinder;
        }

        update() {
            var a = this.sourcePoint, b = this.targetPoint;
            var m = new THREE.Vector3();
            m.addVectors(a,b).divideScalar(2);
            this.shape.position = m;
            var origVec = new THREE.Vector3(0, 0, 1);         //vector of cylinder
            var targetVec = new THREE.Vector3();
            targetVec.subVectors(b,a);
            var l = targetVec.length();
            this.shape.scale.set(1,1,l);  
            targetVec.normalize();

            var angle = Math.acos(origVec.dot(targetVec));

            var axis = new THREE.Vector3();
            axis.crossVectors(origVec, targetVec);
            axis.normalize();
            var quaternion = new THREE.Quaternion();
            quaternion.setFromAxisAngle( axis, angle );
            this.shape.quaternion = quaternion;
        }
    }
}

class LinkAccessor implements cola.LinkLengthAccessor<any> {
    getSourceIndex(e: any): number { return e.source; }
    getTargetIndex(e: any): number { return e.target; }
    getLength(e: any): number { return e.length; }
    setLength(e: any, l: number) { e.length = l; }
}

d3.json("graphdata/miserables.json", function (error, graph) {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    var sizeRatio = 0.8;
    renderer.setSize(window.innerWidth * sizeRatio, window.innerHeight * sizeRatio);

    var div = document.getElementById("graphdiv");
    div.appendChild(renderer.domElement);

    var colaObject = new THREE.Object3D();
    colaObject.position = new THREE.Vector3();
    scene.add(colaObject);
    var ambient = new THREE.AmbientLight(0x1f1f1f);
    scene.add(ambient);

    var directionalLight = new THREE.DirectionalLight(0xffeedd);
    directionalLight.position.set(0, 0, 1);
    scene.add(directionalLight);
    var n = graph.nodes.length;

    var color = d3.scale.category20();
    var nodeColourings = graph.nodes.map(v => {
        var str = color(v.group).replace("#", "0x");
        return parseInt(str);
    });
    var colaGraph = new cola3.Graph(colaObject, n, graph.links, nodeColourings);

    var linkAccessor = new LinkAccessor();
    cola.jaccardLinkLengths(graph.links, linkAccessor, 1.5);

    // Create the distance matrix that Cola needs
    var distanceMatrix = (new cola.shortestpaths.Calculator(n, graph.links,
        linkAccessor.getSourceIndex, linkAccessor.getTargetIndex, linkAccessor.getLength)).DistanceMatrix();

    var D = cola.Descent.createSquareMatrix(n, (i, j) => {
        return distanceMatrix[i][j] * 7;
    });
    // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
    // otherwise 2. (
    var G = cola.Descent.createSquareMatrix(n, function () { return 2 });
    graph.links.forEach(function (e) {
        var u = linkAccessor.getSourceIndex(e), v = linkAccessor.getTargetIndex(e);
        G[u][v] = G[v][u] = 1;
    });

    // 3d positions vector
    var k = 3;
    var x = new Array(k);
    for (var i = 0; i < k; ++i) {
        x[i] = new Array(n);
        for (var j = 0; j < n; ++j) {
            x[i][j] = 0;
        }
    }

    var descent = new cola.Descent(x, D);
    descent.run(10);
    descent.G = G;
    camera.position.z = 50;

    var xAngle = 0;
    var yAngle = 0;
    document.onmousedown = mousedownhandler;
    document.onmouseup = mouseuphandler;
    document.onmousemove = mousemovehandler;
    var mouse = {
        down: false,
        x: 0, y: 0,
        dx: 0, dy: 0
    }
    function mousedownhandler(e) {
        mouse.down = true;
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }
    function mouseuphandler(e) {
        mouse.down = false;
    }
    function mousemovehandler(e) {
        if (mouse.down) {
            mouse.dx = e.clientX - mouse.x;
            mouse.x = e.clientX;
            mouse.dy = e.clientY - mouse.y;
            mouse.y = e.clientY;
        }
    }
    var delta = Number.POSITIVE_INFINITY;
    var converged = false;
    var render = function () {
        xAngle += mouse.dx / 100;
        yAngle += mouse.dy / 100;
        colaObject.rotation.set(yAngle, xAngle, 0);
        var s = converged ? 0 : descent.rungeKutta();
        if (s != 0 && Math.abs(Math.abs(delta / s) - 1) > 1e-7) {
            delta = s;
            colaGraph.setNodePositions(descent.x);
            colaGraph.update(); // Update all the edge positions
        } else {
            converged = true;
        }
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    };
    render();
});