/// <reference path="../src/descent.ts"/>
/// <reference path="../src/shortestpaths.ts"/>
/**
    This application uses similarity data between areas of the brain to construct a thresholded graph with edges
    between the most similar areas. It is designed to be embedded in a view defined in brainapp.html / brainapp.ts.
*/

// GLOBAL VARIABLES
declare var d3;
declare var numeric;
declare function d3adaptor(): string;
var colans = <any>cola;

var sliderSpace = 70; // The number of pixels to reserve at the bottom of the div for the slider
//var uniqueID = 0; // Each instance of this application is given a unique ID so that the DOM elements they create can be identified as belonging to them
var maxEdgesShowable = 500;
var initialEdgesShown = 20; // The number of edges that are shown when the application starts

// The width and the height of the box in the xy-plane that we must keep inside the camera (by modifying the distance of the camera from the scene)
var widthInCamera = 520;
var heightInCamera = 360;

// TODO: Proper reset and destruction of the application (the 'instances' variable will continue to hold a reference - this will cause the application to live indefinitely)
/*
var instances = Array<Brain3DApp>(0); // Stores each instance of an application under its id, for lookup by the slider input element

function sliderChangeForID(id: number, v: number) {
    instances[id].sliderChange(v);
}
*/

class Brain3DApp implements Application, Loopable {
    id: number;
    loop: Loop;
    input: InputTarget;
    jDiv;
    deleted: boolean = false;

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

    cola2D;
    svg;
    svgMode;

    nodeColourings: number[]; // Stores the colourings associated with the groups
    dissimilarityMatrix: number[][] = []; // An inversion of the similarity matrix, used for Cola graph distances

    // State
    showingCola: boolean = false;
    transitionInProgress: boolean = false;
    currentThreshold: number = 0;
    filteredAdjMatrix: number[][];
    selectedNodeID = -1;

    lastSliderValue = 0;
    surfaceLoaded: boolean = false;

    defaultFov: number;
    fovZoomRatio = 1;
    currentViewWidth: number; 

    autoRotation: boolean = false;

    networkType: string;

    mouse = {
        dx: 0,
        dy: 0
    }

    // Constants
    nearClip = 1;
    farClip = 2000;
    modeLerpLength: number = 0.6;
    rotationSpeed: number = 1.2;
    graphOffset: number = 120;
    colaLinkDistance = 15;

    /*
    closeBrainAppCallback;

    regCloseBrainAppCallback(callback: (id: number) => void) {
        this.closeBrainAppCallback = callback;
    }
    */

