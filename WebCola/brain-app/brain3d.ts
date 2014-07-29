/// <reference path="../src/descent.ts"/>
/// <reference path="../src/shortestpaths.ts"/>
/**
    This application uses similarity data between areas of the brain to construct a thresholded graph with edges
    between the most similar areas. It is designed to be embedded in a view defined in brainapp.html / brainapp.ts.
*/

// GLOBAL VARIABLES
declare var d3;
declare var numeric;
declare var packages;
declare function d3adaptor(): string;
var colans = <any>cola;

var sliderSpace = 70; // The number of pixels to reserve at the bottom of the div for the slider
//var uniqueID = 0; // Each instance of this application is given a unique ID so that the DOM elements they create can be identified as belonging to them
var maxEdgesShowable = 1000;
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
    jDivProcessingNotification;
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
    brainSurfaceBoundingSphere;
    brainObject; // Base object for the brain graph
    colaObject; // Base object for the cola graph
    brainGeometry;
    colaCoords: number[][];
    sortedSimilarities: number[];
    physioGraph: Graph;
    colaGraph: Graph;
    svgGraph: Graph2D;

    cola2D;
    svg;
    svgMode;
    svgAllElements;
    svgNodeBundleArray: any[];
    svgControlMode: boolean = false;
    svgNeedsUpdate: boolean = false;
    d3Zoom = d3.behavior.zoom();

    circularCSSClass: string;
    circularDotCSSClass: string;
    circularBar1Color: string = 'd3d3d3';
    circularBar2Color: string = 'd3d3d3';
    circularBarColorChange: boolean = false;
    circularMouseDownEventListenerAdded = false;

    nodeColourings: number[]; // Stores the colourings associated with the groups
    dissimilarityMatrix: number[][] = []; // An inversion of the similarity matrix, used for Cola graph distances

    // State
    //showingCola: boolean = false;
    transitionInProgress: boolean = false;
    currentThreshold: number = 0;
    filteredAdjMatrix: number[][];
    selectedNodeID = -1;

    lastSliderValue = 0;
    surfaceLoaded: boolean = false;

    defaultFov: number;
    fovZoomRatio = 1;
    currentViewWidth: number; 

    allLables: boolean = false;
    autoRotation: boolean = false;
    weightedEdges: boolean = false;
    coloredEdges: boolean = false;
    bundlingEdges: boolean = false;

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
            //this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y - this.rotationSpeed * deltaTime, this.brainObject.rotation.z);
            //this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y - this.rotationSpeed * deltaTime, this.colaObject.rotation.z);

            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(0, -1, 0);
            quat.setFromAxisAngle(axis, this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quat, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quat, this.colaObject.quaternion);
        });

        this.input.regKeyTickCallback('d', (deltaTime: number) => {
            //this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y + this.rotationSpeed * deltaTime, this.brainObject.rotation.z);
            //this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y + this.rotationSpeed * deltaTime, this.colaObject.rotation.z);

            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(0, 1, 0);
            quat.setFromAxisAngle(axis, this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quat, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quat, this.colaObject.quaternion);
        });

        this.input.regKeyTickCallback('w', (deltaTime: number) => {
            //this.brainObject.rotation.set(this.brainObject.rotation.x - this.rotationSpeed * deltaTime, this.brainObject.rotation.y, this.brainObject.rotation.z);
            //this.colaObject.rotation.set(this.colaObject.rotation.x - this.rotationSpeed * deltaTime, this.colaObject.rotation.y, this.colaObject.rotation.z);

            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(-1, 0, 0);
            quat.setFromAxisAngle(axis, this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quat, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quat, this.colaObject.quaternion);
        });

        this.input.regKeyTickCallback('s', (deltaTime: number) => {
            //this.brainObject.rotation.set(this.brainObject.rotation.x + this.rotationSpeed * deltaTime, this.brainObject.rotation.y, this.brainObject.rotation.z);
            //this.colaObject.rotation.set(this.colaObject.rotation.x + this.rotationSpeed * deltaTime, this.colaObject.rotation.y, this.colaObject.rotation.z);

            var quat = new THREE.Quaternion();
            var axis = new THREE.Vector3(1, 0, 0);
            quat.setFromAxisAngle(axis, this.rotationSpeed * deltaTime); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quat, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quat, this.colaObject.quaternion);
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
            if (this.svgControlMode) return;

            // left button: rotation
            if (mode == 1) {
                if (this.autoRotation == false) {
                    var pixelAngleRatio = 50;
                    //this.brainObject.rotation.set(this.brainObject.rotation.x, this.brainObject.rotation.y + dx / pixelAngleRatio, this.brainObject.rotation.z);
                    //this.colaObject.rotation.set(this.colaObject.rotation.x, this.colaObject.rotation.y + dx / pixelAngleRatio, this.colaObject.rotation.z);

                    var quatX = new THREE.Quaternion();
                    var axisX = new THREE.Vector3(0, 1, 0);
                    quatX.setFromAxisAngle(axisX, dx / pixelAngleRatio); // axis must be normalized, angle in radians
                    this.brainObject.quaternion.multiplyQuaternions(quatX, this.brainObject.quaternion);
                    this.colaObject.quaternion.multiplyQuaternions(quatX, this.colaObject.quaternion);

                    //this.brainObject.rotation.set(this.brainObject.rotation.x + dy / pixelAngleRatio, this.brainObject.rotation.y, this.brainObject.rotation.z);
                    //this.colaObject.rotation.set(this.colaObject.rotation.x + dy / pixelAngleRatio, this.colaObject.rotation.y, this.colaObject.rotation.z);

                    var quatY = new THREE.Quaternion();
                    var axisY = new THREE.Vector3(1, 0, 0);
                    quatY.setFromAxisAngle(axisY, dy / pixelAngleRatio); // axis must be normalized, angle in radians
                    this.brainObject.quaternion.multiplyQuaternions(quatY, this.brainObject.quaternion);
                    this.colaObject.quaternion.multiplyQuaternions(quatY, this.colaObject.quaternion);
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
            }
        });

        this.input.regMouseRightClickCallback((x: number, y: number) => {
            if (this.svgControlMode) return;

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
            if (this.svgControlMode) return;

            this.fovZoomRatio = 1;
            this.camera.fov = this.defaultFov;
            this.camera.updateProjectionMatrix();

            this.brainObject.position = new THREE.Vector3(-this.graphOffset, 0, 0);
            this.brainObject.rotation.set(0, 0, 0);

            //if (this.showingCola) {
            //if (this.colaGraph.isVisible()) {
                this.colaObject.position = new THREE.Vector3(this.graphOffset, 0, 0);
                this.colaObject.rotation.set(0, 0, 0);
            //}   
        });

        this.input.regMouseWheelCallback((delta: number) => {
            if (this.svgControlMode) return;

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

        var varShowNetwork = (b: boolean) => { this.showNetwork(b); };
        var varEdgesThicknessByWeightedOnChange = () => { this.edgesThicknessByWeightedOnChange(); };
        var varEdgesColoredOnChange = () => { this.edgesColoredOnChange(); };
        var varEdgesBundlingOnChange = () => { this.edgesBundlingOnChange(); };
        var varAllLabelsOnChange = () => { this.allLabelsOnChange(); };
        var varAutoRotationOnChange = (s) => { this.autoRotationOnChange(s); };
        var varSliderMouseEvent = (e: string) => { this.sliderMouseEvent(e); };
        var varGraphViewSliderOnChange = (v: number) => { this.graphViewSliderOnChange(v); };
        var varEdgeCountSliderOnChange = (v: number) => { this.edgeCountSliderOnChange(v); };
        var varCloseBrainAppOnClick = () => { this.closeBrainAppOnClick(); };
        var varDefaultOrientationsOnClick = (s: string) => { this.defaultOrientationsOnClick(s); };
        var varNetworkTypeOnChange = (s: string) => { this.networkTypeOnChange(s); };
        
        var varShowProcessingNotification = () => { this.showProcessingNotification(); };
        

        this.input.regKeyDownCallback(' ', varShowNetwork);
            
        // Set the background colour
        jDiv.css({ backgroundColor: '#ffffff' });

        // Set up renderer, and add the canvas and the slider to the div
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(jDiv.width(), (jDiv.height() - sliderSpace));
        jDiv.append($('<span id="close-brain-app-' + this.id + '" title="Close" class="view-panel-span">x</span>')
                .css({ 'right': '6px', 'top': '10px', 'font-size': '12px' })
                .click(function () { varCloseBrainAppOnClick(); }))
            .append($('<span id="top-view-' + this.id + '" title="Top View" class="view-panel-span">T</span>')
                .css({ 'right': '6px', 'top': '30px' })
                .click(function () { varDefaultOrientationsOnClick("top"); }))
            .append($('<span id="bottom-view-' + this.id + '" title="Bottom View" class="view-panel-span">B</span>')
                .css({ 'right': '6px', 'top': '50px' })
                .click(function () { varDefaultOrientationsOnClick("bottom"); }))
            .append($('<span id="left-view-' + this.id + '" title="Left View" class="view-panel-span">L</span>')
                .css({ 'right': '6px', 'top': '70px' })
                .click(function () { varDefaultOrientationsOnClick("left"); }))
            .append($('<span id="right-view-' + this.id + '" title="Right View" class="view-panel-span">R</span>')
                .css({ 'right': '6px', 'top': '90px' })
                .click(function () { varDefaultOrientationsOnClick("right"); }))
            .append($('<span id="front-view-' + this.id + '" title="Front View" class="view-panel-span">F</span>')
                .css({ 'right': '6px', 'top': '110px' })
                .click(function () { varDefaultOrientationsOnClick("front"); }))
            .append($('<span id="back-view-' + this.id + '" title="Back View" class="view-panel-span">B</span>')
                .css({ 'right': '6px', 'top': '130px' })
                .click(function () { varDefaultOrientationsOnClick("back"); }))
            .append($('<span id="all-labels-' + this.id + '" title="All Labels" class="view-panel-span">&#8704</span>')
                .css({ 'right': '6px', 'top': '150px' })
                .click(function () { varAllLabelsOnChange(); }))
            .append($('<span id="anti-auto-rotation-' + this.id + '" title="Anticlockwise Auto Rotation" class="view-panel-span">&#8634</span>')
                .css({ 'right': '6px', 'top': '170px' })
                .click(function () { varAutoRotationOnChange("anticlockwise"); }))
            .append($('<span id="colored-edges-' + this.id + '" title="Colored Edges" class="view-panel-span">C</span>')
                .css({ 'right': '7px', 'top': '190px' })
                .click(function () { varEdgesColoredOnChange(); }))
            .append($('<span id="weighted-edges-' + this.id + '" title="Weighted Edges" class="view-panel-span">W</span>')
                .css({ 'right': '6px', 'top': '210px' })
                .click(function () { varEdgesThicknessByWeightedOnChange(); }))
            .append($('<span id="bundling-edges-' + this.id + '" title="Edge Bundling" class="view-panel-span">&#8712</span>')
                .css({ 'right': '6px', 'top': '230px', 'font-size': '20px' })
                .on("mousedown", function () { varShowProcessingNotification(); })
                .on("mouseup", function () { varEdgesBundlingOnChange(); }))
            .append($('<input id="graph-view-slider-' + this.id + '" type="range" min="0" max="100" value="100"></input>')
                .css({ 'position': 'absolute', 'visibility': 'hidden', '-webkit-appearance': 'slider-vertical', 'width': '20px', 'height': '180px', 'right': 0, 'top': '250px', 'z-index': 1000 })
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
                .css({ 'width': '300px', 'position': 'relative', 'z-index': 1000 })
                .mousedown(function () { varSliderMouseEvent("mousedown"); })
                .mouseup(function () { varSliderMouseEvent("mouseup"); })
                .on("input change", function () { varEdgeCountSliderOnChange($(this).val()); }))
            //.append($('<input type="checkbox" id="checkbox-edges-thickness-by-weight-' + this.id + '" disabled="true">Weighted Edges</input>').css({ 'width': '12px', 'position': 'relative', 'z-index': 1000 })
            //    .click(function () { varEdgesThicknessByWeightedOnChange($(this).is(":checked")); }))
            //.append($('<input type="checkbox" id="checkbox-edge-color-' + this.id + '" disabled="true">Colored Edge</input>').css({ 'width': '12px', 'position': 'relative', 'z-index': 1000 })
            //    .click(function () { varEdgesColoredOnChange($(this).is(":checked")); }))
            //.append($('<input type="checkbox" id="checkbox-all-labels-' + this.id + '" disabled="true">All Labels</input>').css({ 'width': '12px', 'position': 'relative', 'z-index': 1000 })
            //    .click(function () { varAllLabelsOnChange($(this).is(":checked")); }))
            //.append($('<input type="checkbox" id="checkbox-auto-rotation-' + this.id + '" disabled="true">Auto Rotation</input>').css({ 'width': '12px', 'position': 'relative', 'z-index': 1000 })
            //    .click(function () { varAutoRotationOnChange($(this).is(":checked")); }))
            //.append($('<input type="checkbox" id="checkbox-svg-control-' + this.id + '" disabled="true">SVG</input>').css({ 'width': '12px', 'position': 'relative', 'z-index': 1000 })
            //    .click(function () { varSVGControlOnChange($(this).is(":checked")); }))
            .append($('<button id="button-show-network-' + this.id + '" disabled="true">Show Network</button>').css({ 'margin-left': '10px', 'font-size': '12px', 'position': 'relative', 'z-index': 1000 })
                .click(function () { varShowNetwork(false); }))
            .append($('<select id="select-network-type-' + this.id + '" disabled="true"></select>').css({ 'margin-left': '5px', 'font-size': '12px', 'width': '80px', 'position': 'relative', 'z-index': 1000 })
                .on("change", function () { varNetworkTypeOnChange($(this).val()); }));

        //$('#button-show-network-' + this.id).button(); // jQuery button

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

        var option = document.createElement('option');
        option.text = 'circular layout';
        option.value = 'circular-layout';
        $(networkTypeSelect).append(option);

        this.cola2D = colans.d3adaptor()
            .size([jDiv.width(), jDiv.height() - sliderSpace]);

        var varSVGZoom = () => { this.svgZoom(); }
        this.svg = d3.select('#div-svg-' + this.id).append("svg")
            .attr("width", jDiv.width())
            .attr("height", jDiv.height() - sliderSpace)
            .call(this.d3Zoom.on("zoom", varSVGZoom));  
        this.svgAllElements = this.svg.append("g");

        this.jDivProcessingNotification = document.createElement('div');
        this.jDivProcessingNotification.id = 'div-processing-notification';

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

        //if (this.commonData.noBranSurface == true) this.surfaceLoaded = true;

        var surf = () => {
            if (this.surfaceLoaded == true) return;

            // Remove the old mesh and add the new one (we don't need a restart)
            this.brainObject.remove(this.brainSurface);
            // Clone the mesh - we can't share it between different canvases without cloning it
            var clonedObject = new THREE.Object3D();
            var boundingSphereObject = new THREE.Object3D();
            this.commonData.brainSurface.traverse(function (child) {
                if (child instanceof THREE.Mesh) {
                    clonedObject.add(new THREE.Mesh(child.geometry.clone(), child.material.clone()));

                    var boundingSphere = child.geometry.boundingSphere;
                    var material = child.material;
                    var sphereGeometry = new THREE.SphereGeometry(boundingSphere.radius + 10, 10, 10);
                    var sphereObject = new THREE.Mesh(sphereGeometry.clone(), material.clone());
                    sphereObject.position.x = boundingSphere.center.x;
                    sphereObject.position.y = boundingSphere.center.y;
                    sphereObject.position.z = boundingSphere.center.z;
                    sphereObject.visible = false;
                    (<any>sphereObject).isBoundingSphere = true;
                    boundingSphereObject.add(sphereObject);
                }
            });

            if (this.commonData.noBrainSurface == true) {
                this.brainSurface = null;
                clonedObject = null;
            }
            else {
                this.brainSurface = clonedObject;
                this.brainObject.add(this.brainSurface);
            }

            boundingSphereObject.visible = false;
            this.brainSurfaceBoundingSphere = boundingSphereObject;           
            this.brainObject.add(this.brainSurfaceBoundingSphere);

            this.surfaceLoaded = true;
        };
        commonData.regNotifyCoords(coords);
        commonData.regNotifyLabels(lab);
        commonData.regNotifySurface(surf);
        if (commonData.brainCoords) coords();
        if (commonData.brainLabels) lab();
        //if (commonData.brainSurface) surf(); // this line is redundant and has problem, surf() will be called in THREE.OBJLoader

        // Set up loop
        if (!this.loop)
            this.loop = new Loop(this, 0.03);
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

        this.setupNetworkTypeAppendedElements();

        //if (this.showingCola == true) {
        if (this.colaGraph.isVisible()) {
            this.showNetwork(true);
        }
        else {
            this.showNetwork(false);
        }
    }

    setupNetworkTypeAppendedElements() {
        this.circularDotCSSClass = ".network-type-appended-element-" + this.id;
        this.circularCSSClass = "network-type-appended-element-" + this.id;

        $("label").remove(this.circularDotCSSClass);
        $("select").remove(this.circularDotCSSClass);
        $("button").remove(this.circularDotCSSClass);
        $("div").remove(this.circularDotCSSClass);

        if (this.networkType == "circular-layout") {
            var varCircularLayoutAttributeOneOnChange = (s: string) => { this.circularLayoutAttributeOneOnChange(s); };
            var varCircularLayoutAttributeTwoOnChange = (s: string) => { this.circularLayoutAttributeTwoOnChange(s); };
            var varCircularLayoutSortOnChange = (s: string) => { this.circularLayoutSortOnChange(s); };
            var varCircularLayoutBundleOnChange = (s: string) => { this.circularLayoutBundleOnChange(s); };
            var varCircularLayoutHistogramButtonOnClick = () => { this.circularLayoutHistogramButtonOnClick(); };

            //------------------------------------
            this.jDiv.append($('<label class=' + this.circularCSSClass + '> bundle:</label>'));
            this.jDiv.append($('<select id="select-circular-layout-bundle-' + this.id + '" class=' + this.circularCSSClass + '></select>')
                .css({ 'margin-left': '5px', 'font-size': '12px', 'width': '80px' })
                .on("change", function () { varCircularLayoutBundleOnChange($(this).val()); }));

            $('#select-circular-layout-bundle-' + this.id).empty();

            var option = document.createElement('option');
            option.text = 'none';
            option.value = 'none';
            $('#select-circular-layout-bundle-' + this.id).append(option);

            for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
                var columnName = this.dataSet.attributes.columnNames[i];
                $('#select-circular-layout-bundle-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');            }

            //------------------------------------
            this.jDiv.append($('<label class=' + this.circularCSSClass + '> sort:</label>'));
            this.jDiv.append($('<select id="select-circular-layout-sort-' + this.id + '" class=' + this.circularCSSClass + '></select>')
                .css({ 'margin-left': '5px', 'font-size': '12px', 'width': '80px' })
                .on("change", function () { varCircularLayoutSortOnChange($(this).val()); }));

            $('#select-circular-layout-sort-' + this.id).empty();

            var option = document.createElement('option');
            option.text = 'none';
            option.value = 'none';
            $('#select-circular-layout-sort-' + this.id).append(option);

            for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
                var columnName = this.dataSet.attributes.columnNames[i];
                $('#select-circular-layout-sort-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');            }

            //------------------------------------
            this.jDiv.append($('<button id="button-circular-layout-histogram-' + this.id + '" class=' + this.circularCSSClass + '>options</button>')
                .css({ 'margin-left': '5px', 'font-size': '12px' })
                .click(function () { varCircularLayoutHistogramButtonOnClick(); }));

            $('#button-circular-layout-histogram-' + this.id).button({
                icons: {
                    primary: "ui-icon-gear",
                    secondary: "ui-icon-triangle-1-s"
                }
            });

            //------------------------------------
            this.jDiv.append($('<div id="div-circular-layout-menu-' + this.id + '" class=' + this.circularCSSClass + '></div>')
                .css({ 'display': 'none', 'background-color': '#feeebd', 'position': 'absolute', 'padding': '8px', 'border-radius': '5px' }));

            $('#div-circular-layout-menu-' + this.id).append('<div>histogram</div>');

            //---
            $('#div-circular-layout-menu-' + this.id).append('<div id="div-circular-bar1-' + this.id + '">bar 1: </div>');
            $('#div-circular-bar1-' + this.id).append($('<select id="select-circular-layout-attribute-one-' + this.id + '" class=' + this.circularCSSClass + '></select>')
                .css({ 'margin-left': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
                .on("change", function () { varCircularLayoutAttributeOneOnChange($(this).val()); }));

            $('#select-circular-layout-attribute-one-' + this.id).empty();

            var option = document.createElement('option');
            option.text = 'none';
            option.value = 'none';
            $('#select-circular-layout-attribute-one-' + this.id).append(option);

            for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
                var columnName = this.dataSet.attributes.columnNames[i];
                $('#select-circular-layout-attribute-one-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');            }

            //---
            $('#div-circular-layout-menu-' + this.id).append('<div id="div-circular-bar2-' + this.id + '">bar 2: </div>');
            $('#div-circular-bar2-' + this.id).append($('<select id="select-circular-layout-attribute-two-' + this.id + '" class=' + this.circularCSSClass + '></select>')
                .css({ 'margin-left': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
                .on("change", function () { varCircularLayoutAttributeTwoOnChange($(this).val()); }));

            $('#select-circular-layout-attribute-two-' + this.id).empty();

            var option = document.createElement('option');
            option.text = 'none';
            option.value = 'none';
            $('#select-circular-layout-attribute-two-' + this.id).append(option);

            for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
                var columnName = this.dataSet.attributes.columnNames[i];
                $('#select-circular-layout-attribute-two-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');            }

            //---
            $('#select-circular-layout-attribute-two-' + this.id).prop('disabled', true);

            var varClass = this.circularCSSClass;

            if (this.circularMouseDownEventListenerAdded == false) {
                this.circularMouseDownEventListenerAdded = true;
                document.addEventListener('mousedown', (event) => {
                    if (($(event.target).attr('class') != varClass) &&
                        ((<any>(event.target)).id != "input-circular-layout-bar1-color") &&
                        ((<any>(event.target)).id != "input-circular-layout-bar2-color") &&
                        (this.circularBarColorChange == false)) {
                        $('#div-circular-layout-menu-' + this.id).hide();
                    }

                    this.circularBarColorChange = false;
                }, false);
            }          
            //------------------------------------
        }
        else {

        }
    }

    setCircularBarColor(barNo: number, color: string) {
        this.circularBarColorChange = true;
        var value = color.replace("#", "");

        if (barNo == 1) {
            this.circularBar1Color = color;
         
            this.svgAllElements.selectAll(".rect1Circular")
                .style("fill", value);    
        }
        else if (barNo == 2) {
            this.circularBar2Color = color;

            this.svgAllElements.selectAll(".rect2Circular")
                .style("fill", value);    
        }    
    }

    circularLayoutHistogramButtonOnClick() {
        var l = $('#button-circular-layout-histogram-' + this.id).position().left + 5;
        var t = $('#button-circular-layout-histogram-' + this.id).position().top - $('#div-circular-layout-menu-' + this.id).height() - 15;

        if ($('#span-circular-layout-bar1-color-picker').length > 0) this.commonData.circularBar1ColorPicker = $('#span-circular-layout-bar1-color-picker').detach();
        $(this.commonData.circularBar1ColorPicker).appendTo('#div-circular-bar1-' + this.id);

        if ($('#span-circular-layout-bar2-color-picker').length > 0) this.commonData.circularBar2ColorPicker = $('#span-circular-layout-bar2-color-picker').detach();
        $(this.commonData.circularBar2ColorPicker).appendTo('#div-circular-bar2-' + this.id);

        (<any>document.getElementById('input-circular-layout-bar1-color')).color.fromString(this.circularBar1Color);
        (<any>document.getElementById('input-circular-layout-bar2-color')).color.fromString(this.circularBar2Color);

        $('#div-circular-layout-menu-' + this.id).zIndex(1000);
        //$('#div-circular-layout-menu-0').css({ left: l, top: t, height: 'auto', display: 'inline' });
        $('#div-circular-layout-menu-' + this.id).css({ left: l, top: t, height: 'auto'});
        $('#div-circular-layout-menu-' + this.id).fadeToggle('fast');
    }

    circularLayoutAttributeOneOnChange(attr: string) {
        if (attr == "none") {
            this.svgAllElements.selectAll(".rect1Circular")
                .attr("width", 0)
                .attr("height", 0);

            this.svgAllElements.selectAll(".rect2Circular")
                .attr("width", 0)
                .attr("height", 0);

            $('#select-circular-layout-attribute-two-' + this.id).val("none");
            $('#select-circular-layout-attribute-two-' + this.id).prop('disabled', true);
        }
        else {
            if ($('#select-circular-layout-attribute-two-' + this.id).val() == "none") {
                this.svgAllElements.selectAll(".rect1Circular")
                    .attr("width", function (d) { return 40 * d["scale_" + attr]; })
                    .attr("height", 8);
            }
            else {
                this.svgAllElements.selectAll(".rect1Circular")
                    .attr("width", function (d) { return 40 * d["scale_" + attr]; })
                    .attr("height", 4);
            }

            $('#select-circular-layout-attribute-two-' + this.id).prop('disabled', false);
        }
    }

    circularLayoutAttributeTwoOnChange(attr: string) {
        if (attr == "none") {
            this.svgAllElements.selectAll(".rect2Circular")
                .attr("width", 0)
                .attr("height", 0);

            this.svgAllElements.selectAll(".rect1Circular")
                .attr("height", 8);
        }
        else {
            this.svgAllElements.selectAll(".rect1Circular")
                .attr("height", 4);

            this.svgAllElements.selectAll(".rect2Circular")
                .attr("width", function (d) { return 40 * d["scale_" + attr]; })
                .attr("height", 4);
        }
    }

    circularLayoutSortOnChange(attr: string) {
        this.showNetwork(true);
    }

    circularLayoutBundleOnChange(attr: string) {
        this.showNetwork(true);
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

        if (this.bundlingEdges) this.edgesBundlingOnChange(); // turn off edge bundling

        var max = this.commonData.nodeCount * (this.commonData.nodeCount - 1) / 2;
        if (numEdges > max) numEdges = max;
        $('#count-' + this.id).get(0).textContent = numEdges;
        var percentile = numEdges * 100 / max;
        $('#percentile-' + this.id).get(0).textContent = percentile.toFixed(2);
        this.filteredAdjMatrix = this.adjMatrixFromEdgeCount(numEdges);
        this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    }

    edgesThicknessByWeightedOnChange() {
        if ((!this.physioGraph) || (!this.colaGraph)) return;

        this.weightedEdges = !this.weightedEdges;

        this.physioGraph.edgeThicknessByWeighted = this.weightedEdges;
        this.colaGraph.edgeThicknessByWeighted = this.weightedEdges;

        if (this.weightedEdges == true) {
            $('#weighted-edges-' + this.id).css('opacity', 1);
        }
        else {
            $('#weighted-edges-' + this.id).css('opacity', 0.2);
        }

        this.svgNeedsUpdate = true;
    }

    edgesColoredOnChange() {
        if ((!this.physioGraph) || (!this.colaGraph)) return;

        this.coloredEdges = !this.coloredEdges;

        this.physioGraph.edgeColored = this.coloredEdges;
        this.colaGraph.edgeColored = this.coloredEdges;

        if (this.coloredEdges == true) {
            $('#colored-edges-' + this.id).css('opacity', 1);
        }
        else {
            $('#colored-edges-' + this.id).css('opacity', 0.2);
        }

        this.svgNeedsUpdate = true;
    }

    edgesBundlingOnChange() {
        if ((!this.physioGraph) || (!this.colaGraph)) {
            this.removeProcessingNotification();
            return;
        }

        this.bundlingEdges = !this.bundlingEdges;

        if (this.bundlingEdges == true) {
            $('#bundling-edges-' + this.id).css('opacity', 1);

            var powerGraphPhysio = new PowerGraph(this.physioGraph);
            powerGraphPhysio.initPowerGraphSpatial3D();
            //powerGraph.initPowerGraph('3d', this.jDiv.width(), this.jDiv.height() - sliderSpace);

            if ((this.networkType == 'default') || (this.networkType == 'edge-length-depends-on-weight')) {
                //var powerGraphCola = new PowerGraph(this.colaGraph);
                //powerGraphCola.initPowerGraphSpatial3D();
            }
            else if (this.networkType == 'flatten-to-2d') {

            }
        }
        else {
            $('#bundling-edges-' + this.id).css('opacity', 0.2);

            this.physioGraph.removeAllBundlingEdges();
            this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
            this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);


            // ???
            /*
            this.colaGraph.removeAllBundlingEdges();
            this.colaGraph.filteredNodeIDs = this.physioGraph.filteredNodeIDs;
            this.colaGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
            this.colaGraph.setNodeVisibilities(); // Hide the nodes without neighbours
            this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix); // Hide the edges that have not been selected
            */
        }

        this.removeProcessingNotification();
    }

    showProcessingNotification() {
        //console.log("function: cursorWait()");
        //$('body').css({ cursor: 'wait' });

        document.body.appendChild(this.jDivProcessingNotification);
        $('#div-processing-notification').empty(); // empty this.rightClickLabel

        this.jDivProcessingNotification.style.position = 'absolute';
        this.jDivProcessingNotification.style.left = '50%';
        this.jDivProcessingNotification.style.top = '50%';
        this.jDivProcessingNotification.style.padding = '5px';
        this.jDivProcessingNotification.style.borderRadius = '2px';
        this.jDivProcessingNotification.style.zIndex = '1';
        this.jDivProcessingNotification.style.backgroundColor = '#feeebd'; // the color of the control panel

        var text = document.createElement('div');
        text.innerHTML = "Processing...";
        this.jDivProcessingNotification.appendChild(text);
    }

    removeProcessingNotification() {
        if ($('#div-processing-notification').length > 0)
            document.body.removeChild(this.jDivProcessingNotification);
    }

    autoRotationOnChange(s: string) {
        this.autoRotation = !this.autoRotation;

        this.mouse.dx = 0;
        this.mouse.dy = 0;

        // set default rotation
        if (this.autoRotation == true) {
            $('#anti-auto-rotation-' + this.id).css('opacity', 1);
            if (s == "anticlockwise") {
                this.mouse.dx = 1;
                this.mouse.dy = 0;
            }
        }
        else {
            $('#anti-auto-rotation-' + this.id).css('opacity', 0.2);
        }
    }

    allLabelsOnChange() {
        if ((!this.physioGraph) || (!this.colaGraph)) return;

        this.allLables = !this.allLables;

        this.physioGraph.allLabels = this.allLables;
        this.colaGraph.allLabels = this.allLables;

        if (this.allLables == true) {
            $('#all-labels-' + this.id).css('opacity', 1);
            this.physioGraph.showAllLabels(false);
            this.colaGraph.showAllLabels(this.svgMode);
        }
        else {
            $('#all-labels-' + this.id).css('opacity', 0.2);
            this.physioGraph.hideAllLabels();
            this.colaGraph.hideAllLabels();
        }

        this.svgNeedsUpdate = true;
    }

    showNetwork(switchNetworkType: boolean) {
        if (!this.brainObject || !this.colaObject || !this.physioGraph || !this.colaGraph) return;

        if (this.bundlingEdges) this.edgesBundlingOnChange(); // turn off edge bundling

        if (!this.transitionInProgress) {
            // Leave *showingCola* on permanently after first turn-on
            //this.showingCola = true;

            var edges = [];
            this.colaGraph.filteredNodeIDs = this.physioGraph.filteredNodeIDs;
            this.colaGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, edges);
            this.colaGraph.setNodeVisibilities(); // Hide the nodes without neighbours
            this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix); // Hide the edges that have not been selected

            //-------------------------------------------------------------------------------------------------------------
            // 3d cola graph

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

            // clear svg graphs
            if (this.svgMode) {
                var node = this.svgAllElements.selectAll(".node").data(new Array());
                var link = this.svgAllElements.selectAll(".link").data(new Array());
                var nodeLable = this.svgAllElements.selectAll(".nodeLabel").data(new Array());

                var nodeBundle = this.svgAllElements.selectAll(".nodeCircular").data(new Array());
                var linkBundle = this.svgAllElements.selectAll(".linkCircular").data(new Array());
                var rect1Bundle = this.svgAllElements.selectAll(".rect1Circular").data(new Array());
                var rect2Bundle = this.svgAllElements.selectAll(".rect2Circular").data(new Array());

                node.exit().remove();
                link.exit().remove();
                nodeLable.exit().remove();

                nodeBundle.exit().remove();
                linkBundle.exit().remove();
                rect1Bundle.exit().remove();
                rect2Bundle.exit().remove();

                this.cola2D = null;
                this.cola2D = colans.d3adaptor()
                    .size([this.jDiv.width(), this.jDiv.height() - sliderSpace]);

                this.svgMode = false;
            }

            //-------------------------------------------------------------------------------------------------------------
            // animation
            if (this.networkType == 'flatten-to-2d') {
                if (!switchNetworkType) {
                    // Set up a coroutine to do the animation
                    var origin = new THREE.Vector3(this.brainObject.position.x, this.brainObject.position.y, this.brainObject.position.z);
                    var target = new THREE.Vector3(this.brainObject.position.x + 2 * this.graphOffset, this.brainObject.position.y, this.brainObject.position.z);

                    this.colaObjectAnimation(origin, target, originColaCoords, this.colaCoords, switchNetworkType, false);
                }

                this.threeToSVGAnimation(true);
            }
            else if (this.networkType == 'circular-layout') {
                this.svgMode = true;
                this.svgNeedsUpdate = true;
                this.colaGraph.setVisible(false);
                if ($('#select-circular-layout-attribute-one-' + this.id).length <= 0) return;
                if ($('#select-circular-layout-attribute-two-' + this.id).length <= 0) return;
                if ($('#select-circular-layout-bundle-' + this.id).length <= 0) return;
                if ($('#select-circular-layout-sort-' + this.id).length <= 0) return;

                var attrOne = $('#select-circular-layout-attribute-one-' + this.id).val();
                var attrTwo = $('#select-circular-layout-attribute-two-' + this.id).val();
                var attrBundle = $('#select-circular-layout-bundle-' + this.id).val();
                var attrSort = $('#select-circular-layout-sort-' + this.id).val();

                this.initCircularLayout(attrBundle, attrSort);
                this.circularLayoutAttributeOneOnChange(attrOne);
                this.circularLayoutAttributeTwoOnChange(attrTwo);
                this.setCircularBarColor(1, this.circularBar1Color);
                this.setCircularBarColor(2, this.circularBar2Color);
            }
            else {
                // Set up a coroutine to do the animation
                var origin = new THREE.Vector3(this.brainObject.position.x, this.brainObject.position.y, this.brainObject.position.z);
                var target = new THREE.Vector3(this.brainObject.position.x + 2 * this.graphOffset, this.brainObject.position.y, this.brainObject.position.z);

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
        this.colaGraph.setVisible(true);
        this.transitionInProgress = true;

        $('#button-show-network-' + this.id).prop('disabled', true);
        $('#select-network-type-' + this.id).prop('disabled', true);
        $('#graph-view-slider-' + this.id).prop('disabled', true); 

        setCoroutine({ currentTime: 0, endTime: this.modeLerpLength }, (o, deltaTime) => {
            if (o.currentTime == 0) this.initSVGGraph();

            o.currentTime += deltaTime;

            if (o.currentTime >= o.endTime) { // The animation has finished
                this.colaGraph.setVisible(false);

                var node = this.svgAllElements.selectAll(".node")
                    .style("stroke-opacity", 1)
                    .style("opacity", 1);

                var link = this.svgAllElements.selectAll(".link")
                    .style("stroke-opacity", 1);

                this.svgMode = true;
                this.svgNeedsUpdate = true;

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

                var node = this.svgAllElements.selectAll(".node")
                    .style("stroke-opacity", percentDone)
                    .style("opacity", percentDone);

                var link = this.svgAllElements.selectAll(".link")
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

    colaObjectRotation(colaObjectOrigin, colaObjectTarget, rotationOrigin, rotationTarget, nodeCoordOrigin: number[][], nodeCoordTarget: number[][], switchNetworkType: boolean, transitionFinish: boolean) {
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
                this.colaGraph.setNodePositions(nodeCoordTarget);
                //this.colaObject.rotation = rotationTarget;
                //this.colaObject.rotation.set(rotationTarget[0], rotationTarget[1], rotationTarget[2]);

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

                var rotation = rotationOrigin.clone().add(rotationTarget.clone().sub(rotationOrigin).multiplyScalar(percentDone));
                this.colaObject.rotation.set(rotation.x, rotation.y, rotation.z);

                if (switchNetworkType == false) {
                    this.colaObject.position = colaObjectOrigin.clone().add(colaObjectTarget.clone().sub(colaObjectOrigin).multiplyScalar(percentDone));
                }

                return false;
            }
        });
    }

    svgZoom() {
        if (this.svgControlMode) {
            this.svgAllElements.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
            if (this.networkType == "flatten-to-2d") this.svgNeedsUpdate = true;
        }
    }

    initCircularLayout(bundleByAttribute: string, sortByAttribute: string) {
        this.svgNodeBundleArray = [];
        var children = this.colaGraph.rootObject.children;
        for (var i = 0; i < children.length; i++) {
            var obj = children[i];
            if ((<any>obj).isNode) {
                var nodeObject = new Object();
                nodeObject["id"] = obj.id;
                for (var j = 0; j < this.dataSet.attributes.columnNames.length; j++) {
                    var colname = this.dataSet.attributes.columnNames[j];

                    if (colname == 'module_id') {
                        nodeObject['moduleID'] = this.dataSet.attributes.get(colname)[obj.id]; // add a special property for module id
                    }

                    var value = this.dataSet.attributes.get(colname)[obj.id];
                    nodeObject[colname] = value;

                    var columnIndex = this.dataSet.attributes.columnNames.indexOf(colname);

                    // assume all positive numbers in the array
                    var min = this.dataSet.attributes.getMin(columnIndex);
                    var max = this.dataSet.attributes.getMax(columnIndex);

                    var attrMap = d3.scale.linear().domain([min, max]).range([0.01, 1]);
                    var scalevalue = attrMap(value);
                    nodeObject['scale_' + colname] = scalevalue;

                    var bundleGroupMap = d3.scale.linear().domain([min, max]).range([0, 9.99]); // use 9.99 instead of 10 to avoid a group of a single element (that has the max attribute value)
                    var bundleGroup = bundleGroupMap(value);
                    bundleGroup = Math.floor(bundleGroup);
                    nodeObject['bundle_group_' + colname] = bundleGroup;
                }

                if (bundleByAttribute == "none") {
                    nodeObject["name"] = "root.module" + nodeObject['moduleID'] + "." + obj.id;
                }
                else {
                    nodeObject["name"] = "root." + bundleByAttribute + nodeObject['bundle_group_' + bundleByAttribute] + "." + obj.id;
                }

                nodeObject["imports"] = [];
                nodeObject["color"] = this.colaGraph.nodeMeshes[obj.id].material.color.getHexString();
                this.svgNodeBundleArray.push(nodeObject);
            }
        }

        for (var i = 0; i < this.colaGraph.edgeList.length; i++) {
            var edge = this.colaGraph.edgeList[i];
            if (edge.visible) {
                for (var j = 0; j < this.svgNodeBundleArray.length; j++) {
                    if (this.svgNodeBundleArray[j].id == edge.sourceNode.id) {
                        var moduleID = -1;
                        var bundleGroupID = -1;
                        for (var k = 0; k < this.svgNodeBundleArray.length; k++) {
                            if (this.svgNodeBundleArray[k].id == edge.targetNode.id) {
                                if (bundleByAttribute == "none") {
                                    moduleID = this.svgNodeBundleArray[k].moduleID;
                                }
                                else {
                                    bundleGroupID = this.svgNodeBundleArray[k]['bundle_group_' + bundleByAttribute];
                                }
                                break;
                            }
                        }

                        if (bundleByAttribute == "none") {
                            if (moduleID >= 0) {
                                var nodeName = "root.module" + moduleID + "." + edge.targetNode.id;
                                this.svgNodeBundleArray[j].imports.push(nodeName);
                            }
                        }
                        else {
                            if (bundleGroupID >= 0) {
                                var nodeName = "root." + bundleByAttribute + bundleGroupID + "." + edge.targetNode.id;
                                this.svgNodeBundleArray[j].imports.push(nodeName);
                            }
                        }
                    }

                    if (this.svgNodeBundleArray[j].id == edge.targetNode.id) {
                        var moduleID = -1;
                        for (var k = 0; k < this.svgNodeBundleArray.length; k++) {
                            if (this.svgNodeBundleArray[k].id == edge.sourceNode.id) {
                                //moduleID = this.svgNodeBundleArray[k].moduleID;
                                if (bundleByAttribute == "none") {
                                    moduleID = this.svgNodeBundleArray[k].moduleID;
                                }
                                else {
                                    bundleGroupID = this.svgNodeBundleArray[k]['bundle_group_' + bundleByAttribute];
                                }
                                break;
                            }
                        }

                        if (bundleByAttribute == "none") {
                            if (moduleID >= 0) {
                                var nodeName = "root.module" + moduleID + "." + edge.sourceNode.id;
                                this.svgNodeBundleArray[j].imports.push(nodeName);
                            }
                        }
                        else {
                            if (bundleGroupID >= 0) {
                                var nodeName = "root." + bundleByAttribute + bundleGroupID + "." + edge.sourceNode.id;
                                this.svgNodeBundleArray[j].imports.push(nodeName);
                            }
                        }
                    }
                }
            }
        }

        var nodeJson = JSON.parse(JSON.stringify(this.svgNodeBundleArray));

        var width = 250 + this.jDiv.width() / 2;
        var height = (this.jDiv.height() - sliderSpace) / 2;

        var diameter = 800,
            radius = diameter / 2,
            innerRadius = radius - 120;

        var cluster;
        if (sortByAttribute == "none") {
            cluster = d3.layout.cluster()
                .size([360, innerRadius])
                .sort(null)
                .value(function (d) { return d.size; });
        }
        else {
            cluster = d3.layout.cluster()
                .size([360, innerRadius])
                .sort(function (a, b) { return d3.ascending(a[sortByAttribute], b[sortByAttribute]); })
                .value(function (d) { return d.size; });
        }

        var bundle = d3.layout.bundle();

        var line = d3.svg.line.radial()
            .interpolate("bundle")
            .tension(.85)
            .radius(function (d) { return d.y; })
            .angle(function (d) { return d.x / 180 * Math.PI; });

        this.svgAllElements.attr("transform", "translate(" + width + "," + height + ")");

        this.d3Zoom.scale(1);
        this.d3Zoom.translate([width, height]);

        var nodes = cluster.nodes(packages.root(nodeJson)),
            links = packages.imports(nodes);

        this.svgAllElements.selectAll(".linkCircular")
            .data(bundle(links))
            .enter().append("path")
            .each(function (d) { d.source = d[0], d.target = d[d.length - 1]; })
            .attr("class", "linkCircular")
            .attr("d", line);

        var varMouseOveredSetNodeID = (id) => { this.mouseOveredSetNodeID(id); }
        var varMouseOutedSetNodeID = () => { this.mouseOutedSetNodeID(); }

        var varMouseOveredCircularLayout = (d) => { this.mouseOveredCircularLayout(d); }
        var varMouseOutedCircularLayout = (d) => { this.mouseOutedCircularLayout(d); }
        
        this.svgAllElements.selectAll(".nodeCircular")
            .data(nodes.filter(function (n) { return !n.children; }))
            .enter().append("text")
            .attr("class", "nodeCircular")
            .attr("dy", ".31em")
            .attr("transform", function (d) { return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 8) + ",0)" + (d.x < 180 ? "" : "rotate(180)"); })
            .style("text-anchor", function (d) { return d.x < 180 ? "start" : "end"; })
            .text(function (d) { return d.key; })
            .on("mouseover", function (d) { varMouseOveredCircularLayout(d); varMouseOveredSetNodeID(d.id); })
            .on("mouseout", function (d) { varMouseOutedCircularLayout(d); varMouseOutedSetNodeID(); });      

        this.svgAllElements.selectAll(".rect1Circular")
            .data(nodes.filter(function (n) { return !n.children; }))
            .enter().append("rect")
            .attr("class", "rect1Circular")
            .attr("transform", function (d) { return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 28) + ",-4)" + (d.x < 180 ? "" : ""); });
            //.attr("width", function (d) { return 40 * d.scale_strength; })
            //.attr("height", 4);

        this.svgAllElements.selectAll(".rect2Circular")
            .data(nodes.filter(function (n) { return !n.children; }))
            .enter().append("rect")
            .attr("class", "rect2Circular")
            .attr("transform", function (d) { return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 28) + ",0)" + (d.x < 180 ? "" : ""); });
            //.attr("width", function (d) { return 40 * d.scale_clustering; })
            //.attr("height", 4);

        d3.select(window.frameElement).style("height", diameter + "px");
    }

    mouseOveredSetNodeID(id) {
        this.commonData.nodeIDUnderPointer[4] = id;
    }

    mouseOutedSetNodeID() {
        this.commonData.nodeIDUnderPointer[4] = -1;
    }

    mouseOveredCircularLayout(d) {
        //this.commonData.nodeIDUnderPointer[4] = d.id;
        this.svgAllElements.selectAll(".nodeCircular")
            .each(function (n) { n.target = n.source = false; });
        
        this.svgAllElements.selectAll(".linkCircular")
            .style("stroke-width", function (l) {
                if (l.target === d) { l.target.source = true; l.source.target = true; }
                if (l.source === d) { l.source.source = true; l.target.target = true; }
                if ((l.target === d) || (l.source === d)) {
                    return "3px";
                }
                else {
                    return "1px";
                }
            })
            .style("stroke", function (l) {
                if ((l.target === d) || (l.source === d)) {
                    return "#d62728";
                }
                else {
                    return l.color;
                }
            });

        this.svgAllElements.selectAll(".nodeCircular")
            .style("font-weight", function (n) {
                if ((n.target || n.source)) {
                    return "bolder";
                }
                else {
                    return "normal";
                }
            })
            .style("font-size", function (n) {
                if (n.source) {
                    return "17px";
                }
                else if (n.target) {
                    return "13px";
                }
                else {
                    return "11px";
                }
            });
    }

    mouseOutedCircularLayout(d) {
        //this.commonData.nodeIDUnderPointer[4] = -1;

        this.svgAllElements.selectAll(".linkCircular")
            .style("stroke-width", "1px")
            .style("stroke", function (l) { return l.color; });
        this.svgAllElements.selectAll(".nodeCircular")
            .style("font-weight", "normal")
            .style("font-size", "11px");
    }

    updateSVGGraph() {
        if (this.networkType == 'flatten-to-2d') {
            if (!this.svgGraph) return;

            var unitRadius = 5;

            for (var i = 0; i < this.svgGraph.nodes.length; i++) {
                var id = this.svgGraph.nodes[i].id;
                this.svgGraph.nodes[i].color = this.colaGraph.nodeMeshes[id].material.color.getHexString();
                this.svgGraph.nodes[i].radius = this.colaGraph.nodeMeshes[id].scale.x * unitRadius;
            }

            for (var i = 0; i < this.svgGraph.links.length; i++) {
                var index = this.svgGraph.links[i].colaGraphEdgeListIndex;
                var edge = this.colaGraph.edgeList[index];
                this.svgGraph.links[i].color = edge.shape.material.color.getHexString();
                this.svgGraph.links[i].width = edge.shape.scale.x;
            }

            var nodeJson = JSON.parse(JSON.stringify(this.svgGraph.nodes));
            var linkJson = JSON.parse(JSON.stringify(this.svgGraph.links));

            var link = this.svgAllElements.selectAll(".link")
                .data(linkJson)
                .style("stroke-width", function (d) { return d.width; })
                .style("stroke", function (d) { return d.color; });

            var node = this.svgAllElements.selectAll(".node")
                .data(nodeJson)
                .attr("r", function (d) { return d.radius; })
                .style("fill", function (d) { return d.color; });

            // node labels
            if (this.physioGraph.allLabels) {
                this.svgAllElements.selectAll(".nodeLabel")
                    .style("visibility", "visible");
            }
            else {
                this.svgAllElements.selectAll(".nodeLabel")
                    .style("visibility", "hidden");
            }

            var svgLabelArray = [];
            var colaNodeData = this.svgAllElements.selectAll(".node").data();
            for (var i = 0; i < colaNodeData.length; i++) {
                var labelObject = new Object();
                labelObject["x"] = colaNodeData[i].x;
                labelObject["y"] = colaNodeData[i].y;
                labelObject["id"] = colaNodeData[i].id;
                labelObject["node_radius"] = colaNodeData[i].radius;
                svgLabelArray.push(labelObject);
            }

            var labelJson = JSON.parse(JSON.stringify(svgLabelArray));

            var scale = this.d3Zoom.scale();
            var defaultFontSize = 10;
            var fontSize = defaultFontSize;
            if (scale >= 1) {
                fontSize = Math.ceil(defaultFontSize / scale);
            }

            var nodeLable = this.svgAllElements.selectAll(".nodeLabel")
                .data(labelJson)
                .style("font-size", fontSize + 'px');

            nodeLable.each(function (d) {
                var box = this.getBBox();
                var width = box.width;
                var height = box.height;

                if ((box.width <= d.node_radius * 2) && (box.height <= d.node_radius * 2)) {
                    d.x -= box.width / 2;
                    d.y += (box.height / 2 - 1);
                }
                else {
                    d.x += 3.5;
                    d.y -= 3.5;
                }
            });

            nodeLable
                .attr("x", function (d) { return d.x; })
                .attr("y", function (d) { return d.y; });
        }
        else if (this.networkType == 'circular-layout') {           
            if (!this.svgNodeBundleArray) return;

            for (var i = 0; i < this.svgNodeBundleArray.length; i++) {
                var id = this.svgNodeBundleArray[i].id;
                this.svgNodeBundleArray[i].color = this.colaGraph.nodeMeshes[id].material.color.getHexString();
            }

            var nodeBundle = this.svgAllElements.selectAll(".nodeCircular");

            var varSvgNodeBundleArray = this.svgNodeBundleArray;
            nodeBundle.each(function (d) {
                for (var i = 0; i < varSvgNodeBundleArray.length; i++) {
                    if (d.id == varSvgNodeBundleArray[i].id) {
                        d.color = varSvgNodeBundleArray[i].color;
                        break;
                    }
                }
            });

            nodeBundle
                .style("fill", function (d) { return d.color; });

            var linkBundle = this.svgAllElements.selectAll(".linkCircular");

            var varEdgeList = this.colaGraph.edgeList;
            linkBundle.each(function (l) {
                for (var i = 0; i < varEdgeList.length; i++) {
                    var edge = varEdgeList[i];
                    if (((l.source.id == edge.sourceNode.id) && (l.target.id == edge.targetNode.id)) ||
                        ((l.source.id == edge.targetNode.id) && (l.target.id == edge.sourceNode.id))) {
                        l.color = edge.shape.material.color.getHexString();
                        break;
                    }
                }
            });

            linkBundle
                .style("stroke", function (l) { return l.color; });
        }
    }

    initSVGGraph() {
        var width = this.jDiv.width();
        var height = this.jDiv.height() - sliderSpace;
        var widthHalf = width / 2;
        var heightHalf = height / 2;

        var projector = new THREE.Projector();
        var screenCoords = new THREE.Vector3();

        var unitRadius = 5;

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

                this.svgGraph.nodes.push(nodeObject);
            }
        }

        for (var i = 0; i < this.colaGraph.edgeList.length; i++) {
            var edge = this.colaGraph.edgeList[i];
            if (edge.visible) {
                var linkObject = new Object();
                linkObject["colaGraphEdgeListIndex"] = i;
                linkObject["color"] = edge.shape.material.color.getHexString();
                linkObject["width"] = edge.shape.scale.x;

                for (var j = 0; j < this.svgGraph.nodes.length; j++) {
                    if (this.svgGraph.nodes[j].id == edge.sourceNode.id) {
                        linkObject["source"] = j;
                        linkObject["x1"] = this.svgGraph.nodes[j].x;
                        linkObject["y1"] = this.svgGraph.nodes[j].y;
                    }

                    if (this.svgGraph.nodes[j].id == edge.targetNode.id) {
                        linkObject["target"] = j;
                        linkObject["x2"] = this.svgGraph.nodes[j].x;
                        linkObject["y2"] = this.svgGraph.nodes[j].y;
                    }
                }

                this.svgGraph.links.push(linkObject);
            }
        }

        var nodeJson = JSON.parse(JSON.stringify(this.svgGraph.nodes));
        var linkJson = JSON.parse(JSON.stringify(this.svgGraph.links));

        var link = this.svgAllElements.selectAll(".link")
            .data(linkJson)
            .enter().append("line")
            .attr("class", "link")
            .attr("x1", function (d) { return d.x1; })
            .attr("y1", function (d) { return d.y1; })
            .attr("x2", function (d) { return d.x2; })
            .attr("y2", function (d) { return d.y2; })
            .style("stroke-width", function (d) { return d.width; })
            .style("stroke", function (d) { return d.color; });

        var varMouseOveredSetNodeID = (id) => { this.mouseOveredSetNodeID(id); }
        var varMouseOutedSetNodeID = () => { this.mouseOutedSetNodeID(); }

        var node = this.svgAllElements.selectAll(".node")
            .data(nodeJson)
            .enter().append("circle")
            .attr("class", "node")
            .attr("r", function (d) { return d.radius; })
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
            .style("fill", function (d) { return d.color; })
            .on("mouseover", function (d) { varMouseOveredSetNodeID(d.id); })
            .on("mouseout", function () { varMouseOutedSetNodeID(); });
        //.call(this.cola2D.drag);

        node.append("title")
            .text(function (d) { return d.id; });

        node.each(d=> d.width = d.height = d.radius * 2);

        //this.svgAllElements.attr("transform", "translate(0,0)scale(1)");
        this.svgAllElements.attr("transform", "translate(0,0)");
        this.d3Zoom.scale(1);
        this.d3Zoom.translate([0, 0]);
               
        this.cola2D
            .handleDisconnected(true)
            .avoidOverlaps(true)
            .nodes(nodeJson)
            .links(linkJson)
            .start(30, 20, 20);

        var offsetx = 250;
        var offsety = 0;
        node.each(d=> {
            d.x += offsetx;
            d.y += offsety;
        });

        /*
        var ctr = 0;
        var endTransition = (transition) => {
            transition
                .each(() => ++ctr)
                .each("end", () => {
                    if (!--ctr) {
                        this.cola2D.on("tick", function () {
                            link.attr("x1", function (d) { return d.source.x; })
                                .attr("y1", function (d) { return d.source.y; })
                                .attr("x2", function (d) { return d.target.x; })
                                .attr("y2", function (d) { return d.target.y; })
                                .style("stroke-width", function (d) { return d.width; })
                                .style("stroke", function (d) { return d.color; });
                            node.attr("cx", function (d) { return d.x; })
                                .attr("cy", function (d) { return d.y; })
                                .attr("r", function (d) { return d.radius; })
                                .style("fill", function (d) { return d.color; });
                        });                        
                    }
                });
        };
        */

        link.transition().duration(1000)
            .attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });
            //.call(endTransition);
        node.transition().duration(1000)
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; });
        //.call(endTransition);     

        // update the this.svgNodeArray
        var colaNodeData = this.svgAllElements.selectAll(".node").data();
        for (var i = 0; i < colaNodeData.length; i++) {
            this.svgGraph.nodes[i].x = colaNodeData[i].x;
            this.svgGraph.nodes[i].y = colaNodeData[i].y;
        }

        // node label
        var svgLabelArray = [];
        var colaNodeData = this.svgAllElements.selectAll(".node").data();
        for (var i = 0; i < colaNodeData.length; i++) {
            var labelObject = new Object();
            labelObject["x"] = colaNodeData[i].x;
            labelObject["y"] = colaNodeData[i].y;
            labelObject["id"] = colaNodeData[i].id;
            labelObject["node_radius"] = colaNodeData[i].radius;
            svgLabelArray.push(labelObject);
        }

        var labelJson = JSON.parse(JSON.stringify(svgLabelArray));

        var nodeLable = this.svgAllElements.selectAll(".nodeLabel")
            .data(labelJson)
            .enter().append("text")
            .attr("class", "nodeLabel")
            .attr("x", function (d) { return d.x + 3.5; })
            .attr("y", function (d) { return d.y - 3.5; })
            .text(function (d) { return d.id; })
            .style("visibility", "hidden");
    }
    
    isDeleted() {
        return this.deleted;
    }

    applyFilter(filteredIDs: number[]) {
        if (!this.dataSet || !this.dataSet.attributes) return;

        if (this.bundlingEdges) this.edgesBundlingOnChange(); // turn off edge bundling

        //console.log("app id: " + this.id + "; count: " + filteredIDs.length);   

        this.physioGraph.filteredNodeIDs = filteredIDs;
        this.physioGraph.applyNodeFiltering();
        this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
    }

    highlightSelectedNodes(filteredIDs: number[]) {
        if (!this.dataSet || !this.dataSet.attributes) return;

        //console.log("app id: " + this.id + "; count: " + filteredIDs.length);

        this.physioGraph.highlightSelectedNodes(filteredIDs);
        this.colaGraph.highlightSelectedNodes(filteredIDs);

        this.svgNeedsUpdate = true;
    }

    setNodeDefaultSizeColor() {
        // set default node color and scale
        this.physioGraph.setDefaultNodeColor();
        this.colaGraph.setDefaultNodeColor();

        this.physioGraph.setDefaultNodeScale();
        this.colaGraph.setDefaultNodeScale();

        this.svgNeedsUpdate = true;
    }

    setNodeSize(scaleArray: number[]) {
        this.physioGraph.setNodesScale(scaleArray);
        this.colaGraph.setNodesScale(scaleArray);

        this.svgNeedsUpdate = true;
    }

    setANodeColor(nodeID: number, color: string) {
        var value = parseInt(color.replace("#", "0x"));

        this.physioGraph.setNodeColor(nodeID, value);
        this.colaGraph.setNodeColor(nodeID, value);

        this.svgNeedsUpdate = true;
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

        this.svgNeedsUpdate = true;
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

        this.svgNeedsUpdate = true;
    }

    resize(width: number, height: number) {
        // Resize the renderer
        this.renderer.setSize(width, height - sliderSpace);
        this.currentViewWidth = width;

        if (this.cola2D) this.cola2D.size([width, height - sliderSpace]);

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
        //if (!this.loop)
        //    this.loop = new Loop(this, 0.03);

        // Set up the two graphs
        var edgeMatrix = this.adjMatrixFromEdgeCount(maxEdgesShowable); // Don''t create more edges than we will ever be showing
        if (this.physioGraph) this.physioGraph.destroy();
        this.physioGraph = new Graph(this.brainObject, edgeMatrix, this.nodeColourings, this.dataSet.simMatrix);
        this.physioGraph.setNodePositions(this.commonData.brainCoords);

        var edgeMatrix = this.adjMatrixFromEdgeCount(maxEdgesShowable);
        if (this.colaGraph) this.colaGraph.destroy();
        this.colaGraph = new Graph(this.colaObject, edgeMatrix, this.nodeColourings, this.dataSet.simMatrix);
        this.colaGraph.setVisible(false);

        this.svgGraph = new Graph2D();

        // Initialize the filtering
        this.filteredAdjMatrix = this.adjMatrixFromEdgeCount(initialEdgesShown);
        this.physioGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.physioGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.colaGraph.findNodeConnectivity(this.filteredAdjMatrix, this.dissimilarityMatrix, null);
        this.colaGraph.setEdgeVisibilities(this.filteredAdjMatrix);
        this.edgeCountSliderOnChange(initialEdgesShown);
        
        // Enable the slider
        $('#edge-count-slider-' + this.id).prop('disabled', false);
        $('#button-show-network-' + this.id).prop('disabled', false);
        $('#select-network-type-' + this.id).prop('disabled', false);
        //$('#checkbox-edges-thickness-by-weight-' + this.id).prop('disabled', false);
        //$('#checkbox-all-labels-' + this.id).prop('disabled', false);
        //$('#checkbox-edge-color-' + this.id).prop('disabled', false);
        //$('#checkbox-auto-rotation-' + this.id).prop('disabled', false);
        //$('#checkbox-svg-control-' + this.id).prop('disabled', false);
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
                this.commonData.nodeIDUnderPointer[this.id] = intersected[i].object.id;
                return intersected[i].object;
            }       
        }

        this.commonData.nodeIDUnderPointer[this.id] = -1;
        return null;
    }

    getBoundingSphereUnderPointer(pointer) {
        var pointerNDC = new THREE.Vector3(pointer.x, pointer.y, 1);
        this.projector.unprojectVector(pointerNDC, this.camera);
        var directionVector = pointerNDC.sub(this.camera.position);
        directionVector.normalize();

        var raycaster = new THREE.Raycaster(this.camera.position, directionVector, this.nearClip, this.farClip);
        var intersected = raycaster.intersectObjects(this.scene.children, true);

        var inBoundingSphere = false;
        for (var i = 0; i < intersected.length; ++i) {
            if ((<any>intersected[i].object).isBoundingSphere) { // Node objects have this special boolean flag
                inBoundingSphere = true;
                break;
            }
        }

        if ((this.networkType == 'flatten-to-2d') || (this.networkType == 'circular-layout')){
            if (inBoundingSphere == true) {
                this.svgControlMode = false;
                this.svg.on(".zoom", null);
            }
            else {
                this.svgControlMode = true;
                var varSVGZoom = () => { this.svgZoom(); }
                this.svg.call(this.d3Zoom.on("zoom", varSVGZoom));
            }
        }
        else {
            this.svgControlMode = false;
            this.svg.on(".zoom", null);
        }
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

        if ((this.physioGraph) && (this.colaGraph)) {
            // execute animation sequently
            if (coroutines.length > 0) {
                if (coroutines[0].func(coroutines[0], deltaTime))
                    coroutines.splice(0, 1);
            }

            var node = this.getNodeUnderPointer(this.input.localPointerPosition());
            this.getBoundingSphereUnderPointer(this.input.localPointerPosition());

            var nodeIDUnderPointer = -1;
            for (var i = 0; i < this.commonData.nodeIDUnderPointer.length; i++) {
                if (this.commonData.nodeIDUnderPointer[i] != -1) {
                    nodeIDUnderPointer = this.commonData.nodeIDUnderPointer[i];
                    break;
                }
            }

            if (node || (nodeIDUnderPointer != -1)) {
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
                    this.selectedNodeID = nodeIDUnderPointer;
                }

                // Select the new node ID
                this.physioGraph.selectNode(this.selectedNodeID, false);
                this.colaGraph.selectNode(this.selectedNodeID, this.svgMode);

                this.physioGraph.selectAdjEdges(this.selectedNodeID);
                this.colaGraph.selectAdjEdges(this.selectedNodeID);

                var varNodeID = this.selectedNodeID;
                if (this.networkType == "circular-layout") {
                    var varMouseOveredCircularLayout = (d) => { this.mouseOveredCircularLayout(d); }
                this.svgAllElements.selectAll(".nodeCircular")
                        .each(function (d) {
                            if (varNodeID == d.id) varMouseOveredCircularLayout(d);
                        });
                }
                else if (this.networkType == "flatten-to-2d") {
                    this.svgNeedsUpdate = true;
                }
            }
            else {
                if (this.selectedNodeID >= 0) {
                    this.physioGraph.deselectNode(this.selectedNodeID);
                    this.colaGraph.deselectNode(this.selectedNodeID);

                    this.physioGraph.deselectAdjEdges(this.selectedNodeID);
                    this.colaGraph.deselectAdjEdges(this.selectedNodeID);

                    var varNodeID = this.selectedNodeID;
                    if (this.networkType == "circular-layout") {
                        var varMouseOutedCircularLayout = (d) => { this.mouseOutedCircularLayout(d); };
                        this.svgAllElements.selectAll(".nodeCircular")
                            .each(function (d) {
                                if (varNodeID == d.id) varMouseOutedCircularLayout(d);
                            });
                    }
                    else if (this.networkType == "flatten-to-2d") {
                        this.svgNeedsUpdate = true;
                    }

                    this.selectedNodeID = -1;
                }
            }

            //if (this.showingCola)
            if (this.colaGraph.isVisible()) 
                this.descent.rungeKutta(); // Do an iteration of the solver

            this.physioGraph.update();
            this.colaGraph.update(); // Update all the edge positions
            if (this.svgMode && this.svgNeedsUpdate) {
                this.updateSVGGraph();
                this.svgNeedsUpdate = false;
            }
        }

        if (this.autoRotation) {
            //this.brainObject.rotation.set(this.brainObject.rotation.x + this.mouse.dy / 100, this.brainObject.rotation.y + this.mouse.dx / 100, this.brainObject.rotation.z);
            //this.colaObject.rotation.set(this.colaObject.rotation.x + this.mouse.dy / 100, this.colaObject.rotation.y + this.mouse.dx / 100, this.colaObject.rotation.z);

            var pixelAngleRatio = 50;

            var quatX = new THREE.Quaternion();
            var axisX = new THREE.Vector3(0, 1, 0);
            quatX.setFromAxisAngle(axisX, this.mouse.dx / pixelAngleRatio); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quatX, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quatX, this.colaObject.quaternion);

            var quatY = new THREE.Quaternion();
            var axisY = new THREE.Vector3(1, 0, 0);
            quatY.setFromAxisAngle(axisY, this.mouse.dy / pixelAngleRatio); // axis must be normalized, angle in radians
            this.brainObject.quaternion.multiplyQuaternions(quatY, this.brainObject.quaternion);
            this.colaObject.quaternion.multiplyQuaternions(quatY, this.colaObject.quaternion);
        }

        this.draw(); // Draw the graph
    }

    draw() {
        this.renderer.render(this.scene, this.camera);
    }
}

