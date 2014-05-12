/// <reference path="../src/descent.ts"/>
/// <reference path="../src/shortestpaths.ts"/>
/**
    This application uses similarity data between areas of the brain to construct a thresholded graph with edges
    between the most similar areas. It is designed to be embedded in a view defined in brainapp.html / brainapp.ts.
*/

// GLOBAL VARIABLES
declare var d3;

var sliderSpace = 70; // The number of pixels to reserve at the bottom of the div for the slider
var uniqueID = 0; // Each instance of this application is given a unique ID so that the DOM elements they create can be identified as belonging to them
var maxEdgesShowable = 500;
var initialEdgesShown = 20; // The number of edges that are shown when the application starts

// The width and the height of the box in the xy-plane that we must keep inside the camera (by modifying the distance of the camera from the scene)
var widthInCamera = 520;
var heightInCamera = 360;

// TODO: Proper reset and destruction of the application (the 'instances' variable will continue to hold a reference - this will cause the application to live indefinitely)
var instances = Array<Brain3DApp>(0); // Stores each instance of an application under its id, for lookup by the slider input element

function sliderChangeForID(id: number, v: number) {
    instances[id].sliderChange(v);
}

class Brain3DApp implements Application, Loopable {

    id: number;
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
    sortedSimilarities: number[];
    physioGraph: Graph;
    colaGraph: Graph;

    nodeColourings: number[]; // Stores the colourings associated with the groups
    dissimilarityMatrix: number[][] = []; // An inversion of the similarity matrix, used for Cola graph distances

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
    graphOffset: number = 120;
    colaLinkDistance = 15;
    d3ColorSelector = d3.scale.category20();

