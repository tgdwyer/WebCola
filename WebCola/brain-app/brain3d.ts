// GLOBAL VARIABLES
declare var THREE;
declare var d3;

class Brain3DApp implements Application, Loopable {

    loop: Loop;
    input: InputTarget;

    // THREE variables
    camera;
    scene;
    renderer;
    projector = new THREE.Projector();

    descent: cola.Descent; // The handle to the constraint solver

    // Data/objects
    commonData: CommonData;
    dataSet: DataSet;
    brainSurface;
    brainObject; // Base object for the brain graph
    colaObject; // Base object for the cola graph
    brainGeometry;
    colaCoords: number[][];
    percentiles: number[] = new Array(101);
    physioGraph: Graph;
    colaGraph: Graph;

    nodeColourings: number[]; // Stores the colourings associated with the groups
    dissimilarityMatrix: number[][] = []; // An inversion of the similarity matrix, used for Cola graph distances
    minSimilarity: number = Number.MAX_VALUE;
    maxSimilarity: number = 0;

    // State
    showingCola: boolean = false;
    transitionInProgress: boolean = false;
    currentThreshold: number = 0;
    filteredAdjMatrix: number[][];
    selectedNodeID = -1;

    // Constants
    nearClip = 1;
    farClip = 2000;
    modeLerpLength: number = 0.6;
    rotationSpeed: number = 1.2;
    graphOffset: number = 100;
    colaLinkDistance = 15;
    d3ColorSelector = d3.scale.category20();