// power graph
class PowerGraph {
    nodes: any[];
    links: any[];
    powerGroups: any[];
    powerEdges: any[];
    targetGraph;

    constructor(graph) {
        this.targetGraph = graph;
        this.powerGroups = [];
        this.powerEdges = [];
    }

    initPowerGraph(dimension, divWidth, divHeight) {
        var mode = "hierarchy";
        //var mode = "flat";

        var powerGraphNodeArray = [];
        var powerGraphLinkArray = [];

        var children = this.targetGraph.rootObject.children;
        for (var i = 0; i < children.length; i++) {
            var obj = children[i];
            if ((<any>obj).isNode) {
                if (this.targetGraph.nodeHasNeighbors[obj.id]) {
                    var nodeObject = new Object();
                    nodeObject["id"] = obj.id;
                    powerGraphNodeArray.push(nodeObject);
                }
            }
        }

        for (var i = 0; i < this.targetGraph.edgeList.length; i++) {
            var edge = this.targetGraph.edgeList[i];
            if (edge.visible) {
                var linkObject1 = new Object();
                var linkObject2 = new Object();

                for (var j = 0; j < powerGraphNodeArray.length; j++) {
                    if (powerGraphNodeArray[j].id == edge.sourceNode.id) {
                        linkObject1["source"] = j;
                        linkObject2["target"] = j;
                    }

                    if (powerGraphNodeArray[j].id == edge.targetNode.id) {
                        linkObject1["target"] = j;
                        linkObject2["source"] = j;
                    }
                }

                powerGraphLinkArray.push(linkObject1);
                powerGraphLinkArray.push(linkObject2);
            }
        }

        var nodeJson = JSON.parse(JSON.stringify(powerGraphNodeArray));
        var linkJson = JSON.parse(JSON.stringify(powerGraphLinkArray));

        var d3cola = colans.d3adaptor()
            .linkDistance(80)
            .handleDisconnected(true)
            .avoidOverlaps(true)
            .size([divWidth, divHeight]);

        var powerGraph;
                
        d3cola
            .nodes(nodeJson)
            .links(linkJson)
            .powerGraphGroups(d => (powerGraph = d).groups.forEach(v => v.padding = 20));

        console.log(powerGraph.groups);
        console.log(powerGraph.powerEdges);
        
        this.targetGraph.removeAllEdges();
        
        for (var i = 0; i < powerGraph.powerEdges.length; i++) {
            if (mode == "hierarchy") {
                var coordinates = [];
                if (dimension == "3d") {
                    for (var j = 0; j < this.targetGraph.nodeMeshes.length; ++j) {
                        var coord = new Object();
                        coord["id"] = j;
                        coord["x"] = this.targetGraph.nodeMeshes[j].position.x;
                        coord["y"] = this.targetGraph.nodeMeshes[j].position.y;
                        coord["z"] = this.targetGraph.nodeMeshes[j].position.z;
                        coordinates.push(coord);
                    }
                }
                else if (dimension == "2d") {

                }

                var edgeList = this.powerEdgeToTree(powerGraph.powerEdges[i], coordinates);

                //console.log("hierarchy edge list:");
                //console.log(edgeList);

                for (var j = 0; j < edgeList.length; j++) {
                    var thisEdge = edgeList[j];
                    if (thisEdge.length == 2) {
                        if (dimension == "3d") {
                            var geometry = new THREE.Geometry();
                            geometry.vertices.push(thisEdge[0]);
                            geometry.vertices.push(thisEdge[1]);

                            var material = new THREE.LineBasicMaterial({
                                color: 0x000000,
                            });

                            var line = new THREE.Line(geometry, material);
                            this.targetGraph.addBundlingEdge(line);
                        }
                        else if (dimension == "2d") {

                        }
                    }
                    else if (thisEdge.length == 4) {
                        if ((thisEdge[1].x == thisEdge[3].x) && (thisEdge[1].y == thisEdge[3].y) && (thisEdge[1].z == thisEdge[3].z)) {
                            if (dimension == "3d") {
                                var geometry = new THREE.Geometry();
                                geometry.vertices.push(thisEdge[0]);
                                geometry.vertices.push(thisEdge[3]);

                                var material = new THREE.LineBasicMaterial({
                                    color: 0x000000,
                                });

                                var line = new THREE.Line(geometry, material);
                                this.targetGraph.addBundlingEdge(line);
                            }
                            else if (dimension == "2d") {

                            }
                        }
                        else {
                            if (dimension == "3d") {
                                var spline = new THREE.CubicBezierCurve3(thisEdge[0], thisEdge[1], thisEdge[2], thisEdge[3]);

                                var geometry = new THREE.Geometry();
                                var splinePoints = spline.getPoints(20);

                                for (var w = 0; w < splinePoints.length; w++) {
                                    geometry.vertices.push(<any>splinePoints[w]);
                                }

                                var line = new THREE.Line(geometry, material);
                                this.targetGraph.addBundlingEdge(line);
                            }
                            else if (dimension == "2d") {

                            }
                        }
                    }
                }
            }
            else if (mode == "flat") {
                /*
                var source = powerGraph.powerEdges[i].source;
                var target = powerGraph.powerEdges[i].target;

                //console.log("source " + i + " leaves: ");
                var allSourceLeaves = this.getAllLeavesInATree(source);
                var allTargetLeaves = this.getAllLeavesInATree(target);

                if ((allSourceLeaves.length == 1) && (allTargetLeaves.length == 1)) {
                    var sourceID = allSourceLeaves[0].name;
                    var targetID = allTargetLeaves[0].name;

                    var sourcePoint = new THREE.Vector3(this.targetGraph.nodeMeshes[sourceID].position.x, this.targetGraph.nodeMeshes[sourceID].position.y, this.targetGraph.nodeMeshes[sourceID].position.z);
                    var targetPoint = new THREE.Vector3(this.targetGraph.nodeMeshes[targetID].position.x, this.targetGraph.nodeMeshes[targetID].position.y, this.targetGraph.nodeMeshes[targetID].position.z);

                    var geometry = new THREE.Geometry();
                    geometry.vertices.push(sourcePoint);
                    geometry.vertices.push(targetPoint);

                    var material = new THREE.LineBasicMaterial({
                        color: 0x000000,
                    });

                    var line = new THREE.Line(geometry, material);
                    this.targetGraph.addBundlingEdge(line);
                }
                else {
                    var totalX = 0;
                    var totalY = 0;
                    var totalZ = 0;

                    for (var j = 0; j < allSourceLeaves.length; j++) {
                        var nodeID = allSourceLeaves[j].name;
                        totalX += this.targetGraph.nodeMeshes[nodeID].position.x;
                        totalY += this.targetGraph.nodeMeshes[nodeID].position.y;
                        totalZ += this.targetGraph.nodeMeshes[nodeID].position.z;
                    }

                    var sourceMidPoint = new THREE.Vector3(totalX / allSourceLeaves.length, totalY / allSourceLeaves.length, totalZ / allSourceLeaves.length);

                    totalX = 0;
                    totalY = 0;
                    totalZ = 0;

                    for (var j = 0; j < allTargetLeaves.length; j++) {
                        var nodeID = allTargetLeaves[j].name;
                        totalX += this.targetGraph.nodeMeshes[nodeID].position.x;
                        totalY += this.targetGraph.nodeMeshes[nodeID].position.y;
                        totalZ += this.targetGraph.nodeMeshes[nodeID].position.z;
                    }

                    var targetMidPoint = new THREE.Vector3(totalX / allTargetLeaves.length, totalY / allTargetLeaves.length, totalZ / allTargetLeaves.length);

                    var dx = targetMidPoint.x - sourceMidPoint.x;
                    var dy = targetMidPoint.y - sourceMidPoint.y;
                    var dz = targetMidPoint.z - sourceMidPoint.z;

                    var sourceRootPoint = new THREE.Vector3(sourceMidPoint.x + dx * (1 / 3), sourceMidPoint.y + dy * (1 / 3), sourceMidPoint.z + dz * (1 / 3));
                    var targetRootPoint = new THREE.Vector3(sourceMidPoint.x + dx * (2 / 3), sourceMidPoint.y + dy * (2 / 3), sourceMidPoint.z + dz * (2 / 3));

                    //var count = allSourceLeaves.length + allTargetLeaves.length;
                    //var midPoint = new THREE.Vector3(totalX / count, totalY / count, totalZ / count);

                    for (var u = 0; u < allSourceLeaves.length; u++) {
                        for (var v = 0; v < allTargetLeaves.length; v++) {
                            var sourceID = allSourceLeaves[u].name;
                            var targetID = allTargetLeaves[v].name;

                            var sourcePoint = new THREE.Vector3(this.targetGraph.nodeMeshes[sourceID].position.x, this.targetGraph.nodeMeshes[sourceID].position.y, this.targetGraph.nodeMeshes[sourceID].position.z);
                            var targetPoint = new THREE.Vector3(this.targetGraph.nodeMeshes[targetID].position.x, this.targetGraph.nodeMeshes[targetID].position.y, this.targetGraph.nodeMeshes[targetID].position.z);
                            var additionalSourcePoint = new THREE.Vector3((sourcePoint.x + sourceMidPoint.x) / 2, (sourcePoint.y + sourceMidPoint.y) / 2, (sourcePoint.z + sourceMidPoint.z) / 2);
                            var additionalTargetPoint = new THREE.Vector3((targetPoint.x + targetMidPoint.x) / 2, (targetPoint.y + targetMidPoint.y) / 2, (targetPoint.z + targetMidPoint.z) / 2);

                            var material = new THREE.LineBasicMaterial({
                                color: 0x000000,
                            });

                            // segment 1
                            if (allSourceLeaves.length == 1) {
                                var geometry = new THREE.Geometry();
                                geometry.vertices.push(sourcePoint);
                                geometry.vertices.push(sourceRootPoint);

                                var line = new THREE.Line(geometry, material);
                                this.targetGraph.addBundlingEdge(line);
                            }
                            else if (allSourceLeaves.length > 1) {
                                var spline = new THREE.CubicBezierCurve3(sourcePoint, additionalSourcePoint, sourceMidPoint, sourceRootPoint);

                                var geometry = new THREE.Geometry();
                                var splinePoints = spline.getPoints(20);

                                for (var w = 0; w < splinePoints.length; w++) {
                                    geometry.vertices.push(<any>splinePoints[w]);
                                }

                                var line = new THREE.Line(geometry, material);
                                this.targetGraph.addBundlingEdge(line);
                            }

                            // segment 2
                            var geometry = new THREE.Geometry();
                            geometry.vertices.push(sourceRootPoint);
                            geometry.vertices.push(targetRootPoint);

                            var line = new THREE.Line(geometry, material);
                            this.targetGraph.addBundlingEdge(line);

                            // segment 3
                            if (allTargetLeaves.length == 1) {
                                var geometry = new THREE.Geometry();
                                geometry.vertices.push(targetPoint);
                                geometry.vertices.push(targetRootPoint);

                                var line = new THREE.Line(geometry, material);
                                this.targetGraph.addBundlingEdge(line);
                            }
                            else if (allTargetLeaves.length > 1) {
                                var spline = new THREE.CubicBezierCurve3(targetPoint, additionalTargetPoint, targetMidPoint, targetRootPoint);

                                var geometry = new THREE.Geometry();
                                var splinePoints = spline.getPoints(20);

                                for (var w = 0; w < splinePoints.length; w++) {
                                    geometry.vertices.push(<any>splinePoints[w]);
                                }

                                var line = new THREE.Line(geometry, material);
                                this.targetGraph.addBundlingEdge(line);
                            }
                        }
                    }
                }
                */
            }
        }
    }