    constructor(id: number, commonData: CommonData, jDiv, inputTargetCreator: (l: number, r: number, t: number, b: number) => InputTarget) {
        this.id = id;
        //instances[this.id] = this;
        this.commonData = commonData;
        this.input = inputTargetCreator(0, 0, 0, sliderSpace);
        this.jDiv = jDiv;

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

        this.input.regMouseDragCallback((dx: number, dy: number, mode: number) => {
            // left button: rotation
            if (mode == 1) {
                if (this.autoRotation == false) {
                    var pixelAngleRatio = 50;
                    this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y + dx / pixelAngleRatio, this.brainObject.rotation.z);
                    this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y + dx / pixelAngleRatio, this.colaObject.rotation.z);

                    this.brainObject.rotation.set(this.brainObject.rotation.x + dy / pixelAngleRatio, this.brainObject.rotation.y, this.brainObject.rotation.z);
                    this.colaObject.rotation.set(this.colaObject.rotation.x + dy / pixelAngleRatio, this.colaObject.rotation.y, this.colaObject.rotation.z);
                }
                else {
                    this.mouse.dx = dx;
                    this.mouse.dy = dy;
                }       
            }
            // right button: pan
            else if (mode == 3) {
                var pixelDistanceRatio = 1.6; // with: defaultCameraFov = 25; defaultViewWidth = 800;
                var defaultCameraFov = 25
                var defaultViewWidth = 800;

                pixelDistanceRatio /= (this.camera.fov / defaultCameraFov);
                pixelDistanceRatio *= (this.currentViewWidth / defaultViewWidth);

                this.brainObject.position.set(this.brainObject.position.x + dx / pixelDistanceRatio, this.brainObject.position.y - dy / pixelDistanceRatio, this.brainObject.position.z);          
                this.colaObject.position.set(this.colaObject.position.x + dx / pixelDistanceRatio, this.colaObject.position.y - dy / pixelDistanceRatio, this.colaObject.position.z);   

                //console.log(this.brainObject.rotation.x + "," + this.brainObject.rotation.y + "," + this.brainObject.rotation.z);                         
            }
        });

        this.input.regMouseRightClickCallback((x: number, y: number) => {
            var record;
            var node = this.getNodeUnderPointer(this.input.localPointerPosition());
            if (node) {
                record = this.dataSet.attributes.getRecord(node.id);
                var color = (<any>node).material.color.getHex();
                record += color;
            }
            return record;
        });

        this.input.regMouseDoubleClickCallback(() => {
            this.fovZoomRatio = 1;
            this.camera.fov = this.defaultFov;
            this.camera.updateProjectionMatrix();

            this.brainObject.position = new THREE.Vector3(-this.graphOffset, 0, 0);
            this.brainObject.rotation.set(0, 0, 0);

            if (this.showingCola) {
                this.colaObject.position = new THREE.Vector3(this.graphOffset, 0, 0);
                this.colaObject.rotation.set(0, 0, 0);
            }         
        });

        this.input.regMouseWheelCallback((delta: number) => {
            var z = 1.0;
            z += delta;

            this.camera.fov *= z;
            this.fovZoomRatio = this.camera.fov / this.defaultFov;
            this.camera.updateProjectionMatrix();
            //console.log("this.camera.fov: " + this.camera.fov);
        });

        this.input.regGetRotationCallback(() => {
            var rotation: number[] = [];
            rotation.push(this.brainObject.rotation.x);
            rotation.push(this.brainObject.rotation.y);
            rotation.push(this.brainObject.rotation.z);
            return rotation;
        });

        this.input.regSetRotationCallback((rotation: number[]) => {
            if ((rotation) && (rotation.length == 3)) {
                this.brainObject.rotation.set(rotation[0], rotation[1], rotation[2]);
                this.colaObject.rotation.set(rotation[0], rotation[1], rotation[2]);
            }
        });

        var varShowNetwork = (b: boolean) => { this.showNetwork(b); }
        var varEdgesThicknessByWeightedOnChange = (b: boolean) => { this.edgesThicknessByWeightedOnChange(b); }
        var varEdgesColoredOnChange = (b: boolean) => { this.edgesColoredOnChange(b); }
        var varAllLabelsOnChange = (b: boolean) => { this.allLabelsOnChange(b); }
        var varAutoRotationOnChange = (b: boolean) => { this.autoRotationOnChange(b); }
        var varSliderMouseEvent = (e: string) => { this.sliderMouseEvent(e); }
        var varGraphViewSliderOnChange = (v: number) => { this.graphViewSliderOnChange(v); }
        var varEdgeCountSliderOnChange = (v: number) => { this.edgeCountSliderOnChange(v); }
        var varCloseBrainAppOnClick = () => { this.closeBrainAppOnClick(); }
        var varDefaultOrientationsOnClick = (s: string) => { this.defaultOrientationsOnClick(s); }
        var varNetworkTypeOnChange = (s: string) => { this.networkTypeOnChange(s); }

        this.input.regKeyDownCallback(' ', varShowNetwork);
            
        // Set the background colour
        jDiv.css({ backgroundColor: '#ffffff' });

        // Set up renderer, and add the canvas and the slider to the div
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(jDiv.width(), (jDiv.height() - sliderSpace));
        jDiv.append($('<span id="close-brain-app-' + this.id + '" class="view-panel-span">x</span>')
                .css({ 'right': '6px', 'top': '10px', 'font-size': '12px' })
                .fadeTo(0, 0.2)
                .hover(function (e) { $(this).stop().fadeTo(300, e.type == "mouseenter" ? 1 : 0.2); })
                .click(function () { varCloseBrainAppOnClick(); }))
            .append($('<span id="top-view-' + this.id + '" class="view-panel-span">T</span>')
                .css({ 'right': '6px', 'top': '30px' })
                .fadeTo(0, 0.2)
                .hover(function (e) { $(this).stop().fadeTo(300, e.type == "mouseenter" ? 1 : 0.2); })
                .click(function () { varDefaultOrientationsOnClick("top"); }))
            .append($('<span id="bottom-view-' + this.id + '" class="view-panel-span">B</span>')
                .css({ 'right': '6px', 'top': '50px' })
                .fadeTo(0, 0.2)
                .hover(function (e) { $(this).stop().fadeTo(300, e.type == "mouseenter" ? 1 : 0.2); })
                .click(function () { varDefaultOrientationsOnClick("bottom"); }))
            .append($('<span id="left-view-' + this.id + '" class="view-panel-span">L</span>')
                .css({ 'right': '6px', 'top': '70px' })
                .fadeTo(0, 0.2)
                .hover(function (e) { $(this).stop().fadeTo(300, e.type == "mouseenter" ? 1 : 0.2); })
                .click(function () { varDefaultOrientationsOnClick("left"); }))
            .append($('<span id="right-view-' + this.id + '" class="view-panel-span">R</span>')
                .css({ 'right': '6px', 'top': '90px' })
                .fadeTo(0, 0.2)
                .hover(function (e) { $(this).stop().fadeTo(300, e.type == "mouseenter" ? 1 : 0.2); })
                .click(function () { varDefaultOrientationsOnClick("right"); }))
            .append($('<span id="front-view-' + this.id + '" class="view-panel-span">F</span>')
                .css({ 'right': '6px', 'top': '110px' })
                .fadeTo(0, 0.2)
                .hover(function (e) { $(this).stop().fadeTo(300, e.type == "mouseenter" ? 1 : 0.2); })
                .click(function () { varDefaultOrientationsOnClick("front"); }))
            .append($('<span id="back-view-' + this.id + '" class="view-panel-span">B</span>')
                .css({ 'right': '6px', 'top': '130px' })
                .fadeTo(0, 0.2)
                .hover(function (e) { $(this).stop().fadeTo(300, e.type == "mouseenter" ? 1 : 0.2); })
                .click(function () { varDefaultOrientationsOnClick("back"); }))
            .append($('<input id="graph-view-slider-' + this.id + '" type="range" min="0" max="100" value="100"></input>')
                .css({ 'position': 'absolute', 'visibility': 'hidden', '-webkit-appearance': 'slider-vertical', 'width': '20px', 'height': '250px', 'right': 0, 'top': '150px', 'z-index': 1000 })
                .mousedown(function () { varSliderMouseEvent("mousedown"); })
                .mouseup(function () { varSliderMouseEvent("mouseup"); })
                .on("input change", function () { varGraphViewSliderOnChange($(this).val()); })
                .fadeTo(0, 0.3)
                .hover(function (e) { $(this).stop().fadeTo(300, e.type == "mouseenter" ? 1 : 0.3); }))
            .append($('<div id="div-svg-' + this.id + '"></div>')
                .css({ 'position': 'absolute', 'width': '100%', 'height': '100%', 'top': 0, 'left': 0, 'z-index': 10 }))
            .append(this.renderer.domElement)
            .append('<p>Showing <label id="count-' + this.id + '">0</label> edges (<label id=percentile-' + this.id + '>0</label>th percentile)</p>')
            .append($('<input id="edge-count-slider-' + this.id + '" type="range" min="1" max="' + maxEdgesShowable + '" value="' + initialEdgesShown + '" disabled="true"/></input>')
                .css({ 'width': '200px', 'position': 'relative', 'z-index': 1000 })
                .mousedown(function () { varSliderMouseEvent("mousedown"); })
                .mouseup(function () { varSliderMouseEvent("mouseup"); })
                .on("input change", function () { varEdgeCountSliderOnChange($(this).val()); }))
            .append($('<input type="checkbox" id="checkbox-edges-thickness-by-weight-' + this.id + '" disabled="true">Weighted Edges</input>').css({ 'width': '12px', 'position': 'relative', 'z-index': 1000 })
                .click(function () { varEdgesThicknessByWeightedOnChange($(this).is(":checked")); }))
            .append($('<input type="checkbox" id="checkbox-edge-color-' + this.id + '" disabled="true">Colored Edge</input>').css({ 'width': '12px', 'position': 'relative', 'z-index': 1000 })
                .click(function () { varEdgesColoredOnChange($(this).is(":checked")); }))
            .append($('<input type="checkbox" id="checkbox-all-labels-' + this.id + '" disabled="true">All Labels</input>').css({ 'width': '12px', 'position': 'relative', 'z-index': 1000 })
                .click(function () { varAllLabelsOnChange($(this).is(":checked")); }))
            .append($('<input type="checkbox" id="checkbox-auto-rotation-' + this.id + '" disabled="true">Auto Rotation</input>').css({ 'width': '12px', 'position': 'relative', 'z-index': 1000 })
                .click(function () { varAutoRotationOnChange($(this).is(":checked")); }))
            .append($('<button id="button-show-network-' + this.id + '" disabled="true">Show Network</button>').css({ 'margin-left': '10px', 'font-size': '12px', 'position': 'relative', 'z-index': 1000 })
                .click(function () { varShowNetwork(false); }))
            .append($('<select id="select-network-type-' + this.id + '" disabled="true"></select>').css({ 'margin-left': '5px', 'font-size': '12px', 'width': '90px', 'position': 'relative', 'z-index': 1000 })
                .on("change", function () { varNetworkTypeOnChange($(this).val()); }));

        var networkTypeSelect = "#select-network-type-" + this.id;
        var option = document.createElement('option');
        option.text = 'default';
        option.value = 'default';
        $(networkTypeSelect).append(option);
        this.networkType = 'default';

        var option = document.createElement('option');
        option.text = 'edge length depends on weight';
        option.value = 'edge-length-depends-on-weight';
        $(networkTypeSelect).append(option);

        var option = document.createElement('option');
        option.text = 'flatten to 2D';
        option.value = 'flatten-to-2d';
        $(networkTypeSelect).append(option);

        this.cola2D = colans.d3adaptor()
            .size([jDiv.width(), jDiv.height() - sliderSpace]);

        this.svg = d3.select('#div-svg-' + this.id).append("svg")
            .attr("width", jDiv.width())
            .attr("height", jDiv.height() - sliderSpace);

        // Set up camera
        this.camera = new THREE.PerspectiveCamera(45, 1, this.nearClip, this.farClip);
        this.resize(jDiv.width(), jDiv.height());

        // Set up scene
        this.scene = new THREE.Scene();
        //this.scene.add(new THREE.AxisHelper(300));

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
            if (this.surfaceLoaded == true) return;

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
            //var scale = 1.5;
            //clonedObject.scale = new THREE.Vector3(scale, scale, scale);

            this.brainSurface = clonedObject;
            this.brainObject.add(this.brainSurface);

            this.surfaceLoaded = true;
        };
        commonData.regNotifyCoords(coords);
        commonData.regNotifyLabels(lab);
        commonData.regNotifySurface(surf);
        if (commonData.brainCoords) coords();
        if (commonData.brainLabels) lab();
        //if (commonData.brainSurface) surf(); // this line is redundant and has problem, surf() will be called in THREE.OBJLoader
    }

    sliderMouseEvent(e: string) {
        if (e == "mousedown") {
            this.input.sliderEvent = true;
        }
        else if (e == "mouseup"){
            this.input.sliderEvent = false;
        }
    }

    closeBrainAppOnClick() {
        this.jDiv.empty();

        if (this.id == 0) {
            this.jDiv.css({ backgroundColor: '#ffe5e5' });
        }
        else if (this.id == 1) {
            this.jDiv.css({ backgroundColor: '#d7e8ff' });
        }
        else if (this.id == 2) {
            this.jDiv.css({ backgroundColor: '#fcffb2' });
        }
        else if (this.id == 3) {
            this.jDiv.css({ backgroundColor: '#d2ffbd' });
        }

        this.deleted = true;
    }

    networkTypeOnChange(type: string) {
        this.networkType = type;

        if (this.showingCola == true) {
            this.showNetwork(true);
        }
        else {
            this.showNetwork(false);
        }
    }

    defaultOrientationsOnClick(orientation: string) {
        if (!orientation) return;

        switch (orientation) {
            case "top":
                this.brainObject.rotation.set(0,0,0);
                this.colaObject.rotation.set(0,0,0);                
                break;
            case "bottom":
                this.brainObject.rotation.set(0, Math.PI, 0);
                this.colaObject.rotation.set(0, Math.PI, 0);                  
                break;
            case "left":
                this.brainObject.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
                this.colaObject.rotation.set(-Math.PI / 2, 0, Math.PI / 2);          
                break;
            case "right":
                this.brainObject.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
                this.colaObject.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);  
                break;
            case "front":
                this.brainObject.rotation.set(-Math.PI / 2, 0, Math.PI);
                this.colaObject.rotation.set(-Math.PI / 2, 0, Math.PI);    
                break;
            case "back":
                this.brainObject.rotation.set(-Math.PI / 2, 0, 0);
                this.colaObject.rotation.set(-Math.PI / 2, 0, 0);    
                break;
        }
    }

    graphViewSliderOnChange(value: number) {
        this.colaGraph.setNodePositionsLerp(this.commonData.brainCoords, this.colaCoords, value/100);
    }

    edgeCountSliderOnChange(numEdges) {
        if (numEdges == this.lastSliderValue) return;
        this.lastSliderValue = numEdges;

        var max = this.commonData.nodeCount * (this.commonData.nodeCount - 1) / 2;
        if (numEdges > max) numEdges = max;
        $('#count-' + this.id).get(0).textContent = numEdges;
        var percentile = numEdges * 100 / max;
        $('#percentile-' + this.id).get(0).textContent = percentile.toFixed(2);
        this.filteredAdjMatrix = this.adjMatrixFromEdgeCount(numEdges);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    }

    edgesThicknessByWeightedOnChange(b: boolean) {
        this.physioGraph.edgeThicknessByWeighted = b;
        this.colaGraph.edgeThicknessByWeighted = b;
    }

    edgesColoredOnChange(b: boolean) {
        this.physioGraph.edgeColored = b;
        this.colaGraph.edgeColored = b;
    }

    autoRotationOnChange(b: boolean) {
        this.autoRotation = b;

        this.mouse.dx = 0;
        this.mouse.dy = 0;

        // set default rotation
        if (this.autoRotation == true) {
            this.mouse.dx = 1;
            this.mouse.dy = 0;
        }
    }

    allLabelsOnChange(b: boolean) {
        this.physioGraph.allLabels = b;
        this.colaGraph.allLabels = b;

        if (b == true) {
            this.physioGraph.showAllLabels();
            this.colaGraph.showAllLabels();
        }
        else {
            this.physioGraph.hideAllLabels();
            this.colaGraph.hideAllLabels();
        }
    }

    showNetwork(switchNetworkType: boolean) {
        if (!this.brainObject || !this.colaObject) return;

        if (!this.transitionInProgress) {
            // Leave *showingCola* on permanently after first turn-on
            this.showingCola = true;

            this.colaGraph.filteredNodeIDs = this.physioGraph.filteredNodeIDs;

            //-------------------------------------------------------------------
            // Find the edges that have been selected after thresholding, and all the
            // nodes that have neighbours after the thresholding of the edges takes place.

            // original:
            /*
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
            */

            // new:
            var edges = [];
            var hasNeighbours = Array<boolean>(this.commonData.nodeCount);
            for (var i = 0; i < this.commonData.nodeCount - 1; ++i) {
                for (var j = i + 1; j < this.commonData.nodeCount; ++j) {
                    if (this.filteredAdjMatrix[i][j] === 1) {
                        if (this.physioGraph.filteredNodeIDs) {
                            if ((this.physioGraph.filteredNodeIDs.indexOf(i) != -1) && (this.physioGraph.filteredNodeIDs.indexOf(j) != -1)) {
                                var len = this.dissimilarityMatrix[i][j];
                                edges.push({ source: i, target: j, length: len });
                                hasNeighbours[i] = true;
                                hasNeighbours[j] = true;
                            }
                        } else {
                            var len = this.dissimilarityMatrix[i][j];
                            edges.push({ source: i, target: j, length: len });
                            hasNeighbours[i] = true;
                            hasNeighbours[j] = true;
                        }
                    }
                }
            }

            //-------------------------------------------------------------------------------------------------------------
            // 3d cola graph

            this.colaGraph.setNodeVisibilities(hasNeighbours); // Hide the nodes without neighbours
            this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix); // Hide the edges that have not been selected

            var getSourceIndex = function (e) {
                return e.source;
            }

            var getTargetIndex = function (e) {
                return e.target;
            }

            var varType = this.networkType;
            var getLength = function (e) {
                if (varType == 'default') {
                    return 1;
                }
                else if (varType == 'edge-length-depends-on-weight') {
                    return e.length;
                }
                else {
                    return 1;
                }
            }
            
            // Create the distance matrix that Cola needs
            var distanceMatrix = (new cola.shortestpaths.Calculator(this.commonData.nodeCount, edges, getSourceIndex, getTargetIndex, getLength)).DistanceMatrix();

            var D = cola.Descent.createSquareMatrix(this.commonData.nodeCount, (i, j) => {
                return distanceMatrix[i][j] * this.colaLinkDistance;
            });

            var clonedPhysioCoords = this.commonData.brainCoords.map(function (dim) {
                return dim.map(function (element) {
                    return element;
                });
            });

            this.descent = new cola.Descent(clonedPhysioCoords, D); // Create the solver

            var originColaCoords: number[][];
            if (switchNetworkType == true) {
                if (this.colaCoords) {
                    originColaCoords = this.colaCoords.map(function (array) {
                        return array.slice(0);
                    });
                }
            }
            else {
                originColaCoords = this.commonData.brainCoords.map(function (array) {
                    return array.slice(0);
                });
            }

            this.colaCoords = this.descent.x; // Hold a reference to the solver's coordinates
            // Relieve some of the initial stress
            for (var i = 0; i < 10; ++i) {
                this.descent.reduceStress();
            }

            //-------------------------------------------------------------------------------------------------------------
            // animation
            if (this.networkType == 'flatten-to-2d') {
                var colaCoordsMatrix3D: number[][];

                colaCoordsMatrix3D = this.colaCoords.map(function (array) {
                    return array.slice(0);
                });

                colaCoordsMatrix3D = numeric.transpose(colaCoordsMatrix3D); // more row than column
                var V = numeric.svd(colaCoordsMatrix3D).V; // V is orthogonal
                var Vt = numeric.transpose(V);
                var newX = Vt[0]; // 2d array is row first
                var newY = Vt[1];
                var newZ = this.cross(newX, newY);

                var rotationAngle = this.angle(newZ, [0, 0, 1]);
                var ax = this.cross(newZ, [0, 0, 1]);
                var rotationAxis = new THREE.Vector3(ax[0], ax[1], ax[2]);
                var rotationMatrix = new THREE.Matrix4().makeRotationAxis(rotationAxis, rotationAngle);

                //var test = new THREE.Vector3(newZ[0], newZ[1], newZ[2]);
                //test.applyMatrix4(rotationMatrix);

                var colaCoordsMatrixRotated3D: number[][] = [];
                var colaCoordsMatrixRotatedProjected3D: number[][] = [];
                var cloneColaCoords2D: number[][] = [];

                for (var i = 0; i < colaCoordsMatrix3D.length; i++) {
                    var row = colaCoordsMatrix3D[i];
                    var v = new THREE.Vector3(row[0], row[1], row[2]);

                    v.applyMatrix4(rotationMatrix);

                    colaCoordsMatrixRotated3D.push([v.x, v.y, v.z]);
                    colaCoordsMatrixRotatedProjected3D.push([v.x, v.y, 0]);
                    cloneColaCoords2D.push([v.x, v.y]);
                }

                colaCoordsMatrixRotated3D = numeric.transpose(colaCoordsMatrixRotated3D); // more column than row
                colaCoordsMatrixRotatedProjected3D = numeric.transpose(colaCoordsMatrixRotatedProjected3D); // more column than row
                cloneColaCoords2D = numeric.transpose(cloneColaCoords2D); // more column than row

                // step 3: apply cola to 2d graph
                this.descent = new cola.Descent(cloneColaCoords2D, D); // Create the solver

                // Relieve some of the initial stress
                for (var i = 0; i < 10; ++i) {
                    this.descent.reduceStress();
                }

                this.colaCoords = this.descent.x.map(function (array) {
                    return array.slice(0);
                });

                var zeroZCoords: number[] = [];
                for (var i = 0; i < this.colaCoords[0].length; i++) zeroZCoords[i] = 0;
                this.colaCoords.push(zeroZCoords);

                // setup animation
                var origin = new THREE.Vector3(this.brainObject.position.x, this.brainObject.position.y, this.brainObject.position.z);
                var target = new THREE.Vector3(this.brainObject.position.x + 2 * this.graphOffset, this.brainObject.position.y, this.brainObject.position.z);

                // animation: rotate 
                this.colaObjectAnimation(origin, target, originColaCoords, colaCoordsMatrixRotated3D, switchNetworkType, false);

                // animation: flatten to 2d
                this.colaObjectAnimation(target, target, colaCoordsMatrixRotated3D, colaCoordsMatrixRotatedProjected3D, true, false);

                // animation: cola graph in 2d coordinate
                this.colaObjectAnimation(target, target, colaCoordsMatrixRotatedProjected3D, this.colaCoords, true, false);

                this.threeToSVGAnimation(true);
            }
            else {
                // Set up a coroutine to do the animation
                var origin = new THREE.Vector3(this.brainObject.position.x, this.brainObject.position.y, this.brainObject.position.z);
                var target = new THREE.Vector3(this.brainObject.position.x + 2 * this.graphOffset, this.brainObject.position.y, this.brainObject.position.z);

                //this.colaGraph.setNodePositions(this.commonData.brainCoords); // Move the Cola graph nodes to their starting position
                this.colaObjectAnimation(origin, target, originColaCoords, this.colaCoords, switchNetworkType, true);
            }
        }
    }

    cross(u: number[], v: number[]) {
        if (!u || !v) return;

        var u1 = u[0];
        var u2 = u[1];
        var u3 = u[2];
        var v1 = v[0];
        var v2 = v[1];
        var v3 = v[2];

        var cross = [u2 * v3 - u3 * v2, u3 * v1 - u1 * v3, u1 * v2 - u2 * v1];
        return cross;
    }

    angle(u: number[], v: number[]) {
        if (!u || !v) return;
        var costheta = numeric.dot(u, v) / (numeric.norm2(u) * numeric.norm2(v));
        var theta = Math.acos(costheta);
        return theta;
    }

    threeToSVGAnimation(transitionFinish: boolean) {
        $('#button-show-network-' + this.id).prop('disabled', true);
        $('#select-network-type-' + this.id).prop('disabled', true);
        $('#graph-view-slider-' + this.id).prop('disabled', true); 

        setCoroutine({ currentTime: 0, endTime: this.modeLerpLength }, (o, deltaTime) => {
            if (o.currentTime == 0) this.updateSVGGraph(true);

            o.currentTime += deltaTime;

            if (o.currentTime >= o.endTime) { // The animation has finished
                this.colaGraph.setVisible(false);

                var node = this.svg.selectAll(".node")
                    .style("stroke-opacity", 1)
                    .style("opacity", 1);

                var link = this.svg.selectAll(".link")
                    .style("stroke-opacity", 1);

                this.svgMode = true;

                if (transitionFinish) {
                    this.transitionInProgress = false;

                    // Enable the vertical slider
                    $('#graph-view-slider-' + this.id).css({ visibility: 'visible' });
                    $('#graph-view-slider-' + this.id).val('100');

                    $('#button-show-network-' + this.id).prop('disabled', false);
                    $('#select-network-type-' + this.id).prop('disabled', false);
                    $('#graph-view-slider-' + this.id).prop('disabled', false);
                }

                return true;
            }
            else { // Update the animation
                var percentDone = o.currentTime / o.endTime;

                var children = this.colaGraph.rootObject.children;
                for (var i = 0; i < children.length; i++) {
                    children[i].material.opacity = 1 - percentDone;
                }

                var node = this.svg.selectAll(".node")
                    .style("stroke-opacity", percentDone)
                    .style("opacity", percentDone);

                var link = this.svg.selectAll(".link")
                    .style("stroke-opacity", percentDone);

                return false;
            }
        });
    }

    colaObjectAnimation(colaObjectOrigin, colaObjectTarget, nodeCoordOrigin: number[][], nodeCoordTarget: number[][], switchNetworkType: boolean, transitionFinish: boolean) {
        this.colaGraph.setVisible(true);

        var children = this.colaGraph.rootObject.children;
        for (var i = 0; i < children.length; i++) {
            children[i].material.opacity = 1;
        }

        if (this.svg) {
            var node = this.svg.selectAll(".node").data(new Array());
            var link = this.svg.selectAll(".link").data(new Array());

            node.exit().remove();
            link.exit().remove();

            this.svgMode = false;
        }

        this.transitionInProgress = true;
        $('#button-show-network-' + this.id).prop('disabled', true);
        $('#select-network-type-' + this.id).prop('disabled', true);    
        $('#graph-view-slider-' + this.id).prop('disabled', true); 

        if (switchNetworkType == true) {
            this.colaObject.position = colaObjectTarget;
        }
        else {
            this.colaObject.position = colaObjectOrigin;
        }

        setCoroutine({ currentTime: 0, endTime: this.modeLerpLength }, (o, deltaTime) => {
            o.currentTime += deltaTime;

            if (o.currentTime >= o.endTime) { // The animation has finished
                this.colaObject.position = colaObjectTarget;
                this.colaGraph.setNodePositions(nodeCoordTarget);

                if (transitionFinish) {
                    this.transitionInProgress = false;

                    // Enable the vertical slider
                    $('#graph-view-slider-' + this.id).css({ visibility: 'visible' });
                    $('#graph-view-slider-' + this.id).val('100');

                    $('#button-show-network-' + this.id).prop('disabled', false);
                    $('#select-network-type-' + this.id).prop('disabled', false);
                    $('#graph-view-slider-' + this.id).prop('disabled', false); 
                }

                return true;
            }
            else { // Update the animation
                var percentDone = o.currentTime / o.endTime;

                this.colaGraph.setNodePositionsLerp(nodeCoordOrigin, nodeCoordTarget, percentDone);

                if (switchNetworkType == false) {
                    this.colaObject.position = colaObjectOrigin.clone().add(colaObjectTarget.clone().sub(colaObjectOrigin).multiplyScalar(percentDone));
                }

                return false;
            }
        });
    }

    colaObjectRotation(colaObjectOrigin, colaObjectTarget, rotationOrigin, rotationTarget, switchNetworkType: boolean, transitionFinish: boolean) {
        this.colaGraph.setVisible(true);
        this.transitionInProgress = true;
        $('#button-show-network-' + this.id).prop('disabled', true);
        $('#select-network-type-' + this.id).prop('disabled', true);
        $('#graph-view-slider-' + this.id).prop('disabled', true);

        if (switchNetworkType == true) {
            this.colaObject.position = colaObjectTarget;
        }
        else {
            this.colaObject.position = colaObjectOrigin;
        }

        setCoroutine({ currentTime: 0, endTime: this.modeLerpLength }, (o, deltaTime) => {
            o.currentTime += deltaTime;

            if (o.currentTime >= o.endTime) { // The animation has finished
                this.colaObject.position = colaObjectTarget;
                this.colaObject.rotation = rotationTarget;

                if (transitionFinish) {
                    this.transitionInProgress = false;

                    // Enable the vertical slider
                    $('#graph-view-slider-' + this.id).css({ visibility: 'visible' });
                    $('#graph-view-slider-' + this.id).val('100');

                    $('#button-show-network-' + this.id).prop('disabled', false);
                    $('#select-network-type-' + this.id).prop('disabled', false);
                    $('#graph-view-slider-' + this.id).prop('disabled', false);
                }

                return true;
            }
            else { // Update the animation
                var percentDone = o.currentTime / o.endTime;

                var rotation = rotationOrigin.clone().add(rotationTarget.clone().sub(rotationOrigin).multiplyScalar(percentDone));
                this.colaObject.rotation.set(rotation.x, rotation.y, rotation.z);

                if (switchNetworkType == false) {
                    this.colaObject.position = colaObjectOrigin.clone().add(colaObjectTarget.clone().sub(colaObjectOrigin).multiplyScalar(percentDone));
                }

                return false;
            }
        });
    }

    updateSVGGraph(init: boolean) {
        var width = this.jDiv.width();
        var height = this.jDiv.height() - sliderSpace;
        var widthHalf = width / 2;
        var heightHalf = height / 2;

        var projector = new THREE.Projector();
        var screenCoords = new THREE.Vector3();

        var unitRadius = 5;

        var nodeObjectArray = [];
        var children = this.colaGraph.rootObject.children;
        for (var i = 0; i < children.length; i++) {
            var obj = children[i];
            if ((<any>obj).isNode) {
                var nodeObject = new Object();
                nodeObject["id"] = obj.id;
                nodeObject["color"] = this.colaGraph.nodeMeshes[obj.id].material.color.getHexString();
                nodeObject["radius"] = this.colaGraph.nodeMeshes[obj.id].scale.x * unitRadius;

                var v = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
                var matrixWorld = obj.matrixWorld;
                //screenCoords.setFromMatrixPosition(matrixWorld); // not sure why this method is undefined; maybe we have an old version of three.js
                (<any>screenCoords).getPositionFromMatrix(matrixWorld);
                projector.projectVector(screenCoords, this.camera);

                screenCoords.x = (screenCoords.x * widthHalf) + widthHalf;
                screenCoords.y = - (screenCoords.y * heightHalf) + heightHalf;
                nodeObject["x"] = screenCoords.x;
                nodeObject["y"] = screenCoords.y;

                nodeObjectArray.push(nodeObject);
            }
        }

        var linkObjectArray = [];
        for (var i = 0; i < this.colaGraph.edgeList.length; i++) {
            var edge = this.colaGraph.edgeList[i];
            if (edge.visible) {
                var linkObject = new Object();
                linkObject["value"] = 1;

                for (var j = 0; j < nodeObjectArray.length; j++) {
                    if (nodeObjectArray[j].id == edge.sourceNode.id) {
                        linkObject["source"] = j;
                        linkObject["x1"] = nodeObjectArray[j].x;
                        linkObject["y1"] = nodeObjectArray[j].y;
                    }

                    if (nodeObjectArray[j].id == edge.targetNode.id) {
                        linkObject["target"] = j;
                        linkObject["x2"] = nodeObjectArray[j].x;
                        linkObject["y2"] = nodeObjectArray[j].y;
                    }
                }

                linkObjectArray.push(linkObject);
            }
        }

        var nodeJson = JSON.parse(JSON.stringify(nodeObjectArray));
        var linkJson = JSON.parse(JSON.stringify(linkObjectArray));

        if (init) {
            var link = this.svg.selectAll(".link")
                .data(linkJson)
                .enter().append("line")
                .attr("class", "link")
                .attr("x1", function (d) { return d.x1; })
                .attr("y1", function (d) { return d.y1; })
                .attr("x2", function (d) { return d.x2; })
                .attr("y2", function (d) { return d.y2; })
                .style("stroke-width", function (d) { return Math.sqrt(d.value); });

            var node = this.svg.selectAll(".node")
                .data(nodeJson)
                .enter().append("circle")
                .attr("class", "node")
                .attr("r", function (d) { return d.radius; })
                .attr("cx", function (d) { return d.x; })
                .attr("cy", function (d) { return d.y; })
                .style("fill", function (d) { return d.color; })
                .call(this.cola2D.drag);

            node.append("title")
                .text(function (d) { return d.id; });
        }
        else {
            var node = this.svg.selectAll(".node")
                .data(nodeJson)
                .attr("r", function (d) { return d.radius; })
                .attr("cx", function (d) { return d.x; })
                .attr("cy", function (d) { return d.y; })
                .style("fill", function (d) { return d.color; })
        }

        /*
        this.cola2D
            .nodes(nodeJson)
            .links(linkJson)
            .start();
               
        this.cola2D.on("tick", function () {
            link.attr("x1", function (d) { return d.x1; })
                .attr("y1", function (d) { return d.y1; })
                .attr("x2", function (d) { return d.x2; })
                .attr("y2", function (d) { return d.y2; });

            node.attr("cx", function (d) { return d.x; })
                .attr("cy", function (d) { return d.y; });
        });
        */
    }

    isDeleted() {
        return this.deleted;
    }

    applyFilter(filteredIDs: number[]) {
        if (!this.dataSet || !this.dataSet.attributes) return;

        console.log("app id: " + this.id + "; count: " + filteredIDs.length);   

        this.physioGraph.filteredNodeIDs = filteredIDs;
        this.physioGraph.applyNodeFiltering();
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    }

    highlightSelectedNodes(filteredIDs: number[]) {
        if (!this.dataSet || !this.dataSet.attributes) return;

        console.log("app id: " + this.id + "; count: " + filteredIDs.length);

        this.physioGraph.highlightSelectedNodes(filteredIDs);
        this.colaGraph.highlightSelectedNodes(filteredIDs);
        if (this.svgMode) this.updateSVGGraph(false);
    }

    setNodeDefaultSizeColor() {
        // set default node color and scale
        this.physioGraph.setDefaultNodeColor();
        this.colaGraph.setDefaultNodeColor();

        this.physioGraph.setDefaultNodeScale();
        this.colaGraph.setDefaultNodeScale();
        if (this.svgMode) this.updateSVGGraph(false);
    }

    setNodeSize(scaleArray: number[]) {
        this.physioGraph.setNodesScale(scaleArray);
        this.colaGraph.setNodesScale(scaleArray);
        if (this.svgMode) this.updateSVGGraph(false);
    }

    setANodeColor(nodeID: number, color: string) {
        var value = parseInt(color.replace("#", "0x"));

        this.physioGraph.setNodeColor(nodeID, value);
        this.colaGraph.setNodeColor(nodeID, value);
        if (this.svgMode) this.updateSVGGraph(false);
    }

    setNodeColor(attribute: string, minColor: string, maxColor: string) {
        if (!attribute || !minColor || !maxColor) return;
        if (!this.dataSet || !this.dataSet.attributes) return;

        var attrArray = this.dataSet.attributes.get(attribute);
        if (!attrArray) return;

        var columnIndex = this.dataSet.attributes.columnNames.indexOf(attribute);

        // assume all positive numbers in the array
        var min = this.dataSet.attributes.getMin(columnIndex);
        var max = this.dataSet.attributes.getMax(columnIndex);

        var colorArray: number[];

        if (max / min > 10) {
            var colorMap = d3.scale.linear().domain([Math.log(min), Math.log(max)]).range([minColor, maxColor]);
            colorArray = attrArray.map((value: number) => {
                var str = colorMap(Math.log(value)).replace("#", "0x");
                return parseInt(str);
            });
        }
        else {
            var colorMap = d3.scale.linear().domain([min, max]).range([minColor, maxColor]);
            colorArray = attrArray.map((value: number) => {
                var str = colorMap(value).replace("#", "0x");
                return parseInt(str);
            });
        }

        if (!colorArray) return;

        this.physioGraph.setNodesColor(colorArray);
        this.colaGraph.setNodesColor(colorArray);
        if (this.svgMode) this.updateSVGGraph(false);
    }

    setNodeColorDiscrete(attribute: string, keyArray: number[], colorArray: string[]) {
        if (!attribute) return;
        if (!this.dataSet || !this.dataSet.attributes) return;

        var attrArray = this.dataSet.attributes.get(attribute);
        if (!attrArray) return;

        var colorArrayNum: number[];
        var colorMap = d3.scale.ordinal().domain(keyArray).range(colorArray);

        colorArrayNum = attrArray.map((value: number) => {
            var str = colorMap(value).replace("#", "0x");
            return parseInt(str);
        });

        if (!colorArrayNum) return;

        this.physioGraph.setNodesColor(colorArrayNum);
        this.colaGraph.setNodesColor(colorArrayNum);
        if (this.svgMode) this.updateSVGGraph(false);
    }

    resize(width: number, height: number) {
        // Resize the renderer
        this.renderer.setSize(width, height - sliderSpace);
        this.currentViewWidth = width;

        this.cola2D.size([width, height - sliderSpace]);

        this.svg
            .attr("width", width)
            .attr("height", height - sliderSpace);

        // Calculate the aspect ratio
        var aspect = width / (height - sliderSpace);
        this.camera.aspect = aspect;

        // Calculate the FOVs
        var verticalFov = Math.atan(height / window.outerHeight); // Scale the vertical fov with the vertical height of the window (up to 45 degrees)
        var horizontalFov = verticalFov * aspect;

        this.defaultFov = verticalFov * 180 / Math.PI;

        this.camera.fov = this.defaultFov * this.fovZoomRatio;       
        this.camera.updateProjectionMatrix();
        //console.log("this.camera.fov: " + this.camera.fov);

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
                //return 15 / (sim + 1); // Convert similarities to distances
                return 0.5 / (sim * sim); 
            }));
        }

        // Set up the node colourings
        this.nodeColourings = this.dataSet.attributes.get('module_id').map((group: number) => {
            //var str = this.d3ColorSelector(group).replace("#", "0x");
            //return parseInt(str);
            return 0xd3d3d3;
        });

        // Set up loop
        if (!this.loop)
            this.loop = new Loop(this, 0.03);

        // Set up the two graphs
        var edgeMatrix = this.adjMatrixFromEdgeCount(maxEdgesShowable); // Don''t create more edges than we will ever be showing
        if (this.physioGraph) this.physioGraph.destroy();
        this.physioGraph = new Graph(this.brainObject, edgeMatrix, this.nodeColourings, this.dataSet.simMatrix);
        this.physioGraph.setNodePositions(this.commonData.brainCoords);

        var edgeMatrix = this.adjMatrixFromEdgeCount(maxEdgesShowable);
        if (this.colaGraph) this.colaGraph.destroy();
        this.colaGraph = new Graph(this.colaObject, edgeMatrix, this.nodeColourings, this.dataSet.simMatrix);
        this.colaGraph.setVisible(false);

        // Initialize the filtering
        this.filteredAdjMatrix = this.adjMatrixFromEdgeCount(initialEdgesShown);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.edgeCountSliderOnChange(initialEdgesShown);
        
        // Enable the slider
        $('#edge-count-slider-' + this.id).prop('disabled', false);
        $('#button-show-network-' + this.id).prop('disabled', false);
        $('#checkbox-edges-thickness-by-weight-' + this.id).prop('disabled', false);
        $('#checkbox-all-labels-' + this.id).prop('disabled', false);
        $('#checkbox-edge-color-' + this.id).prop('disabled', false);
        $('#checkbox-auto-rotation-' + this.id).prop('disabled', false);
        $('#select-network-type-' + this.id).prop('disabled', false);        
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
                this.commonData.nodeIDUnderPointer = intersected[i].object.id;
                return intersected[i].object;
            }
        }

        return null;
    }

    update(deltaTime: number) {
        // Execute coroutines
        /*
        for (var i = 0; i < coroutines.length;) {
            if (coroutines[i].func(coroutines[i], deltaTime))
                coroutines.splice(i, 1);
            else
                ++i;
        }
        */

        // execute animation sequently
        if (coroutines.length > 0) {
            if (coroutines[0].func(coroutines[0], deltaTime))
                coroutines.splice(0, 1);
        }

        var node = this.getNodeUnderPointer(this.input.localPointerPosition());
        if (node || (this.commonData.nodeIDUnderPointer != -1)) {
            // If we already have a node ID selected, deselect it
            if (this.selectedNodeID >= 0) {
                this.physioGraph.deselectNode(this.selectedNodeID);
                this.colaGraph.deselectNode(this.selectedNodeID);

                this.physioGraph.deselectAdjEdges(this.selectedNodeID);
                this.colaGraph.deselectAdjEdges(this.selectedNodeID);
            }

            if (node) {
                this.selectedNodeID = node.id;
            }
            else {
                this.selectedNodeID = this.commonData.nodeIDUnderPointer;
            }

            // Select the new node ID
            this.physioGraph.selectNode(this.selectedNodeID);
            this.colaGraph.selectNode(this.selectedNodeID);

            this.physioGraph.selectAdjEdges(this.selectedNodeID);
            this.colaGraph.selectAdjEdges(this.selectedNodeID);
        }


        if (this.showingCola)
            this.descent.rungeKutta(); // Do an iteration of the solver

        this.physioGraph.update(); 
        this.colaGraph.update(); // Update all the edge positions

        if (this.autoRotation) {
            this.brainObject.rotation.set(this.brainObject.rotation.x + this.mouse.dy / 100, this.brainObject.rotation.y + this.mouse.dx / 100, this.brainObject.rotation.z);
            this.colaObject.rotation.set(this.colaObject.rotation.x + this.mouse.dy / 100, this.colaObject.rotation.y + this.mouse.dx / 100, this.colaObject.rotation.z);
        }

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
    nodeLabelList: any[];
    nodeDefaultColor: number[];
    nodeCurrentColor: number[];

    edgeMatrix: any[][];
    edgeList: Edge[] = [];
    visible: boolean = true;

    filteredNodeIDs: number[];
    nodeHasNeighbors: boolean[]; // used for cola graph only

    edgeThicknessByWeighted: boolean = false;
    edgeColored: boolean = false;
    allLabels: boolean = false;

    constructor(parentObject, adjMatrix: any[][], nodeColourings: number[], weightMatrix: any[][]) {
        this.parentObject = parentObject;
        this.rootObject = new THREE.Object3D();
        parentObject.add(this.rootObject);

        // Create all the node meshes
        this.nodeMeshes = Array(adjMatrix.length);
        this.nodeLabelList = Array(adjMatrix.length);
        this.nodeDefaultColor = nodeColourings.slice(0); // clone the array
        this.nodeCurrentColor = nodeColourings.slice(0); // clone the array

        for (var i = 0; i < adjMatrix.length; ++i) {
            var sphere = this.nodeMeshes[i] = new THREE.Mesh(
                new THREE.SphereGeometry(2, 10, 10),
                new THREE.MeshLambertMaterial({ color: nodeColourings[i] })
                );

            this.nodeLabelList[i] = this.createNodeLabel(i.toString(), 12);

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
                    this.edgeList.push(adjMatrix[i][j] = adjMatrix[j][i] = new Edge(this.rootObject, this.nodeMeshes[i], this.nodeMeshes[j], weightMatrix[i][j])); // assume symmetric matrix
                } else {
                    adjMatrix[i][j] = adjMatrix[j][i] = null;
                }
            }
        }
        adjMatrix[len - 1][len - 1] = null;

        this.edgeMatrix = adjMatrix;
    }

    createNodeLabel(text: string, fontSize: number) {
        // draw text on canvas 
        var multiplyScale = 3; // for higher resolution of the label
        var varFontSize = fontSize * multiplyScale;

        // 1. create a canvas element
        var canvas = document.createElement('canvas');

        var context = canvas.getContext('2d');
        context.font = "Bold " + varFontSize + "px Arial";

        canvas.width = context.measureText(text).width;
        canvas.height = varFontSize;

        context.font = varFontSize + "px Arial";
        context.fillStyle = "rgba(0,0,0,1)";
        context.fillText(text, 0, varFontSize);

        // 2. canvas contents will be used for a texture
        var texture = new THREE.Texture(canvas)
	    texture.needsUpdate = true;
        
        // 3. map texture to an object
        // method 1: do not face the camera
        /*
        var material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        material.transparent = true;

        var mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(canvas.width, canvas.height),
            material
            );
        mesh.scale.set(0.1, 0.1, 1);
        return mesh;
        */   

        // method 2:
        var spriteMaterial = new THREE.SpriteMaterial({ map: texture, useScreenCoordinates: false });
        var sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(canvas.width / multiplyScale, canvas.height / multiplyScale, 1); 

        return sprite;
    }

    setNodePositions(colaCoords: number[][]) {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].position.x = colaCoords[0][i];
            this.nodeMeshes[i].position.y = colaCoords[1][i];
            this.nodeMeshes[i].position.z = colaCoords[2][i];

            // set the node label position 
            this.nodeLabelList[i].position.x = this.nodeMeshes[i].position.x + 7;
            this.nodeLabelList[i].position.y = this.nodeMeshes[i].position.y + 7;
            this.nodeLabelList[i].position.z = this.nodeMeshes[i].position.z;
        }
    }

    // Lerp between the physio and Cola positions of the nodes
    // 0 <= t <= 1
    setNodePositionsLerp(colaCoords1: number[][], colaCoords2: number[][], t: number) {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].position.x = colaCoords1[0][i] * (1 - t) + colaCoords2[0][i] * t;
            this.nodeMeshes[i].position.y = colaCoords1[1][i] * (1 - t) + colaCoords2[1][i] * t;
            this.nodeMeshes[i].position.z = colaCoords1[2][i] * (1 - t) + colaCoords2[2][i] * t;

            // set the node label position 
            this.nodeLabelList[i].position.x = this.nodeMeshes[i].position.x + 7;
            this.nodeLabelList[i].position.y = this.nodeMeshes[i].position.y + 7;
            this.nodeLabelList[i].position.z = this.nodeMeshes[i].position.z;
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

    // used by physioGraph
    applyNodeFiltering() {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.rootObject.remove(this.nodeMeshes[i]);
        }

        if (this.filteredNodeIDs) {
            for (var j = 0; j < this.filteredNodeIDs.length; ++j) {
                var nodeID = this.filteredNodeIDs[j];

                this.rootObject.add(this.nodeMeshes[nodeID]);
            }
        }
    }

    // used by colaGraph
    setNodeVisibilities(visArray: boolean[]) {
        if (!visArray) return;
        this.nodeHasNeighbors = visArray.slice(0);

        for (var i = 0; i < visArray.length; ++i) {
            if (visArray[i]) {
                if (this.filteredNodeIDs) {
                    if (this.filteredNodeIDs.indexOf(i) != -1) {
                        this.rootObject.add(this.nodeMeshes[i]);
                    }
                    else {
                        this.rootObject.remove(this.nodeMeshes[i]);
                    }
                }
                else {
                    this.rootObject.add(this.nodeMeshes[i]);
                }
            }
            else {
                this.rootObject.remove(this.nodeMeshes[i]);
            }
        }
    }

    highlightSelectedNodes(filteredIDs: number[]) {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            if (filteredIDs.indexOf(i) == -1) {
                this.nodeMeshes[i].material.color.setHex(this.nodeCurrentColor[i]);
            }
            else {
                this.nodeMeshes[i].material.color.setHex(0xFFFF00); // highlight color
            }
        }
    }

    setEdgeVisibilities(visMatrix: number[][]) {
        var len = visMatrix.length;
        for (var i = 0; i < len - 1; ++i) {
            for (var j = i + 1; j < len; ++j) {
                var edge = this.edgeMatrix[i][j];

                if (this.filteredNodeIDs) {
                    if ((this.filteredNodeIDs.indexOf(i) == -1) || (this.filteredNodeIDs.indexOf(j) == -1)) {
                        if (edge) edge.setVisible(false);
                    }
                    else {
                        if (edge) edge.setVisible(visMatrix[i][j] === 1 ? true : false);
                    }
                }
                else {
                    if (edge) edge.setVisible(visMatrix[i][j] === 1 ? true : false);
                }
            }
        }
    }

    showAllLabels() {
        for (var i = 0; i < this.nodeLabelList.length; ++i) {
            if (this.nodeLabelList[i]) {
                this.parentObject.add(this.nodeLabelList[i]);
            }
        }
    }

    hideAllLabels() {
        for (var i = 0; i < this.nodeLabelList.length; ++i) {
            if (this.nodeLabelList[i]) {
                this.parentObject.remove(this.nodeLabelList[i]);
            }
        }
    }

    setDefaultNodeScale() {
        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].scale.set(1, 1, 1);
        }
    }

    setDefaultNodeColor() {
        this.nodeCurrentColor = this.nodeDefaultColor.slice(0);

        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].material.color.setHex(this.nodeDefaultColor[i]);
        }
    }

    setNodesScale(scaleArray: number[]) {
        if (!scaleArray) return;
        if (scaleArray.length != this.nodeMeshes.length) return;

        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            var scale = scaleArray[i];
            this.nodeMeshes[i].scale.set(scale, scale, scale);
        }
    }

    setNodesColor(colorArray: number[]) {
        if (!colorArray) return;
        if (colorArray.length != this.nodeMeshes.length) return;

        this.nodeCurrentColor = colorArray.slice(0); // clone the array

        for (var i = 0; i < this.nodeMeshes.length; ++i) {
            this.nodeMeshes[i].material.color.setHex(colorArray[i]);
        }
        /*
        // also set edge color:
        for (var i = 0; i < this.edgeList.length; ++i) {
            var edge = this.edgeList[i];
            if (edge) {
                var sourceColor = edge.sourceNode.material.color.getHex();
                var targetColor = edge.targetNode.material.color.getHex();

                if (sourceColor == targetColor) {
                    edge.setColor(edge.sourceNode.material.color.getHex());
                }
            }
        }
        */
    }

    getNodeColor(id: number) {
        return this.nodeMeshes[id].material.color.getHex();
    }

    setNodeColor(id: number, color: number) {
        this.nodeMeshes[id].material.color.setHex(color);
    }

    selectNode(id: number) {
        var x = this.nodeMeshes[id].scale.x;
        var y = this.nodeMeshes[id].scale.y;
        var z = this.nodeMeshes[id].scale.z;

        this.nodeMeshes[id].scale.set(2*x, 2*y, 2*z);

        if (this.allLabels == false) {
            this.parentObject.add(this.nodeLabelList[id]);
        }
    }

    deselectNode(id: number) {
        var x = this.nodeMeshes[id].scale.x;
        var y = this.nodeMeshes[id].scale.y;
        var z = this.nodeMeshes[id].scale.z;

        this.nodeMeshes[id].scale.set(0.5*x, 0.5*y, 0.5*z);

        if (this.allLabels == false) {
            this.parentObject.remove(this.nodeLabelList[id]);
        }
    }

    selectAdjEdges(nodeID: number) {
        for (var j = 0; j < this.edgeMatrix.length; ++j) {
            var edge = this.edgeMatrix[nodeID][j];
            if (edge) {
                if (edge.visible == true) {
                    //edge.setColor(this.nodeMeshes[nodeID].material.color.getHex());
                    edge.multiplyScale(2);
                }
            }
        }
    }

    deselectAdjEdges(nodeID: number) {
        for (var j = 0; j < this.edgeMatrix.length; ++j) {
            var edge = this.edgeMatrix[nodeID][j];
            if (edge) {
                if (edge.visible == true) {
                    //edge.setColor(0xcfcfcf); // default edge color
                    edge.multiplyScale(0.5); 
                }
            }
        }
    }

    update() {
        var weightedEdges = this.edgeThicknessByWeighted;
        var coloredEdges = this.edgeColored;
        this.edgeList.forEach(function (edge) {
            edge.update(weightedEdges, coloredEdges);
        });
    }

    // Remove self from the scene so that the object can be GC'ed
    destroy() {
        this.parentObject.remove(this.rootObject);
    }
}