    constructor(commonData: CommonData, jDiv, input: InputTarget) {
        this.commonData = commonData;
        this.input = input;

        // Register callbacks
        input.regKeyDownCallback('1', () => {
            if (this.currentThreshold > 0) {
                this.currentThreshold -= 1;
                this.filteredAdjMatrix = this.adjMatrixFromThreshold(this.currentThreshold);
                this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
            }
        });
        input.regKeyDownCallback('2', () => {
            if (this.currentThreshold < 3) {
                this.currentThreshold += 1;
                this.filteredAdjMatrix = this.adjMatrixFromThreshold(this.currentThreshold);
                this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
            }
        });

        input.regKeyTickCallback('a', (deltaTime: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y - this.rotationSpeed * deltaTime, 0);
            this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y - this.rotationSpeed * deltaTime, 0);
        });

        input.regKeyTickCallback('d', (deltaTime: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y + this.rotationSpeed * deltaTime, 0);
            this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y + this.rotationSpeed * deltaTime, 0);
        });

        input.regKeyTickCallback('w', (deltaTime: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x - this.rotationSpeed * deltaTime, this.brainObject.rotation.y, 0);
            this.colaObject.rotation.set(this.colaObject.rotation.x - this.rotationSpeed * deltaTime, this.colaObject.rotation.y, 0);
        });

        input.regKeyTickCallback('s', (deltaTime: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x + this.rotationSpeed * deltaTime, this.brainObject.rotation.y, 0);
            this.colaObject.rotation.set(this.colaObject.rotation.x + this.rotationSpeed * deltaTime, this.colaObject.rotation.y, 0);
        });

        input.regKeyDownCallback(' ', () => {
            if (!this.transitionInProgress) {
                // Leave *showingCola* on permanently after first turn-on

                /*if (this.showingCola) {
                    this.showingCola = false;
                    this.colaGraph.setVisible(false);
                } else {*/
                this.showingCola = true;

                var edges = [];
                var hasNeighbours = Array<boolean>(this.commonData.nodeCount);
                for (var i = 0; i < this.commonData.nodeCount - 1; ++i) {
                    for (var j = i + 1; j < this.commonData.nodeCount; ++j) {
                        if (this.filteredAdjMatrix[i][j] === 1) {
                            edges.push({ source: i, target: j });
                            hasNeighbours[i] = true;
                            hasNeighbours[j] = true;
                        }
                    }
                }

                this.colaGraph.setNodeVisibilities(hasNeighbours);
                this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix);

                var distanceMatrix = (new shortestpaths.Calculator(this.commonData.nodeCount, edges)).DistanceMatrix();

                var D = cola.Descent.createSquareMatrix(this.commonData.nodeCount, (i, j) => {
                    return distanceMatrix[i][j] * this.colaLinkDistance;
                });

                var clonedPhysioCoords = this.commonData.brainCoords.map(function (dim) {
                    return dim.map(function (element) {
                        return element;
                    });
                });
                this.descent = new cola.Descent(clonedPhysioCoords, D);
                this.colaCoords = this.descent.x; // Hold a reference to the solver's coordinates
                for (var i = 0; i < 10; ++i) {
                    this.descent.reduceStress();
                }

                // Set up a coroutine to do the animation
                var origin = new THREE.Vector3(-this.graphOffset, 0, 0);
                var target = new THREE.Vector3(this.graphOffset, 0, 0);
                this.colaObject.position = origin;
                this.colaGraph.setNodePositions(this.commonData.brainCoords);
                this.colaGraph.setVisible(true);
                this.transitionInProgress = true;

                setCoroutine({ currentTime: 0, endTime: this.modeLerpLength }, (o, deltaTime) => {
                    o.currentTime += deltaTime;

                    if (o.currentTime >= o.endTime) {
                        this.colaObject.position = target;
                        this.colaGraph.setNodePositions(this.colaCoords);
                        this.transitionInProgress = false;
                        return true;
                    }
                    else {
                        var percentDone = o.currentTime / o.endTime;
                        this.colaObject.position = origin.clone().add(target.clone().sub(origin).multiplyScalar(percentDone));
                        this.colaGraph.setNodePositionsLerp(this.commonData.brainCoords, this.colaCoords, percentDone);
                        return false;
                    }
                });
            }
        });

        // Set the background colour
        jDiv.css({backgroundColor: '#ffffff' });

        // Set up renderer
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(jDiv.width(), jDiv.height());
        jDiv.get(0).appendChild(this.renderer.domElement);

        // Set up camera
        this.camera = new THREE.PerspectiveCamera(45, jDiv.width() / jDiv.height(), this.nearClip, this.farClip);
        this.camera.position.set(0, 0, 400);

        // Set up scene
        this.scene = new THREE.Scene();

        var ambient = new THREE.AmbientLight(0x1f1f1f);
        this.scene.add(ambient);

        var directionalLight = new THREE.DirectionalLight(0xffeedd);
        directionalLight.position.set(0, 0, 1);
        this.scene.add(directionalLight);

        // Set up the base objects for the graphs
        this.brainObject = new THREE.Object3D();
        this.brainObject.position = new THREE.Vector3(-this.graphOffset, 0, 0);
        this.scene.add(this.brainObject);

        this.colaObject = new THREE.Object3D();
        this.colaObject.position = new THREE.Vector3(-this.graphOffset, 0, 0);
        this.scene.add(this.colaObject);

        // Register the data callbacks
        var coords = () => {
            this.restart();
        };
        var lab = () => {
            // We don't use labels in this visualisation yet
        };
        var surf = () => {
            // Remove the old mesh and add the new one (we don't need a restart)
            this.brainObject.remove(this.brainSurface);
            this.brainSurface = this.commonData.brainSurface;
            this.brainObject.add(this.brainSurface);
        };
        commonData.regNotifyCoords(coords);
        commonData.regNotifyLabels(lab);
        commonData.regNotifySurface(surf);
        if (commonData.brainCoords) coords();
        if (commonData.brainLabels) lab();
        if (commonData.brainSurface) surf();
    }

    resize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    setDataSet(dataSet: DataSet) {
        this.dataSet = dataSet;

        var sim = () => {
            this.restart();
        };
        var att = () => {
            this.restart(); // TODO: We're currently destroying the entire graph to switch out the node group information - we can do better than that
        };
        dataSet.regNotifySim(sim);
        dataSet.regNotifyAttributes(att);
        if (dataSet.simMatrix) sim();
        if (dataSet.attributes) att();
    }

    // Initialize or re-initialize the visualisation.
    restart() {
        if (!this.commonData.brainCoords || !this.dataSet || !this.dataSet.simMatrix || !this.dataSet.attributes) return;

        this.createDissimilarityMatrix();

        // Set up the node colourings
        this.nodeColourings = this.dataSet.attributes.get('module_id').map((group: number) => {
            var str = this.d3ColorSelector(group).replace("#", "0x");
            return parseInt(str);
        });

        // Set up loop
        if (!this.loop)
            this.loop = new Loop(this, 0.03);

        // Set up the two graphs
        var edgeMatrix = this.adjMatrixFromThreshold(3); // Limit the edge creation to the 3rd percentile
        if (this.physioGraph) this.physioGraph.destroy();
        this.physioGraph = new Graph(this.brainObject, edgeMatrix, this.nodeColourings);
        this.physioGraph.setNodePositions(this.commonData.brainCoords);

        var edgeMatrix = this.adjMatrixFromThreshold(3);
        if (this.colaGraph) this.colaGraph.destroy();
        this.colaGraph = new Graph(this.colaObject, edgeMatrix, this.nodeColourings);
        this.colaGraph.setVisible(false);

        // Initialize the filtering
        this.filteredAdjMatrix = this.adjMatrixFromThreshold(this.currentThreshold);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    }

    createDissimilarityMatrix() {
        for (var i = 0; i < this.dataSet.simMatrix.length; ++i) {
            this.dissimilarityMatrix.push(this.dataSet.simMatrix[i].map(
                (sim) => {
                    this.minSimilarity = Math.min(this.minSimilarity, sim);
                    this.maxSimilarity = Math.max(this.maxSimilarity, sim);
                    return 15 / (sim + 1); // Convert similarities to distances
                }
                ));
        }

        // Calculate the percentiles
        var orderedWeights = [];
        for (var i = 0; i < this.dataSet.simMatrix.length; ++i) {
            var row = this.dataSet.simMatrix[i];
            for (var j = 0; j < row.length; ++j) {
                orderedWeights.push(row[j]);
            }
        }
        orderedWeights.sort(function (a, b) { return a - b });
        var k = orderedWeights.length / 100;
        for (var i = 0; i < 100; ++i) {
            this.percentiles[i] = orderedWeights[Math.floor(i * k)];
        }
        this.percentiles[100] = orderedWeights[orderedWeights.length - 1];
    }

    // Select the given percentage of links
    // TODO: REMOVE SYMMETRIC FILLING IF NOT NEEDED
    adjMatrixFromThreshold(percent: number) {
        var threshold = this.percentiles[percent];
        var adjMatrix: number[][] = Array<Array<number>>(this.commonData.nodeCount);
        for (var i = 0; i < this.commonData.nodeCount; ++i) {
            adjMatrix[i] = new Array<number>(this.commonData.nodeCount);
        }

        for (var i = 0; i < this.commonData.nodeCount - 1; ++i) {
            adjMatrix[i] = new Array<number>(this.commonData.nodeCount);
            for (var j = i + 1; j < this.commonData.nodeCount; ++j) {
                var val = this.dataSet.simMatrix[i][j];
                if (val < threshold) {
                    adjMatrix[i][j] = adjMatrix[j][i] = 1;
                }
                else {
                    adjMatrix[i][j] = adjMatrix[j][i] = 0;
                }
            }
        }

        return adjMatrix;
    }

    getNodeUnderPointer(pointer) {
        var pointerNDC = new THREE.Vector3(pointer.x, pointer.y, 1);
        this.projector.unprojectVector(pointerNDC, this.camera);
        var directionVector = pointerNDC.sub(this.camera.position);
        directionVector.normalize();

        var raycaster = new THREE.Raycaster(this.camera.position, directionVector, this.nearClip, this.farClip);
        var intersected = raycaster.intersectObjects(this.scene.children, true);

        for (var i = 0; i < intersected.length; ++i) {
            if (intersected[i].object.isNode) { // Nodes have this special boolean flag
                return intersected[i].object;
            }
        }

        return null;
    }

    update(deltaTime: number) {
        // Execute coroutines
        for (var i = 0; i < coroutines.length;) {
            if (coroutines[i].func(coroutines[i], deltaTime))
                coroutines.splice(i, 1);
            else
                ++i;
        }

        var node = this.getNodeUnderPointer(this.input.localMousePosition());
        if (node) {
            // If we already have a node ID selected, deselect it
            if (this.selectedNodeID >= 0) {
                this.physioGraph.deselectNode(this.selectedNodeID);
                this.colaGraph.deselectNode(this.selectedNodeID);
            }
            this.selectedNodeID = node.id;
            // Select the new node ID
            this.physioGraph.selectNode(this.selectedNodeID);
            this.colaGraph.selectNode(this.selectedNodeID);
        }

        if (this.showingCola)
            this.descent.rungeKutta();

        this.colaGraph.update(); // Updates all the edge positions

        this.draw(); // Draw the graph
    }

    draw() {
        this.renderer.render(this.scene, this.camera);
    }
}