    initPowerGraphSpatial3D() {
        this.nodes = [];
        this.links = [];

        var children = this.targetGraph.rootObject.children;
        for (var i = 0; i < children.length; i++) {
            var obj = children[i];
            if ((<any>obj).isNode) {
                if (this.targetGraph.nodeHasNeighbors[obj.id]) {
                    var nodeObject = new Object();
                    nodeObject['id'] = obj.id;
                    nodeObject['x'] = obj.position.x;
                    nodeObject['y'] = obj.position.y;
                    nodeObject['z'] = obj.position.z;
                    nodeObject['isLeaf'] = true;
                    nodeObject['count'] = 1;
                    this.nodes.push(nodeObject);
                }
            }
        }

        if (this.nodes.length <= 1) return;

        this.createPowerGroups();

        for (var i = 0; i < this.targetGraph.edgeList.length; i++) {
            var edge = this.targetGraph.edgeList[i];
            if (edge.visible) {
                var link = new Object();
                link["source"] = edge.sourceNode.id;
                link["target"] = edge.targetNode.id;

                this.links.push(link);
            }
        }

        this.createPowerEdges();
        this.targetGraph.removeAllEdges();

        for (var i = 0; i < this.powerEdges.length; i++) {
            var edgeList = this.powerEdgeToTree(this.powerEdges[i], this.nodes);

            for (var j = 0; j < edgeList.length; j++) {
                var thisEdge = edgeList[j];
                if (thisEdge.length == 2) {
                    var geometry = new THREE.Geometry();
                    geometry.vertices.push(thisEdge[0]);
                    geometry.vertices.push(thisEdge[1]);

                    var material = new THREE.LineBasicMaterial({
                        color: 0x000000,
                    });

                    var line = new THREE.Line(geometry, material);
                    this.targetGraph.addBundlingEdge(line);
                }
                else if (thisEdge.length == 4) {
                    if ((thisEdge[1].x == thisEdge[3].x) && (thisEdge[1].y == thisEdge[3].y) && (thisEdge[1].z == thisEdge[3].z)) {
                        var geometry = new THREE.Geometry();
                        geometry.vertices.push(thisEdge[0]);
                        geometry.vertices.push(thisEdge[3]);

                        var material = new THREE.LineBasicMaterial({
                            color: 0x000000,
                        });

                        var line = new THREE.Line(geometry, material);
                        this.targetGraph.addBundlingEdge(line);
                    }
                    else {
                        var spline = new THREE.CubicBezierCurve3(thisEdge[0], thisEdge[1], thisEdge[2], thisEdge[3]);

                        var geometry = new THREE.Geometry();
                        var splinePoints = spline.getPoints(20);

                        for (var w = 0; w < splinePoints.length; w++) {
                            geometry.vertices.push(<any>splinePoints[w]);
                        }

                        var line = new THREE.Line(geometry, material);
                        this.targetGraph.addBundlingEdge(line);
                    }
                }
            }
        }
    }

