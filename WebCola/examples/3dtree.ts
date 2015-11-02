/// <reference path="../extern/three.d.ts"/>
/// <reference path="../src/shortestpaths.ts"/>
/// <reference path="../src/linklengths.ts"/>
/// <reference path="../src/descent.ts"/>
/// <reference path="../src/layout3d.ts"/>
module tree3d {
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
d3.json("graphdata/chris.json", function (error, graph) {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    var sizeRatio = 1;
    var div = document.getElementById("graphdiv");
    renderer.setSize(window.innerWidth * sizeRatio, window.innerHeight * sizeRatio - div.offsetTop);
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
    var colaGraph = new tree3d.Graph(colaObject, n, graph.links, nodeColourings);

    let layout = new cola.Layout3D(graph.nodes, graph.links, 4);
    graph.constraints.forEach(c=> {
        let r = c.right;
        c.right = c.left;
        c.left = r;
        c.gap *= 0.2;
    });
    layout.constraints = graph.constraints;
    layout.start(10);

    camera.position.z = 150;

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
        var s = converged ? 0 : layout.tick();
        if (s != 0 && Math.abs(Math.abs(delta / s) - 1) > 1e-7) {
            delta = s;
            colaGraph.setNodePositions(layout.result);
            colaGraph.update(); // Update all the edge positions
        } else {
            converged = true;
        }
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    };
    render();
});