class Edge {
    shape;
    geometry;
    visible: boolean = true;
    scaleWeighted = 0.5;
    scaleNoWeighted = 1;

    constructor(public parentObject, public sourceNode, public targetNode, private weight) {
        this.shape = this.makeCylinder();
        parentObject.add(this.shape);

        var w = (Math.ceil(weight * 10) - 6) * 0.5; // the edge scale is not proportional to edge weight
        if (w < 0) w = 0;
        this.scaleWeighted += w; 
    }

    makeCylinder() {
        var n = 1,
            points = [],
            cosh = v => (Math.pow(Math.E, v) + Math.pow(Math.E, -v)) / 2;

        var xmax = 2,
            m = 2 * cosh(xmax);

        for (var i = 0; i < n + 1; i++) {
            var x = 2 * xmax * (i - n / 2) / n;
            points.push(new THREE.Vector3(cosh(x) / m, 0, (i - n / 2) / n));
        }

        this.geometry = new THREE.LatheGeometry(points, 12);

        var material = new THREE.MeshLambertMaterial({ color: 0xcfcfcf });
        var cylinder = new THREE.Mesh(this.geometry, material);

        return cylinder;
    }

    setColor(hex: number) {
        this.shape.material.color.setHex(hex);
    }

    multiplyScale(s: number) {
        this.scaleWeighted *= s;
        this.scaleNoWeighted *= s;
    }