    powerEdgeToTree(powerEdge, coordinates) {
        var edgeList = []; // edge list in the tree

        var source = powerEdge.source;
        var target = powerEdge.target;

        var sourceMidPoint = this.getMidPointOfAGroup(source, coordinates);
        var targetMidPoint = this.getMidPointOfAGroup(target, coordinates);

        var dx = targetMidPoint.x - sourceMidPoint.x;
        var dy = targetMidPoint.y - sourceMidPoint.y;
        var dz = targetMidPoint.z - sourceMidPoint.z;

        var rootPoint = new THREE.Vector3(sourceMidPoint.x + dx * (1 / 2), sourceMidPoint.y + dy * (1 / 2), sourceMidPoint.z + dz * (1 / 2));

        var sourceEdgeList = this.buildSubTree(rootPoint, source, coordinates);
        sourceEdgeList.forEach(e => { edgeList.push(e); });

        var targetEdgeList = this.buildSubTree(rootPoint, target, coordinates);
        targetEdgeList.forEach(e => { edgeList.push(e); });

        return edgeList;
    }

    buildSubTree(rootPoint, node, coordinates) {
        var edgeList = [];

        var midPoint = this.getMidPointOfAGroup(node, coordinates);

        var dx = midPoint.x - rootPoint.x;
        var dy = midPoint.y - rootPoint.y;
        var dz = midPoint.z - rootPoint.z;

        var subRootPoint = new THREE.Vector3(rootPoint.x + dx * (1 / 3), rootPoint.y + dy * (1 / 3), rootPoint.z + dz * (1 / 3));

        var edge = []; // the first edge 
        edge.push(rootPoint);
        edge.push(subRootPoint);
        edgeList.push(edge);

        if (typeof (node.leaves) != "undefined") {
            for (var i = 0; i < node.leaves.length; i++) {
                var nodeID = node.leaves[i].id;

                var index = coordinates.map(function (d) {
                    return d.id;
                }).indexOf(nodeID);

                var leafPoint = new THREE.Vector3(coordinates[index].x, coordinates[index].y, coordinates[index].z);
                var additionalPoint = new THREE.Vector3((leafPoint.x + midPoint.x) / 2, (leafPoint.y + midPoint.y) / 2, (leafPoint.z + midPoint.z) / 2);

                var edge = [];
                edge.push(subRootPoint);
                edge.push(midPoint);
                edge.push(additionalPoint);
                edge.push(leafPoint);
                edgeList.push(edge);
            }
        }

        if (typeof (node.groups) != "undefined") {
            for (var i = 0; i < node.groups.length; i++) {
                var subgroup = node.groups[i];
                var subEdgeList = this.buildSubTree(subRootPoint, subgroup, coordinates);
                subEdgeList.forEach(e => { edgeList.push(e); });
            }
        }

        if ((typeof (node.leaves) == "undefined") && (typeof (node.groups) == "undefined")) {
            // this is the leaf
            var nodeID = node.id;

            var index = coordinates.map(function (d) {
                return d.id;
            }).indexOf(nodeID);

            var leafPoint = new THREE.Vector3(coordinates[index].x, coordinates[index].y, coordinates[index].z);
            var additionalPoint = new THREE.Vector3((leafPoint.x + midPoint.x) / 2, (leafPoint.y + midPoint.y) / 2, (leafPoint.z + midPoint.z) / 2);

            var edge = [];
            edge.push(subRootPoint);
            edge.push(midPoint);
            edge.push(additionalPoint);
            edge.push(leafPoint);
            edgeList.push(edge);
        }

        return edgeList;
    }