class Graph {
    parentObject;
    rootObject;
    nodeMeshes: any[];
    edgeMatrix: any[][];
    edgeList: Edge[] = [];
    visible: boolean = true;

    constructor(parentObject, adjMatrix: any[][], nodeColourings: number[]) {
        this.parentObject = parentObject;
        this.rootObject = new THREE.Object3D();
        parentObject.add(this.rootObject);

        // Create all the node meshes
        this.nodeMeshes = Array(adjMatrix.length);
        for (var i = 0; i < adjMatrix.length; ++i) {
            var sphere = this.nodeMeshes[i] = new THREE.Mesh(
                new THREE.SphereGeometry(2, 10, 10), new THREE.MeshLambertMaterial(
                    { color: nodeColourings[i] }
                    )
                );
            sphere.isNode = true; // A flag to identify the node meshes
            sphere.id = i;
            this.rootObject.add(sphere);
        }

        // Create all the edges
        var len = adjMatrix.length;
        for (var i = 0; i < len - 1; ++i) {
            adjMatrix[i][i] = null;
            for (var j = i + 1; j < len; ++j) {
                if (adjMatrix[i][j] === 1) {
                    this.edgeList.push(adjMatrix[i][j] = adjMatrix[j][i] = new Edge(this.rootObject, this.nodeMeshes[i].position, this.nodeMeshes[j].position));
                } else {
                    adjMatrix[i][j] = adjMatrix[j][i] = null;
                }
            }
        }
        adjMatrix[len - 1][len - 1] = null;

        this.edgeMatrix = adjMatrix;
    }