    setVisible(flag: boolean) {
        if (flag) {
            if (!this.visible) {
                this.parentObject.add(this.shape);
                this.visible = true;
            }
        } else {
            if (this.visible) {
                this.parentObject.remove(this.shape);
                this.visible = false;
            }
        }
    }

    update(weightedEdges: boolean, coloredEdges: boolean) {
        this.geometry.verticesNeedUpdate = true;

        var scale = 1;

        if (weightedEdges == true) {
            scale = this.scaleWeighted;
        }
        else {
            scale = this.scaleNoWeighted;
        }

        if (coloredEdges == true) {
            var sourceColor = this.sourceNode.material.color;
            var targetColor = this.targetNode.material.color;

            if (sourceColor.getHex() == targetColor.getHex()) {
                this.setColor(sourceColor.getHex());
            }
            else if (((sourceColor.getHex() / targetColor.getHex()) > 0.95) && ((sourceColor.getHex() / targetColor.getHex()) < 1.05)) { 
                this.setColor(sourceColor.getHex());
            }
            else {
                this.setColor(0xcfcfcf); // default edge color
            }
        }
        else {
            this.setColor(0xcfcfcf); // default edge color
        }

        var a = this.sourceNode.position, b = this.targetNode.position;
        var m = new THREE.Vector3();
        m.addVectors(a, b).divideScalar(2);
        this.shape.position = m;
        var origVec = new THREE.Vector3(0, 0, 1);         //vector of cylinder
        var targetVec = new THREE.Vector3();
        targetVec.subVectors(b, a);
        var length = targetVec.length();
        this.shape.scale.set(scale, scale, length);
        targetVec.normalize();

        var angle = Math.acos(origVec.dot(targetVec));

        var axis = new THREE.Vector3();
        axis.crossVectors(origVec, targetVec);
        axis.normalize();
        var quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(axis, angle);
        this.shape.quaternion = quaternion;
    }
}


/*
class Edge {
    line;
    geometry;
    visible: boolean = true;

    constructor(public parentObject, endPoint1, endPoint2) {
        this.geometry = new THREE.Geometry();
        this.geometry.vertices.push(endPoint1);
        this.geometry.vertices.push(endPoint2);

        // threejs.org: Due to limitations in the ANGLE layer, on Windows platforms linewidth will always be 1 regardless of the set value.
        this.line = new THREE.Line(this.geometry, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3 }));

        parentObject.add(this.line);
        //this.highlighted = false;
    }

    setColor(hex: number) {
        this.line.material.color.setHex(hex);
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
*/


/* Functions can be pushed to the coroutines array to be executed as if they are
 * occuring in parallel with the program execution.
 */
var coroutines = new Array();

function setCoroutine(data, func) {
    data.func = func;
    coroutines.push(data);
}