    getMidPointOfAGroup(group, coordinates) {
        var allLeaves = this.getAllLeavesInATree(group);

        var totalX = 0;
        var totalY = 0;
        var totalZ = 0;

        for (var j = 0; j < allLeaves.length; j++) {
            var nodeID = allLeaves[j].id;

            var index = coordinates.map(function (d) {
                return d.id;
            }).indexOf(nodeID);

            totalX += coordinates[index].x;
            totalY += coordinates[index].y;
            totalZ += coordinates[index].z;
        }

        var midPoint = new THREE.Vector3(totalX / allLeaves.length, totalY / allLeaves.length, totalZ / allLeaves.length);

        return midPoint;
    }

    createPowerEdges() {
        var allEdges = this.links.slice(0);

        //this.powerGroups.sort(function (a, b) { return b.count - a.count; });

        var groupPairList = [];

        for (var i = 0; i < this.powerGroups.length; i++) {
            for (var j = 1; j < this.powerGroups.length; j++) {
                var obj = new Object();
                obj['count'] = this.powerGroups[i].count * this.powerGroups[j].count;
                obj['sourceGroupIndex'] = i;
                obj['targetGroupIndex'] = j;
                obj['hasChecked'] = false;
                groupPairList.push(obj);
            }
        }

        groupPairList.sort(function (a, b) { return b.count - a.count; });

        this.createPowerEdgeGreedy(allEdges, groupPairList);
    }

