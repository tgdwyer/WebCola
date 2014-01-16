
var Simulation = (function () {
    function Simulation(brainGeometry, simMatrix, nodeGroups, nodeLabels, physioCoords) {
        var _this = this;
        this.projector = new THREE.Projector();
        this.percentiles = new Array(101);
        this.dissimilarityMatrix = [];
        this.minSimilarity = Number.MAX_VALUE;
        this.maxSimilarity = 0;
        // State
        this.showingCola = false;
        this.transitionInProgress = false;
        this.currentThreshold = 0;
        this.selectedNodeID = -1;
        // Constants
        this.nearClip = 1;
        this.farClip = 2000;
        this.modeLerpLength = 0.6;
        this.rotationSpeed = 1.2;
        this.graphOffset = 100;
        this.colaLinkDistance = 15;
        this.d3ColorSelector = d3.scale.category20();
        this.nodeCount = nodeGroups.length;
        this.similarityMatrix = simMatrix;
        this.createDissimilarityMatrix();
        this.nodeGroups = nodeGroups;
        this.nodeLabels = nodeLabels;
        this.physioCoords = physioCoords;

        var container = document.createElement('div');
        document.body.appendChild(container);

        // Set up renderer
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        // Set up camera
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, this.nearClip, this.farClip);
        this.camera.position.set(0, 0, 400);

        window.addEventListener('resize', function () {
            _this.camera.aspect = window.innerWidth / window.innerHeight;
            _this.camera.updateProjectionMatrix();
            _this.renderer.setSize(window.innerWidth, window.innerHeight);
            _this.trackballControls.handleResize();
        }, false);

        // Set up controls
        this.trackballControls = new THREE.TrackballControls(this.camera);

        this.trackballControls.rotateSpeed = 1.0;
        this.trackballControls.zoomSpeed = 1.2;
        this.trackballControls.panSpeed = 0.8;

        this.trackballControls.noZoom = false;
        this.trackballControls.noPan = false;

        this.trackballControls.staticMoving = true;
        this.trackballControls.dynamicDampingFactor = 0.3;

        this.trackballControls.keys = [65, 83, 68];

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

        // Set up the brain model/object
        this.brainGeometry = brainGeometry;
        this.setUpBrainModel();
        this.brainObject.add(this.brainGeometry);

        // Set up the node colourings
        this.nodeColourings = this.nodeGroups.map(function (group) {
            var str = _this.d3ColorSelector(group).replace("#", "0x");
            return parseInt(str);
            /*
            switch (group) {
            case 1:
            return 0xff0000;
            case 2:
            return 0x00ff00;
            case 3:
            return 0x0000ff;
            default:
            return 0xffffff;
            }
            */
        });

        // Set up the two graphs
        var completeAdjMatrix = cola.Descent.createSquareMatrix(this.nodeCount, function () {
            return 1;
        });
        this.physioGraph = new Graph(this.brainObject, completeAdjMatrix, this.nodeColourings);
        this.physioGraph.setNodePositions(this.physioCoords);

        completeAdjMatrix = cola.Descent.createSquareMatrix(this.nodeCount, function () {
            return 1;
        });
        this.colaGraph = new Graph(this.colaObject, completeAdjMatrix, this.nodeColourings);
        this.colaGraph.setVisible(false);

        // Initialize the filtering
        this.filteredAdjMatrix = this.adjMatrixFromThreshold(this.currentThreshold);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    }
    Simulation.prototype.setUpBrainModel = function () {
        // Set brain mesh material
        this.brainGeometry.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                child.material = new THREE.MeshLambertMaterial({
                    color: 0xffcccc,
                    transparent: true,
                    opacity: 0.3
                });
                //new THREE.MeshPhongMaterial({
                //    // light
                //    specular: '#a9fcff',
                //    // intermediate
                //    color: '#00abb1',
                //    // dark
                //    emissive: '#006063',
                //    shininess: 100,
                //    transparent: true,
                //    opacity: 0.3
                //});
                //new THREE.MeshBasicMaterial({
                //    wireframe: true,
                //    color: 'gray'
                //});
            }
        });

        this.brainGeometry.position.y = 0;

        // Setting scale to some arbitrarily larger value
        var scale = 1.5;
        this.brainGeometry.scale = new THREE.Vector3(scale, scale, scale);
    };

    Simulation.prototype.createDissimilarityMatrix = function () {
        var _this = this;
        for (var i = 0; i < this.similarityMatrix.length; ++i) {
            this.dissimilarityMatrix.push(this.similarityMatrix[i].map(function (sim) {
                _this.minSimilarity = Math.min(_this.minSimilarity, sim);
                _this.maxSimilarity = Math.max(_this.maxSimilarity, sim);
                return 15 / (sim + 1);
            }));
        }

        // Calculate the percentiles
        var orderedWeights = [];
        for (var i = 0; i < this.similarityMatrix.length; ++i) {
            var row = this.similarityMatrix[i];
            for (var j = 0; j < row.length; ++j) {
                orderedWeights.push(row[j]);
            }
        }
        orderedWeights.sort(function (a, b) {
            return a - b;
        });
        var k = orderedWeights.length / 100;
        for (var i = 0; i < 100; ++i) {
            this.percentiles[i] = orderedWeights[Math.floor(i * k)];
        }
        this.percentiles[100] = orderedWeights[orderedWeights.length - 1];
    };

    // Select the given percentage of links
    // TODO: REMOVE SYMMETRIC FILLING IF NOT NEEDED
    Simulation.prototype.adjMatrixFromThreshold = function (percent) {
        var threshold = this.percentiles[percent];
        var adjMatrix = Array(this.nodeCount);
        for (var i = 0; i < this.nodeCount; ++i) {
            adjMatrix[i] = new Array(this.nodeCount);
        }

        for (var i = 0; i < this.nodeCount - 1; ++i) {
            adjMatrix[i] = new Array(this.nodeCount);
            for (var j = i + 1; j < this.nodeCount; ++j) {
                var val = this.similarityMatrix[i][j];
                if (val < threshold) {
                    adjMatrix[i][j] = adjMatrix[j][i] = 1;
                } else {
                    adjMatrix[i][j] = adjMatrix[j][i] = 0;
                }
            }
        }

        return adjMatrix;
    };

    Simulation.prototype.getNodeUnderPointer = function (pointer) {
        var pointerNDC = new THREE.Vector3(pointer.x, pointer.y, 1);
        this.projector.unprojectVector(pointerNDC, this.camera);
        var directionVector = pointerNDC.sub(this.camera.position);
        directionVector.normalize();

        var raycaster = new THREE.Raycaster(this.camera.position, directionVector, this.nearClip, this.farClip);
        var intersected = raycaster.intersectObjects(this.scene.children, true);

        for (var i = 0; i < intersected.length; ++i) {
            if (intersected[i].object.isNode) {
                return intersected[i].object;
            }
        }

        return null;
    };

    Simulation.prototype.update = function (deltaTime) {
        var _this = this;
        this.trackballControls.update();

        var node = this.getNodeUnderPointer(input.mouse);
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

        if (input.keyboard.keyPressed[' '] && !this.transitionInProgress) {
             {
                this.showingCola = true;

                var edges = [];
                var hasNeighbours = Array(this.nodeCount);
                for (var i = 0; i < this.nodeCount - 1; ++i) {
                    for (var j = i + 1; j < this.nodeCount; ++j) {
                        if (this.filteredAdjMatrix[i][j] === 1) {
                            edges.push({ source: i, target: j });
                            hasNeighbours[i] = true;
                            hasNeighbours[j] = true;
                        }
                    }
                }

                this.colaGraph.setNodeVisibilities(hasNeighbours);
                this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix);

                var distanceMatrix = (new shortestpaths.Calculator(this.nodeCount, edges)).DistanceMatrix();

                var D = cola.Descent.createSquareMatrix(this.nodeCount, function (i, j) {
                    return distanceMatrix[i][j] * _this.colaLinkDistance;
                });

                var clonedPhysioCoords = this.physioCoords.map(function (dim) {
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
                this.colaGraph.setNodePositions(this.physioCoords);
                this.colaGraph.setVisible(true);
                this.transitionInProgress = true;

                setCoroutine({ currentTime: 0, endTime: this.modeLerpLength }, function (o, deltaTime) {
                    o.currentTime += deltaTime;

                    if (o.currentTime >= o.endTime) {
                        _this.colaObject.position = target;
                        _this.colaGraph.setNodePositions(_this.colaCoords);
                        _this.transitionInProgress = false;
                        return true;
                    } else {
                        var percentDone = o.currentTime / o.endTime;
                        _this.colaObject.position = origin.clone().add(target.clone().sub(origin).multiplyScalar(percentDone));
                        _this.colaGraph.setNodePositionsLerp(_this.physioCoords, _this.colaCoords, percentDone);
                        return false;
                    }
                });
            }
        }

        if (input.keyboard.keyPressed['2']) {
            if (this.currentThreshold < 100) {
                this.currentThreshold += 1;
                this.filteredAdjMatrix = this.adjMatrixFromThreshold(this.currentThreshold);
                this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
            }
        }

        if (input.keyboard.keyPressed['1']) {
            if (this.currentThreshold > 0) {
                this.currentThreshold -= 1;
                this.filteredAdjMatrix = this.adjMatrixFromThreshold(this.currentThreshold);
                this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
            }
        }

        if (input.keyboard.key['a']) {
            this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y - this.rotationSpeed * deltaTime, 0);
            this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y - this.rotationSpeed * deltaTime, 0);
        }

        if (input.keyboard.key['d']) {
            this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y + this.rotationSpeed * deltaTime, 0);
            this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y + this.rotationSpeed * deltaTime, 0);
        }

        if (input.keyboard.key['w']) {
            this.brainObject.rotation.set(this.brainObject.rotation.x - this.rotationSpeed * deltaTime, this.brainObject.rotation.y, 0);
            this.colaObject.rotation.set(this.colaObject.rotation.x - this.rotationSpeed * deltaTime, this.colaObject.rotation.y, 0);
        }

        if (input.keyboard.key['s']) {
            this.brainObject.rotation.set(this.brainObject.rotation.x + this.rotationSpeed * deltaTime, this.brainObject.rotation.y, 0);
            this.colaObject.rotation.set(this.colaObject.rotation.x + this.rotationSpeed * deltaTime, this.colaObject.rotation.y, 0);
        }

        if (this.showingCola)
            this.descent.rungeKutta();

        this.colaGraph.update(); // Updates all the edge positions
        input.reset();
    };

    Simulation.prototype.draw = function () {
        this.renderer.render(this.scene, this.camera);
    };
    return Simulation;
})();