    setNodePositions(colaCoords: number[][]) {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].position.x = colaCoords[0][i];
            this.nodeMeshes[i].position.y = colaCoords[1][i];
            this.nodeMeshes[i].position.z = colaCoords[2][i];
        }
    }

    // Lerp between the physio and Cola positions of the nodes
    // 0 <= t <= 1
    setNodePositionsLerp(colaCoords1: number[][], colaCoords2: number[][], t: number) {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].position.x = colaCoords1[0][i] * (1 - t) + colaCoords2[0][i] * t;
            this.nodeMeshes[i].position.y = colaCoords1[1][i] * (1 - t) + colaCoords2[1][i] * t;
            this.nodeMeshes[i].position.z = colaCoords1[2][i] * (1 - t) + colaCoords2[2][i] * t;
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

    setEdgeVisibilities(visMatrix: number[][]) {
        var len = visMatrix.length;
        for (var i = 0; i < len - 1; ++i) {
            for (var j = i + 1; j < len; ++j) {
                var edge = this.edgeMatrix[i][j];
                if (edge) edge.setVisible(visMatrix[i][j] === 1 ? true : false);
            }
        }
    }

    selectNode(id: number) {
        this.nodeMeshes[id].scale.set(2, 2, 2);
    }

    deselectNode(id: number) {
        this.nodeMeshes[id].scale.set(1, 1, 1);
    }

    update() {
        this.edgeList.forEach(function (edge) {
            edge.update();
        });
    }

    // Remove self from the scene so that the object can be GC'ed
    destroy() {
        this.parentObject.remove(this.rootObject);
    }
}