    createPowerEdgeGreedy(allEdges: any[], groupPairList: any[]) {
        for (var i = 0; i < groupPairList.length; i++) {
            var g1 = this.powerGroups[groupPairList[i].sourceGroupIndex];
            var g2 = this.powerGroups[groupPairList[i].targetGroupIndex];

            if (g1.count * g2.count <= allEdges.length) {
                var hasEdge = this.hasPowerEdgeBetweenTwoGroups(g1, g2, allEdges);
                if (hasEdge) {
                    var e = new Object();
                    e['source'] = g1;
                    e['target'] = g2;

                    this.powerEdges.push(e);
                    this.removeEdges(g1, g2, allEdges);                   
                }
            }

            if (allEdges.length <= 0) return;
        }
    }

    removeEdges(g1, g2, allEdges: any[]) {
        var leaves1 = this.getAllLeavesInATree(g1);
        var leaves2 = this.getAllLeavesInATree(g2);

        var edgesCSV = allEdges.map(function (d) {
            return d.source + ";" + d.target;
        });

        for (var i = 0; i < leaves1.length; i++) {
            for (var j = 0; j < leaves2.length; j++) {
                var csv1 = leaves1[i].id + ";" + leaves2[j].id;
                var csv2 = leaves2[j].id + ";" + leaves1[i].id;

                var index1 = edgesCSV.indexOf(csv1);
                var index2 = edgesCSV.indexOf(csv2);

                if (index1 >= 0) {
                    allEdges.splice(index1, 1);
                }

                if (index2 >= 0) {
                    allEdges.splice(index2, 1);
                }
            }
        }

    }