    constructor(commonData: CommonData, jDiv, inputTargetCreator: (l:number, r:number, t:number, b:number) => InputTarget) {
        this.id = uniqueID++;
        instances[this.id] = this;
        this.commonData = commonData;
        this.input = inputTargetCreator(0, 0, 0, sliderSpace);

        // Register callbacks
        this.input.regKeyTickCallback('a', (deltaTime: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y - this.rotationSpeed * deltaTime, this.brainObject.rotation.z);
            this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y - this.rotationSpeed * deltaTime, this.colaObject.rotation.z);
        });

        this.input.regKeyTickCallback('d', (deltaTime: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y + this.rotationSpeed * deltaTime, this.brainObject.rotation.z);
            this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y + this.rotationSpeed * deltaTime, this.colaObject.rotation.z);
        });

        this.input.regKeyTickCallback('w', (deltaTime: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x - this.rotationSpeed * deltaTime, this.brainObject.rotation.y, this.brainObject.rotation.z);
            this.colaObject.rotation.set(this.colaObject.rotation.x - this.rotationSpeed * deltaTime, this.colaObject.rotation.y, this.colaObject.rotation.z);
        });

        this.input.regKeyTickCallback('s', (deltaTime: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x + this.rotationSpeed * deltaTime, this.brainObject.rotation.y, this.brainObject.rotation.z);
            this.colaObject.rotation.set(this.colaObject.rotation.x + this.rotationSpeed * deltaTime, this.colaObject.rotation.y, this.colaObject.rotation.z);
        });

        var leapRotationSpeed = 0.03; // radians per mm
        this.input.regLeapXCallback((mm: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y, this.brainObject.rotation.z + leapRotationSpeed * mm);
            this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y, this.colaObject.rotation.z + leapRotationSpeed * mm);
        });

        this.input.regLeapYCallback((mm: number) => {
            this.brainObject.rotation.set(this.brainObject.rotation.x - leapRotationSpeed * mm, this.brainObject.rotation.y, this.brainObject.rotation.z);
            this.colaObject.rotation.set(this.colaObject.rotation.x - leapRotationSpeed * mm, this.colaObject.rotation.y, this.colaObject.rotation.z);
        });

        this.input.regKeyDownCallback(' ', () => {
            if (!this.transitionInProgress) {
                // Leave *showingCola* on permanently after first turn-on
                this.showingCola = true;

                // Find the edges that have been selected after thresholding, and all the
                // nodes that have neighbours after the thresholding of the edges takes place.
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

                this.colaGraph.setNodeVisibilities(hasNeighbours); // Hide the nodes without neighbours
                this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix); // Hide the edges that have not been selected

                var getSourceIndex = function (e) {
                    return e.source;
                }
                var getTargetIndex = function (e) {
                    return e.target;
                }
                var getLength = function (e) {
                    return 1;
                }
                // Create the distance matrix that Cola needs
                var distanceMatrix = (new shortestpaths.Calculator(this.commonData.nodeCount, edges, getSourceIndex, getTargetIndex, getLength)).DistanceMatrix();

                var D = cola.Descent.createSquareMatrix(this.commonData.nodeCount, (i, j) => {
                    return distanceMatrix[i][j] * this.colaLinkDistance;
                });

                var clonedPhysioCoords = this.commonData.brainCoords.map(function (dim) {
                    return dim.map(function (element) {
                        return element;
                    });
                });
                this.descent = new cola.Descent(clonedPhysioCoords, D); // Create the solver
                this.colaCoords = this.descent.x; // Hold a reference to the solver's coordinates
                // Relieve some of the initial stress
                for (var i = 0; i < 10; ++i) {
                    this.descent.reduceStress();
                }

                // Set up a coroutine to do the animation
                var origin = new THREE.Vector3(-this.graphOffset, 0, 0);
                var target = new THREE.Vector3(this.graphOffset, 0, 0);
                this.colaObject.position = origin;
                this.colaGraph.setNodePositions(this.commonData.brainCoords); // Move the Cola graph nodes to their starting position
                this.colaGraph.setVisible(true);
                this.transitionInProgress = true;

                setCoroutine({ currentTime: 0, endTime: this.modeLerpLength }, (o, deltaTime) => {
                    o.currentTime += deltaTime;

                    if (o.currentTime >= o.endTime) { // The animation has finished
                        this.colaObject.position = target;
                        this.colaGraph.setNodePositions(this.colaCoords);
                        this.transitionInProgress = false;
                        return true;
                    }
                    else { // Update the animation
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

        // Set up renderer, and add the canvas and the slider to the div
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(jDiv.width(), (jDiv.height() - sliderSpace));
        jDiv.append(this.renderer.domElement)
            .append('<p>Showing <label id="count-' + this.id + '">0</label> edges (<label id=percentile-' + this.id + '>0</label>th percentile)</p>')
            .append($('<input id="edge-count-slider-' + this.id + '" type="range" min="1" max="' + maxEdgesShowable + '" value="' + initialEdgesShown +
                '" onchange="sliderChangeForID(' + this.id + ', this.value)" disabled="true"/>').css({ width: '400px' }));

        // Set up camera
        this.camera = new THREE.PerspectiveCamera(45, 1, this.nearClip, this.farClip);
        this.resize(jDiv.width(), jDiv.height());

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
            // Clone the mesh - we can't share it between different canvases without cloning it
            var clonedObject = new THREE.Object3D();
            this.commonData.brainSurface.traverse(function (child) {
                if (child instanceof THREE.Mesh) {
                    clonedObject.add(new THREE.Mesh(child.geometry.clone(), child.material.clone()));
                }
            });
            // Setting scale to some arbitrarily larger value, because the mesh isn't the right size
            var scale = 1.5;
            clonedObject.scale = new THREE.Vector3(scale, scale, scale);
            this.brainSurface = clonedObject;
            this.brainObject.add(this.brainSurface);
        };
        commonData.regNotifyCoords(coords);
        commonData.regNotifyLabels(lab);
        commonData.regNotifySurface(surf);
        if (commonData.brainCoords) coords();
        if (commonData.brainLabels) lab();
        if (commonData.brainSurface) surf();
    }

    sliderChange(numEdges) {
        var max = this.commonData.nodeCount * (this.commonData.nodeCount - 1) / 2;
        if (numEdges > max) numEdges = max;
        $('#count-' + this.id).get(0).textContent = numEdges;
        var percentile = numEdges * 100 / max;
        $('#percentile-' + this.id).get(0).textContent = percentile.toFixed(2);
        this.filteredAdjMatrix = this.adjMatrixFromEdgeCount(numEdges);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    }

    resize(width: number, height: number) {
        // Resize the renderer
        this.renderer.setSize(width, height - sliderSpace);
        // Calculate the aspect ratio
        var aspect = width / (height - sliderSpace);
        this.camera.aspect = aspect;
        // Calculate the FOVs
        var verticalFov = Math.atan(height / window.outerHeight); // Scale the vertical fov with the vertical height of the window (up to 45 degrees)
        var horizontalFov = verticalFov * aspect;
        this.camera.fov = verticalFov * 180 / Math.PI;
        this.camera.updateProjectionMatrix();
        // Work out how far away the camera needs to be
        var distanceByH = (widthInCamera / 2) / Math.tan(horizontalFov / 2);
        var distanceByV = (heightInCamera / 2) / Math.tan(verticalFov / 2);
        // Select the maximum distance of the two
        this.camera.position.set(0, 0, Math.max(distanceByH, distanceByV));
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

        // Sort the similarities into a list so we can filter edges
        this.sortedSimilarities = [];
        for (var i = 0; i < this.dataSet.simMatrix.length; ++i) {
            var row = this.dataSet.simMatrix[i];
            for (var j = i + 1; j < row.length; ++j) { // Only take the values in the upper-triangular portion of the matrix
                this.sortedSimilarities.push(row[j]);
            }
        }
        this.sortedSimilarities.sort(function (a, b) { return b - a; });

        // Create the dissimilarity matrix from the similarity matrix (we need dissimilarity for Cola)
        for (var i = 0; i < this.dataSet.simMatrix.length; ++i) {
            this.dissimilarityMatrix.push(this.dataSet.simMatrix[i].map((sim) => {
                return 15 / (sim + 1); // Convert similarities to distances
            }));
        }

        // Set up the node colourings
        this.nodeColourings = this.dataSet.attributes.get('module_id').map((group: number) => {
            var str = this.d3ColorSelector(group).replace("#", "0x");
            return parseInt(str);
        });

        // Set up loop
        if (!this.loop)
            this.loop = new Loop(this, 0.03);

        // Set up the two graphs
        var edgeMatrix = this.adjMatrixFromEdgeCount(maxEdgesShowable); // Don''t create more edges than we will ever be showing
        if (this.physioGraph) this.physioGraph.destroy();
        this.physioGraph = new Graph(this.brainObject, edgeMatrix, this.nodeColourings);
        this.physioGraph.setNodePositions(this.commonData.brainCoords);

        var edgeMatrix = this.adjMatrixFromEdgeCount(maxEdgesShowable);
        if (this.colaGraph) this.colaGraph.destroy();
        this.colaGraph = new Graph(this.colaObject, edgeMatrix, this.nodeColourings);
        this.colaGraph.setVisible(false);

        // Initialize the filtering
        this.filteredAdjMatrix = this.adjMatrixFromEdgeCount(initialEdgesShown);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.sliderChange(initialEdgesShown);

        // Enable the slider
        $('#edge-count-slider-' + this.id).prop('disabled', false);
    }

    // Create a matrix where a 1 in (i, j) means the edge between node i and node j is selected
    adjMatrixFromEdgeCount(count: number) {
        var max = this.commonData.nodeCount * (this.commonData.nodeCount - 1) / 2;
        if (count > max) count = max;
        var threshold = this.sortedSimilarities[count - 1];
        var adjMatrix: number[][] = Array<Array<number>>(this.commonData.nodeCount);
        for (var i = 0; i < this.commonData.nodeCount; ++i) {
            adjMatrix[i] = new Array<number>(this.commonData.nodeCount);
        }

        for (var i = 0; i < this.commonData.nodeCount - 1; ++i) {
            adjMatrix[i] = new Array<number>(this.commonData.nodeCount);
            for (var j = i + 1; j < this.commonData.nodeCount; ++j) {
                var val = this.dataSet.simMatrix[i][j];
                if (val >= threshold) { // Accept an edge between nodes that are at least as similar as the threshold value
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
            if ((<any>intersected[i].object).isNode) { // Node objects have this special boolean flag
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

        var node = this.getNodeUnderPointer(this.input.localPointerPosition());
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
            this.descent.rungeKutta(); // Do an iteration of the solver

        this.colaGraph.update(); // Update all the edge positions
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
            (<any>sphere).isNode = true; // A flag to identify the node meshes
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

/* Functions can be pushed to the coroutines array to be executed as if they are
 * occuring in parallel with the program execution.
 */
var coroutines = new Array();

function setCoroutine(data, func) {
    data.func = func;
    coroutines.push(data);
}