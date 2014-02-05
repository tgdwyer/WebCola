// Constants
var controlPanelWidth = 250;

class CommonData {
    public brainCoords: number[][];
    public brainLabels: string[];
    public brainSurface;
    public nodeCount: number; // Number of coordinates

    coordCallbacks: Array<() => void> = new Array();
    labelCallbacks: Array<() => void> = new Array();
    surfaceCallbacks: Array<() => void> = new Array();

    regNotifyCoords(callback: () => void) {
        this.coordCallbacks.push(callback);
    }
    regNotifyLabels(callback: () => void) {
        this.labelCallbacks.push(callback);
    }
    regNotifySurface(callback: () => void) {
        this.surfaceCallbacks.push(callback);
    }
    // TODO: add deregistration capability
    notifyCoords() {
        this.coordCallbacks.forEach(function (c) { c() });
    }
    notifyLabels() {
        this.labelCallbacks.forEach(function (c) { c() });
    }
    notifySurface() {
        this.surfaceCallbacks.forEach(function (c) { c() });
    }
}

class DataSet {
    public simMatrix: number[][];
    public attributes: Attributes;
    simCallbacks: Array<() => void> = new Array();
    attCallbacks: Array<() => void> = new Array();

    regNotifySim(callback: () => void) {
        this.simCallbacks.push(callback);
    }
    regNotifyAttributes(callback: () => void) {
        this.attCallbacks.push(callback);
    }
    // TODO: add deregistration capability
    notifySim() {
        this.simCallbacks.forEach(function (c) {c()});
    }
    notifyAttributes() {
        this.attCallbacks.forEach(function (c) { c() });
    }
}

class Attributes {
    values = {};

    constructor(text: string) {
        var lines = text.split(String.fromCharCode(13)); // Lines delimited by carriage returns...
        var numRecords = lines.length - 1;
        var names = lines[0].split('\t');
        var numAttributes = names.length;
        var values = new Array<Array<number>>(numAttributes); // Store the values of each attribute by index
        for (var i = 0; i < numAttributes; ++i) {
            values[i] = new Array<number>(numRecords);
        }
        for (var i = 1; i <= numRecords; ++i) { // Add the attributes of each record to the right value list
            var rec = lines[i].split('\t');
            for (var j = 0; j < numAttributes; ++j) {
                values[j][i - 1] = parseFloat(rec[j]);
            }
        }
        for (var i = 0; i < numAttributes; ++i) {
            this.values[names[i]] = values[i];
        }
    }

    get(attribute: string) {
        return this.values[attribute];
    }
}

// Sub-applications implement this interface

interface Application {
    //init(commonData: CommonData, parent: Node, width: number, height: number); // We're using constructors now
    setDataSet(dataSet: DataSet);
    resize(width: number, height: number);
}

class DummyApp implements Application {
    setDataSet() { }
    resize() { }
}

// The loop class can be used to run applications that aren't event-based

interface Loopable {
    update(deltaTime: number): void;
}

class Loop {
    loopable;
    frameTimeLimit;
    timeOfLastFrame;

    constructor(loopable: Loopable, limit: number) {
        this.loopable = loopable;
        this.frameTimeLimit = limit;
        this.timeOfLastFrame = new Date().getTime();

        var mainLoop = () => {
            var currentTime = new Date().getTime();
            var deltaTime = (currentTime - this.timeOfLastFrame) / 1000;
            this.timeOfLastFrame = currentTime;

            // Limit the maximum time step
            if (deltaTime > this.frameTimeLimit)
                this.loopable.update(this.frameTimeLimit);
            else
                this.loopable.update(deltaTime);

            requestAnimationFrame(mainLoop);
        }

        requestAnimationFrame(mainLoop);
    }
}

// Shorten the names of the views
var tl_view = '#view-top-left';
var tr_view = '#view-top-right';
var bl_view = '#view-bottom-left';
var br_view = '#view-bottom-right';

// Set up the class that will manage which view should be receiving input
var input = new InputTargetManager([tl_view, tr_view, bl_view, br_view]);
input.setActiveTarget(0);

