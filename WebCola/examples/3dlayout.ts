module cola3 {
    export class Graph {
        parentObject;
        rootObject;
        nodeMeshes: any[];
        edgeList: Edge[] = [];
        visible: boolean = true;

        constructor(parentObject, n: number, edges: { source: number; target: number }[], nodeColourings: number[]) {
            this.parentObject = parentObject;
            this.rootObject = new THREE.Object3D();
            parentObject.add(this.rootObject);

            // Create all the node meshes
            this.nodeMeshes = Array(n);
            for (var i = 0; i < n; ++i) {
                var sphere = this.nodeMeshes[i] = new THREE.Mesh(
                    new THREE.SphereGeometry(1, 10, 10), new THREE.MeshLambertMaterial(
                        { color: nodeColourings[i] }
                        )
                    );
                sphere.isNode = true; // A flag to identify the node meshes
                sphere.id = i;
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

        setVisible(flag: boolean) {
            if (flag) {
                if (!this.visible) {
                    this.parentObject.add(this.rootObject);
                    this.visible = true;
                }
            } else {
                if (this.visible) {
                    this.parentObject.remove(this.rootObject);
                    this.visible = false;
                }
            }
        }

        setNodeVisibilities(visArray: boolean[]) {
            for (var i = 0; i < visArray.length; ++i) {
                if (visArray[i])
                    this.rootObject.add(this.nodeMeshes[i]);
                else
                    this.rootObject.remove(this.nodeMeshes[i]);
            }
        }

        selectNode(id: number) {
            this.nodeMeshes[id].scale.set(2, 2, 2);
        }

        deselectNode(id: number) {
            this.nodeMeshes[id].scale.set(1, 1, 1);
        }

        update() {
            this.edgeList.forEach(e => e.update());
        }

        // Remove self from the scene so that the object can be GC'ed
        destroy() {
            this.parentObject.remove(this.rootObject);
        }
    }

    function makeCylinder() {
        var n = 12, points = [],
            cosh = v => (Math.pow(Math.E, v) + Math.pow(Math.E, -v)) / 2;
        var xmax = 2, m = 2 * cosh(xmax);
        for (var i = 0; i < n + 1; i++) {
            var x = 2 * xmax * (i - n / 2) / n;
            points.push(new THREE.Vector3(cosh(x)/m, 0, (i - n / 2) / n));
        }

        var material = new THREE.MeshLambertMaterial({ color: 0xcfcfcf }),
            geometry = new THREE.LatheGeometry(points, 12), 
            cylinder = new THREE.Mesh(geometry, material);
        cylinder.overdraw = true;
        return cylinder;
    }

    export class Edge {
        line;
        geometry;
        shape;
        visible: boolean = true;

        constructor(public parentObject, endPoint1, endPoint2) {
            this.geometry = new THREE.Geometry();
            this.geometry.vertices.push(endPoint1);
            this.geometry.vertices.push(endPoint2);
            this.line = new THREE.Line(this.geometry, new THREE.LineBasicMaterial({ color: 0x000000 }));

            parentObject.add(this.line);
            this.shape = makeCylinder();
            parentObject.add(this.shape);
        }

        setVisible(flag: boolean) {
            if (flag) {
                if (!this.visible) {
                    this.parentObject.add(this.line);
                    this.visible = true;
                }
            } else {
                if (this.visible) {
                    this.parentObject.remove(this.line);
                    this.visible = false;
                }
            }
        }

        update() {
            this.geometry.verticesNeedUpdate = true;
            var a = this.geometry.vertices[0], b = this.geometry.vertices[1];
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


d3.json("graphdata/miserables.json", function (error, graph) {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth/1.2, window.innerHeight/1.2);
    var div = document.getElementById("graphdiv");
    div.appendChild(renderer.domElement);

    var colaObject = new THREE.Object3D();
    colaObject.position = new THREE.Vector3(0, 0, 0);
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

    var getSourceIndex = e => e.source;
    var getTargetIndex = e => e.target;
    var getLength = e=> 1;

    var linkAccessor: cola.LinkLengthAccessor<any> = {
        getSourceIndex: e => e.source,
        getTargetIndex: e => e.target,
        getLength: e => e.length,
        setLength: (e, l) => { e.length = l }
    };
    cola.jaccardLinkLengths(graph.nodes.length, graph.links, linkAccessor, 1.5);

    // Create the distance matrix that Cola needs
    var distanceMatrix = (new shortestpaths.Calculator(n, graph.links, getSourceIndex, getTargetIndex, getLength)).DistanceMatrix();

    var D = cola.Descent.createSquareMatrix(n, (i, j) => {
        return distanceMatrix[i][j] * 7;
    });
    // G is a square matrix with G[i][j] = 1 iff there exists an edge between node i and node j
    // otherwise 2. (
    var G = cola.Descent.createSquareMatrix(n, function () { return 2 });
    graph.links.forEach(function (e) {
        var u = getSourceIndex(e), v = getTargetIndex(e);
        G[u][v] = G[v][u] = 1;
    });

    var k = 3;
    var x = new Array(k);
    for (var i = 0; i < k; ++i) {
        x[i] = new Array(n);
        for (var j = 0; j < n; ++j) {
            x[i][j] = 0;
        }
    }

    var descent = new cola.Descent(x, D);
    descent.run(30);
    descent.G = G;
    camera.position.z = 50;

    var xAngle = 0;
    var yAngle = 0;
    document.onmousedown = mousedownhandler;
    document.onmouseup = mouseuphandler;
    document.onmousemove = mousemovehandler;
    var mousedown = false;
    var mousex = 0;
    var mousey = 0;
    function mousedownhandler(e) {
        mousedown = true;
        mousex = e.clientX;
        mousey = e.clientY;
    }
    function mouseuphandler(e) {
        mousedown = false;
    }
    var dx = 0, dy = 0;
    function mousemovehandler(e) {
        if (mousedown) {
            dx = e.clientX - mousex;
            mousex = e.clientX;
            dy = e.clientY - mousey;
            mousey = e.clientY;
        }
    }
    var stress = Number.POSITIVE_INFINITY;
    var converged = false;
    var render = function () {
        xAngle += dx / 100;
        yAngle += dy / 100;
        colaObject.rotation.set(yAngle, xAngle, 0);
        var s = converged ? 0 : descent.rungeKutta();
        if (s != 0 && Math.abs(Math.abs(stress / s) - 1) > 1e-7) {
            stress = s;
            colaGraph.setNodePositions(descent.x);
        } else {
            converged = true;
        }
        colaGraph.update(); // Update all the edge positions
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    };
    render();
});