var Graph = (function () {
    function Graph(parentObject, adjMatrix, nodeColourings) {
        this.edgeList = [];
        this.visible = true;
        this.parentObject = parentObject;
        this.rootObject = new THREE.Object3D();
        parentObject.add(this.rootObject);

        // Create all the node meshes
        this.nodeMeshes = Array(adjMatrix.length);
        for (var i = 0; i < adjMatrix.length; ++i) {
            var sphere = this.nodeMeshes[i] = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 10), new THREE.MeshLambertMaterial({ color: nodeColourings[i] }));
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
    Graph.prototype.setNodePositions = function (colaCoords) {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].position.x = colaCoords[0][i];
            this.nodeMeshes[i].position.y = colaCoords[1][i];
            this.nodeMeshes[i].position.z = colaCoords[2][i];
        }
    };

    // Lerp between the physio and Cola positions of the nodes
    // 0 <= t <= 1
    Graph.prototype.setNodePositionsLerp = function (colaCoords1, colaCoords2, t) {
        debugger;
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].position.x = colaCoords1[0][i] * (1 - t) + colaCoords2[0][i] * t;
            this.nodeMeshes[i].position.y = colaCoords1[1][i] * (1 - t) + colaCoords2[1][i] * t;
            this.nodeMeshes[i].position.z = colaCoords1[2][i] * (1 - t) + colaCoords2[2][i] * t;
        }
    };

    Graph.prototype.setVisible = function (flag) {
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
    };

    Graph.prototype.setNodeVisibilities = function (visArray) {
        for (var i = 0; i < visArray.length; ++i) {
            if (visArray[i])
                this.rootObject.add(this.nodeMeshes[i]);
            else
                this.rootObject.remove(this.nodeMeshes[i]);
        }
    };

    Graph.prototype.setEdgeVisibilities = function (visMatrix) {
        var len = visMatrix.length;
        for (var i = 0; i < len - 1; ++i) {
            for (var j = i + 1; j < len; ++j) {
                this.edgeMatrix[i][j].setVisible(visMatrix[i][j] === 1 ? true : false);
            }
        }
    };

    Graph.prototype.selectNode = function (id) {
        this.nodeMeshes[id].scale.set(2, 2, 2);
    };

    Graph.prototype.deselectNode = function (id) {
        this.nodeMeshes[id].scale.set(1, 1, 1);
    };

    Graph.prototype.update = function () {
        this.edgeList.forEach(function (edge) {
            edge.update();
        });
    };
    return Graph;
})();