// Set up selectability
var selectTLView = function () {
    input.setActiveTarget(0);
    $(tl_view).css({ borderColor: 'black', zIndex: 1 });
    $(tr_view).css({ borderColor: 'white', zIndex: 0 });
    $(bl_view).css({ borderColor: 'white', zIndex: 0 });
    $(br_view).css({ borderColor: 'white', zIndex: 0 });
};
$(tl_view).click(selectTLView);
$(tr_view).click(function () {
    input.setActiveTarget(1);
    $(tl_view).css({ borderColor: 'white', zIndex: 0 });
    $(tr_view).css({ borderColor: 'black', zIndex: 1 });
    $(bl_view).css({ borderColor: 'white', zIndex: 0 });
    $(br_view).css({ borderColor: 'white', zIndex: 0 });
});
$(bl_view).click(function () {
    input.setActiveTarget(2);
    $(tl_view).css({ borderColor: 'white', zIndex: 0 });
    $(tr_view).css({ borderColor: 'white', zIndex: 0 });
    $(bl_view).css({ borderColor: 'black', zIndex: 1 });
    $(br_view).css({ borderColor: 'white', zIndex: 0 });
});
$(br_view).click(function () {
    input.setActiveTarget(3);
    $(tl_view).css({ borderColor: 'white', zIndex: 0 });
    $(tr_view).css({ borderColor: 'white', zIndex: 0 });
    $(bl_view).css({ borderColor: 'white', zIndex: 0 });
    $(br_view).css({ borderColor: 'black', zIndex: 1 });
});
selectTLView(); // Select the top-left view straight away.

// Set up icons

$('#brain3d-icon-front').draggable(
    {
        containment: 'body',
        stop: function (event) {
            resetBrain3D();
            switch (getViewUnderMouse(event.pageX, event.pageY)) {
                case tl_view:
                    apps[0] = new Brain3DApp(commonData, $(tl_view), input.getTarget(0));
                    apps[0].setDataSet(dataSets[0]);
                    break;
                case tr_view:
                    apps[1] = new Brain3DApp(commonData, $(tr_view), input.getTarget(1));
                    apps[1].setDataSet(dataSets[0]);
                    break;
                case bl_view:
                    apps[2] = new Brain3DApp(commonData, $(bl_view), input.getTarget(2));
                    apps[2].setDataSet(dataSets[0]);
                    break;
                case br_view:
                    apps[3] = new Brain3DApp(commonData, $(br_view), input.getTarget(3));
                    apps[3].setDataSet(dataSets[0]);
                    break;
            }
        }
    }
);

function resetIcon(object: string, location: string) {
    return function () {
        var rect = $(location).get(0).getBoundingClientRect();
        $(object).css({ left: rect.left, top: rect.top });
    };
}

var resetBrain3D = resetIcon('#brain3d-icon-front', '#brain3d-icon-back');

var icons = [$('#brain3d-icon-front')];

function showIcons() {
    icons.forEach(function (icon) {
        icon.show();
    });
}
function hideIcons() {
    icons.forEach(function (icon) {
        icon.hide();
    });
}
hideIcons(); // Hide all the icons immediately

// Set up jQuery UI layout objects
$('#control-panel').tabs({
    activate: function (event, ui) {
        if (ui.newPanel[0].id == 'tab-2') {
            // Reset all icons
            resetBrain3D();
            // Show all icons
            showIcons();
        } else {
            // Hide all icons
            hideIcons();
        }
    }
});
$('#accordion').accordion({
    heightStyle: "content"
});

// Set up data upload buttons
$('#select-coords').button();
$('#upload-coords').button().click(function () {
    var file = $('#select-coords').get(0).files[0];
    if (file) loadCoordinates(file);
});
$('#select-labels').button();
$('#upload-labels').button().click(function () {
    var file = $('#select-labels').get(0).files[0];
    if (file) loadLabels(file);
});
$('#select-matrix-1').button();
$('#upload-matrix-1').button().click(function () {
    var file = $('#select-matrix-1').get(0).files[0];
    if (file) loadSimilarityMatrix(file, dataSets[0]);
});
$('#select-attr-1').button();
$('#upload-attr-1').button().click(function () {
    var file = $('#select-attr-1').get(0).files[0];
    if (file) loadAttributes(file, dataSets[0]);
});
$('#select-matrix-2').button();
$('#upload-matrix-2').button().click(function () {
    var file = $('#select-matrix-2').get(0).files[0];
    if (file) loadSimilarityMatrix(file, dataSets[1]);
});
$('#select-attr-2').button();
$('#upload-attr-2 ').button().click(function () {
    var file = $('#select-attr-2').get(0).files[0]
    if (file) loadAttributes(file, dataSets[1]);
});

/*
    [0]: top-left
    [1]: top-right
    [2]: bottom-left
    [3]: bottom-right
*/
var apps = Array<Application>(new DummyApp(), new DummyApp(), new DummyApp(), new DummyApp());

var viewWidth = $('#outer-view-panel').width();
var viewHeight = $('#outer-view-panel').height();
$('#pin').css({ left: viewWidth / 2, top: viewHeight / 2 });
setViewCrossroads(viewWidth / 2, viewHeight / 2);

$('#pin').draggable({ containment: '#outer-view-panel' }).on('drag', function (event: JQueryEventObject, ...args: any[]) {
    var ui = args[0];
    var x = ui.position.left;
    var y = ui.position.top;
    setViewCrossroads(x, y);
});