    hasPowerEdgeBetweenTwoGroups(g1, g2, allEdges: any[]) {
        var leaves1 = this.getAllLeavesInATree(g1);
        var leaves2 = this.getAllLeavesInATree(g2);

        var edgesCSV = allEdges.map(function (d) {
            return d.source + ";" + d.target;
        });

        for (var i = 0; i < leaves1.length; i++) {
            for (var j = 0; j < leaves2.length; j++) {
                var csv1 = leaves1[i].id + ";" + leaves2[j].id;
                var csv2 = leaves2[j].id + ";" + leaves1[i].id;

                var index1 = edgesCSV.indexOf(csv1);
                var index2 = edgesCSV.indexOf(csv2);

                if ((index1 == -1) && (index2 == -1)) {
                    return false;
                }
            }
        }

        return true;
    }

    getAllLeavesInATree(node) {
        var allLeaves = [];

        if (typeof (node.leaves) != "undefined") {
            for (var i = 0; i < node.leaves.length; i++) {
                var leaves = this.getAllLeavesInATree(node.leaves[i]);
                leaves.forEach(l => { allLeaves.push(l); });
            }
        }

        if (typeof (node.groups) != "undefined") {
            for (var i = 0; i < node.groups.length; i++) {
                var leaves = this.getAllLeavesInATree(node.groups[i]);
                leaves.forEach(l => { allLeaves.push(l); });
            }
        }

        if ((typeof (node.leaves) == "undefined") && (typeof (node.groups) == "undefined")) {
            // this is the leaf
            allLeaves.push(node);
        }

        return allLeaves;
    }