var Edge = (function () {
    function Edge(parentObject, endPoint1, endPoint2) {
        this.parentObject = parentObject;
        this.visible = true;
        this.geometry = new THREE.Geometry();
        this.geometry.vertices.push(endPoint1);
        this.geometry.vertices.push(endPoint2);
        this.line = new THREE.Line(this.geometry, new THREE.LineBasicMaterial({ color: 0xFFFFFF }));
        parentObject.add(this.line);
        //this.highlighted = false;
    }
    Edge.prototype.setVisible = function (flag) {
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
    };

    Edge.prototype.update = function () {
        this.geometry.verticesNeedUpdate = true;
    };
    return Edge;
})();

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
var simulation;

init();

// Prerequisites to begin the simulation
var prereqBrain;
var prereqSimMatrix;
var prereqNodeGroups;
var prereqNodeLabels;
var prereqCoords;

function init() {
    var manager = new THREE.LoadingManager();
    manager.onProgress = function (item, loaded, total) {
        console.log(item, loaded, total);
    };

    // Load the brain model
    var loader = new THREE.OBJLoader(manager);
    loader.load('graphdata/BrainLSDecimated0.01.obj', function (geometry) {
        prereqBrain = geometry;
        tryBegin();
    });

    // Load the similarity matrix
    d3.text("graphdata/signed_weighted.txt", function (error, text) {
        var lines = text.split('\n').map(function (s) {
            return s.trim();
        });
        prereqSimMatrix = [];
        lines.forEach(function (line, i) {
            if (line.length > 0) {
                prereqSimMatrix.push(line.split(',').map(function (string) {
                    return parseFloat(string);
                }));
            }
        });
        tryBegin();
    });

    // Load the group affiliations
    d3.text("graphdata/signed_weighted_affil.txt", function (error, text) {
        var groups = text.split(',').map(function (s) {
            return s.trim();
        });
        prereqNodeGroups = groups.map(function (group) {
            return parseInt(group);
        });
        tryBegin();
    });

    // Load the labels
    d3.text("graphdata/labels.txt", function (error, text) {
        prereqNodeLabels = text.split('\n').map(function (s) {
            return s.trim();
        });
        tryBegin();
    });

    // Load the physiological coordinates of each node in the brain
    d3.csv('graphdata/coordinates.csv', function (coords) {
        prereqCoords = [Array(coords.length), Array(coords.length), Array(coords.length)];

        for (var i = 0; i < coords.length; ++i) {
            // Translate the coords into Cola's format
            prereqCoords[0][i] = parseFloat(coords[i].x);
            prereqCoords[1][i] = parseFloat(coords[i].y);
            prereqCoords[2][i] = parseFloat(coords[i].z);
        }

        tryBegin();
    });
}