class Edge {
    line;
    geometry;
    visible: boolean = true;

    constructor(public parentObject, endPoint1, endPoint2) {
        this.geometry = new THREE.Geometry();
        this.geometry.vertices.push(endPoint1);
        this.geometry.vertices.push(endPoint2);
        this.line = new THREE.Line(this.geometry, new THREE.LineBasicMaterial({ color: 0x000000 }));
        parentObject.add(this.line);
        //this.highlighted = false;
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
    }
}

/*
class Edge {
    static construct = Edge.staticConstructor();
    static material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: 0xFFFFFF }); // DOUBLE SIDE used for debug
    static geometryTemplate;

    object;
    visible: boolean = false;

    static staticConstructor() {
        var geo = new THREE.Geometry();
        // Left tip
        geo.vertices.push(new THREE.Vector3(-0.5, 0, 0));
        geo.vertices.push(new THREE.Vector3(-0.45, -0.05, 0));
        geo.vertices.push(new THREE.Vector3(-0.45, 0.05, 0));
        // Right tip
        geo.vertices.push(new THREE.Vector3(0.5, 0, 0));
        geo.vertices.push(new THREE.Vector3(0.45, 0.05, 0));
        geo.vertices.push(new THREE.Vector3(0.45, -0.05, 0));
        geo.faces.push(new THREE.Face3(0, 1, 2, new THREE.Vector3(0, 0, 1)));
        geo.faces.push(new THREE.Face3(3, 4, 5, new THREE.Vector3(0, 0, 1)));
        geo.faces.push(new THREE.Face3(1, 4, 2, new THREE.Vector3(0, 0, 1)));
        geo.faces.push(new THREE.Face3(1, 5, 4, new THREE.Vector3(0, 0, 1)));
        Edge.geometryTemplate = geo;
    }

    constructor(public parentObject, public endPoint1, public endPoint2) {
        this.object = new THREE.Object3D();
        this.object.add(Edge.geometryTemplate.clone());
        this.visible = false;
        //this.highlighted = false;
    }

    static createArrowHead(dir) {
    var geo = new THREE.Geometry();
    
    geo.faces[0] = new THREE.Face3(0, 1, 2, new THREE.Vector3(0, 0, 1));
    geo.faces[0].vertexColors = [edgeTailColor, edgeTailColor, edgeTailColor];
    return geo;
    }

    setOpacity(opacity: number) {

    }

    update() {

    }
}

var edgeHeadColorBase = new THREE.Color();
edgeHeadColorBase.setRGB(1, 0, 0);
var edgeHeadColorBright = new THREE.Color();
edgeHeadColorBright.setRGB(1, 1, 0);
var edgeTailColor = new THREE.Color();
edgeTailColor.setRGB(0.5, 0, 1);

var edgeHeadColorBaseH = new THREE.Color();
edgeHeadColorBaseH.setRGB(1, 0, 0);
var edgeHeadColorBrightH = new THREE.Color();
edgeHeadColorBrightH.setRGB(1, 1, 0);
var edgeTailColorH = new THREE.Color();
edgeTailColorH.setRGB(1, 0.3, 1);
*/

/* Functions can be pushed to the coroutines array to be executed as if they are
 * occuring in parallel with the program execution.
 */
var coroutines = new Array();

function setCoroutine(data, func) {
    data.func = func;
    coroutines.push(data);
}