    createPowerGroups() {
        var allNodes = this.nodes.slice(0);
        var numberOfTrees = 5; // a threshold to stop creating power groups;

        while (allNodes.length > numberOfTrees) {
            this.createPowerGroupByCoordinates(allNodes);
        }

        // add all leaf nodes to power group
        for (var i = 0; i < this.nodes.length; i++) {
            this.powerGroups.push(this.nodes[i]);
        }
    }

    createPowerGroupByCoordinates(allNodes: any[]) {
        var minDist = -1;
        var minI = -1;
        var minJ = -1;
        for (var i = 0; i < allNodes.length; i++) {
            for (var j = 0; j < allNodes.length; j++) {
                if (i != j) {
                    var n1 = allNodes[i];
                    var n2 = allNodes[j];
                    var s = (n1.x - n2.x) * (n1.x - n2.x) + (n1.y - n2.y) * (n1.y - n2.y) + (n1.z - n2.z) * (n1.z - n2.z);
                    var distance = Math.sqrt(s);

                    if (minDist == -1) {
                        minDist = distance;
                        minI = i;
                        minJ = j;
                    }
                    else {
                        if (distance < minDist) {
                            minDist = distance;
                            minI = i;
                            minJ = j;
                        }
                    }
                }
            }
        }

        var node1 = allNodes[minI];
        var node2 = allNodes[minJ];

        var g = new Object();
        g['isGroup'] = true;
        g['id'] = 10000 + this.powerGroups.length;
        g['count'] = node1.count + node2.count;
        g['x'] = (node1.x * node1.count + node2.x * node2.count) / (node1.count + node2.count);
        g['y'] = (node1.y * node1.count + node2.y * node2.count) / (node1.count + node2.count);
        g['z'] = (node1.z * node1.count + node2.z * node2.count) / (node1.count + node2.count);

        this.AddNodeToGroup(node1, g);
        this.AddNodeToGroup(node2, g);

        var index1 = allNodes.map(function (d) {
            return d.id;
        }).indexOf(node1.id);
        allNodes.splice(index1, 1);

        var index2 = allNodes.map(function (d) {
            return d.id;
        }).indexOf(node2.id);
        allNodes.splice(index2, 1);

        this.powerGroups.push(g);
        allNodes.push(g);
    }

    AddNodeToGroup(node, g) {
        if (node.isLeaf) {
            if (typeof ((<any>g).leaves) == "undefined") {
                g['leaves'] = [];
                g['leaves'].push(node);
            }
            else {
                g['leaves'].push(node);
            }
        }
        else if (node.isGroup) {
            if (typeof ((<any>g).groups) == "undefined") {
                g['groups'] = [];
                g['groups'].push(node);
            }
            else {
                g['groups'].push(node);
            }
        }
    }
}

// svg graph
class Graph2D {
    nodes: any[];
    links: any[];

    constructor() {
        this.nodes = [];
        this.links = [];
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

    bundlingEdgeList: any[] = [];

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

    isVisible() {
        return this.visible;
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

    findNodeConnectivity(filteredAdjMatrix, dissimilarityMatrix, edges: any[]) {
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
        //var edges = [];
        var hasNeighbours = Array<boolean>(this.nodeMeshes.length);
        for (var i = 0; i < this.nodeMeshes.length - 1; ++i) {
            for (var j = i + 1; j < this.nodeMeshes.length; ++j) {
                if (filteredAdjMatrix[i][j] === 1) {
                    if (this.filteredNodeIDs) {
                        if ((this.filteredNodeIDs.indexOf(i) != -1) && (this.filteredNodeIDs.indexOf(j) != -1)) {
                            var len = dissimilarityMatrix[i][j];
                            if (edges) edges.push({ source: i, target: j, length: len });
                            hasNeighbours[i] = true;
                            hasNeighbours[j] = true;
                        }
                    } else {
                        var len = dissimilarityMatrix[i][j];
                        if (edges) edges.push({ source: i, target: j, length: len });
                        hasNeighbours[i] = true;
                        hasNeighbours[j] = true;
                    }
                }
            }
        }

        this.nodeHasNeighbors = hasNeighbours.slice(0);
    }

    // used by colaGraph
    setNodeVisibilities() {
        if (!this.nodeHasNeighbors) return;

        for (var i = 0; i < this.nodeHasNeighbors.length; ++i) {
            if (this.nodeHasNeighbors[i]) {
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

    addBundlingEdge(line) {
        (<any>line).isBundlingEdge = true;
        this.bundlingEdgeList.push(line);
        this.rootObject.add(line);
    }

    removeAllBundlingEdges() {
        for (var i = 0; i < this.bundlingEdgeList.length; ++i) {
            this.rootObject.remove(this.bundlingEdgeList[i]);
        }

        // remove all elements in the list
        this.bundlingEdgeList.splice(0, this.bundlingEdgeList.length); 
    }

    removeAllEdges() {
        for (var i = 0; i < this.edgeList.length; i++) {
            var e = this.edgeList[i];
            if (e.visible) {
                e.setVisible(false);
            }
        }
    }

    showAllLabels(svgMode: boolean) {
        for (var i = 0; i < this.nodeLabelList.length; ++i) {
            if (this.nodeLabelList[i]) {
                if (!svgMode) this.rootObject.add(this.nodeLabelList[i]);
            }
        }
    }

    hideAllLabels() {
        for (var i = 0; i < this.nodeLabelList.length; ++i) {
            if (this.nodeLabelList[i]) {
                this.rootObject.remove(this.nodeLabelList[i]);
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

    selectNode(id: number, svgMode: boolean) {
        var x = this.nodeMeshes[id].scale.x;
        var y = this.nodeMeshes[id].scale.y;
        var z = this.nodeMeshes[id].scale.z;

        this.nodeMeshes[id].scale.set(2*x, 2*y, 2*z);

        if (this.allLabels == false) {
            if (!svgMode) this.rootObject.add(this.nodeLabelList[id]);
        }
    }

    deselectNode(id: number) {
        var x = this.nodeMeshes[id].scale.x;
        var y = this.nodeMeshes[id].scale.y;
        var z = this.nodeMeshes[id].scale.z;

        this.nodeMeshes[id].scale.set(0.5*x, 0.5*y, 0.5*z);

        if (this.allLabels == false) {
            this.rootObject.remove(this.nodeLabelList[id]);
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
        (<any>this.shape).isEdge = true; // A flag to identify the edge
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