// This is where the main loop tries to start. We begin when all resources are loaded.
function tryBegin() {
    if (prereqBrain && prereqSimMatrix && prereqNodeGroups && prereqNodeLabels && prereqCoords) {
        timeOfLastFrame = new Date().getTime();
        simulation = new Simulation(prereqBrain, prereqSimMatrix, prereqNodeGroups, prereqNodeLabels, prereqCoords);
        mainLoop();
    }
}

var frameTimeLimit = 0.03;
var timeOfLastFrame = 0;

function mainLoop() {
    nextUpdate();
    simulation.draw();
    requestAnimationFrame(mainLoop);
}

function nextUpdate() {
    var currentTime = new Date().getTime();
    var deltaTime = (currentTime - timeOfLastFrame) / 1000;
    timeOfLastFrame = currentTime;

    // Limit the maximum time step
    if (deltaTime > frameTimeLimit)
        update(frameTimeLimit);
    else
        update(deltaTime);
}

function update(deltaTime) {
    for (var i = 0; i < coroutines.length;) {
        if (coroutines[i].func(coroutines[i], deltaTime))
            coroutines.splice(i, 1);
        else
            ++i;
    }
    simulation.update(deltaTime);
}

/* Functions can be pushed to the coroutines array to be executed as if they are
* occuring in parallel with the program execution.
*/
var coroutines = new Array();

function setCoroutine(data, func) {
    data.func = func;
    coroutines.push(data);
}
//# sourceMappingURL=brain3d.js.map