function setViewCrossroads(x, y) {
    var viewWidth = $('#view-panel').width();
    var viewHeight = $('#view-panel').height();
    var lw = x - 3;
    var rw = viewWidth - x - 3;
    var th = y - 3;
    var bh = viewHeight - y - 3;
    $(tl_view).css({ width: lw, height: th });
    $(tr_view).css({ width: rw, height: th });
    $(bl_view).css({ width: lw, height: bh });
    $(br_view).css({ width: rw, height: bh });

    // Make callbacks to the application windows
    apps[0].resize(lw, th);
    apps[1].resize(rw, th);
    apps[2].resize(lw, bh);
    apps[3].resize(rw, bh);
}

window.addEventListener('resize', function () {
    var newViewWidth = $('#outer-view-panel').width();
    var newViewHeight = $('#outer-view-panel').height();
    var xScale = newViewWidth / viewWidth;
    var yScale = newViewHeight / viewHeight;
    var pinPos = $('#pin').position();
    var newPinX = pinPos.left * xScale;
    var newPinY = pinPos.top * yScale;

    $('#pin').css({ left: newPinX, top: newPinY });
    setViewCrossroads(newPinX, newPinY);

    viewWidth = newViewWidth;
    viewHeight = newViewHeight;
}, false);

function getViewUnderMouse(x, y) {
    if (x < controlPanelWidth) {
        return null;
    } else {
        x -= controlPanelWidth;
        if (y < $(tl_view).height()) {
            if (x < $(tl_view).width()) {
                return tl_view;
            } else {
                return tr_view;
            }
        } else {
            if (x < $(tl_view).width()) {
                return bl_view;
            } else {
                return br_view;
            }
        }
    }
}

// Resource loading
var commonData = new CommonData();
var dataSets = new Array<DataSet>(2);
dataSets[0] = new DataSet();
dataSets[1] = new DataSet();

// Load the physiological coordinates of each node in the brain
function loadCoordinates(file) {
    var reader = new FileReader();
    reader.onload = function () {
        // For some reason the text file uses a carriage return to separate coordinates (ARGGgggh!!!!)
        var lines = reader.result.split(String.fromCharCode(13));
        var len = lines.length - 1; // First line is just labels
        commonData.brainCoords = [Array(len), Array(len), Array(len)];
        commonData.nodeCount = len;
        for (var i = 0; i < len; ++i) {
            var words = lines[i+1].split('\t');
            // Translate the coords into Cola's format
            commonData.brainCoords[0][i] = parseFloat(words[0]);
            commonData.brainCoords[1][i] = parseFloat(words[1]);
            commonData.brainCoords[2][i] = parseFloat(words[2]);
        }
        commonData.notifyCoords();
    }
    reader.readAsText(file);
}

// Load the labels
function loadLabels(file) {
    var reader = new FileReader();
    reader.onload = function () {
        commonData.brainLabels = reader.result.split('\n').map(function (s) { return s.trim() });
        commonData.notifyLabels();
    }
    reader.readAsText(file);
}

// Set up OBJ loading
var manager = new THREE.LoadingManager();
manager.onProgress = function (item, loaded, total) {
    console.log(item, loaded, total);
};
var loader = new THREE.OBJLoader(manager);
// Load the brain surface (hardcoded)
function loadBrainModel() {
    loader.load('../examples/graphdata/BrainLSDecimated0.01.obj', function (object) {
        if (!object) {
            console.log("Failed to load brain surface.");
            return;
        }
        // Set brain mesh material
        object.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                child.material =
                new THREE.MeshLambertMaterial(
                    {
                        color: 0xffaaaa,
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

        object.position.y = 0;
        // Setting scale to some arbitrarily larger value
        var scale = 1.5;
        object.scale = new THREE.Vector3(scale, scale, scale);

        commonData.brainSurface = object;
        commonData.notifySurface();
    });
}
loadBrainModel(); // Load the model right away

// Load the similarity matrix for the specified dataSet
function loadSimilarityMatrix(file, dataSet: DataSet) {
    var reader = new FileReader();
    reader.onload = function () {
        var lines = reader.result.split('\n').map(function (s) { return s.trim() });
        dataSet.simMatrix = [];
        lines.forEach((line, i) => {
            if (line.length > 0) {
                dataSet.simMatrix.push(line.split(' ').map(function (string) {
                    return parseFloat(string);
                }));
            }
        });
        dataSet.notifySim();
    }
    reader.readAsText(file);
}

// Load the attributes for the specified dataSet
function loadAttributes(file, dataSet: DataSet) {
    var reader = new FileReader();
    reader.onload = function () {
        dataSet.attributes = new Attributes(reader.result);
        dataSet.notifyAttributes();
    }
    reader.readAsText(file);
}

// Leap Motion stuff