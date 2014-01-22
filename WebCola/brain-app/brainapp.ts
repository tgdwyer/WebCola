// Interface-related code

/*
    [0]: top-left
    [1]: top-right
    [2]: bottom-left
    [3]: bottom-right
*/
$('#upload').button();

var viewResizeCallbacks = Array((a, b) => { }, (a, b) => { }, (a, b) => { }, (a, b) => { });

// Embed brain network
//var iframe = $('<iframe id="iframe" src = "../examples/brainnetwork2.html" ></iframe>');
//$('#view-bottom-right').append(iframe);

var pinRadius = 12;
var pinOffsetX = 262 - pinRadius;
var viewWidth = $('#view-panel').width();
var viewHeight = $('#view-panel').height();
$('#pin').css({ left: viewWidth / 2 + pinOffsetX, top: viewHeight / 2 });
setViewCrossroads(viewWidth / 2, viewHeight / 2);

$('#pin').draggable({ containment: '#outer-view-panel' }).on('drag', function (event: JQueryEventObject, ...args: any[]) {
    var ui = args[0];
    var x = ui.position.left - pinOffsetX;
    var y = ui.position.top;
    setViewCrossroads(x, y);
});

function setViewCrossroads(x, y) {
    var viewWidth = $('#view-panel').width();
    var viewHeight = $('#view-panel').height();
    $('#view-top-left').css({ width: x, height: y });
    $('#view-top-right').css({ width: viewWidth - x, height: y });
    $('#view-bottom-left').css({ width: x, height: viewHeight - y });
    $('#view-bottom-right').css({ width: viewWidth - x, height: viewHeight - y });
    //$('#iframe').css({ width: viewWidth - x, height: viewHeight - y });

    // Make callbacks to the application windows
    viewResizeCallbacks[0](x, y);
    viewResizeCallbacks[1](viewWidth - x, y);
    viewResizeCallbacks[2](x, viewHeight - y);
    viewResizeCallbacks[3](viewWidth - x, viewHeight - y);
}

// TODO: Fix resizing behaviour
window.addEventListener('resize', function () {
    var newViewWidth = $('#view-panel').width();
    var newViewHeight = $('#view-panel').height();
    var xScale = newViewWidth / viewWidth;
    var yScale = newViewHeight / viewHeight;
    var pinPos = $('#pin').position();
    var newPinX = (pinPos.left + pinRadius) * xScale;
    var newPinY = (pinPos.top + pinRadius) * yScale;

    $('#pin').css({ left: newPinX - pinRadius, top: newPinY - pinRadius });
    setViewCrossroads(newPinX, newPinY);

    viewWidth = newViewWidth;
    viewHeight = newViewHeight;
}, false);

// Sub-applications implement this interface

interface Application {
    init(parent: Node, width: number, height: number): (width: number, height: number) => void;
}

// The loop class can be used to run applications that aren't event-based

interface Loopable {
    update(deltaTime: number): void;
    draw(): void;
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
            this.nextUpdate();
            this.loopable.draw();
            requestAnimationFrame(mainLoop);
        }
        requestAnimationFrame(mainLoop);
    }

    nextUpdate() {
        var currentTime = new Date().getTime();
        var deltaTime = (currentTime - this.timeOfLastFrame) / 1000;
        this.timeOfLastFrame = currentTime;

        // Limit the maximum time step
        if (deltaTime > this.frameTimeLimit)
            this.loopable.update(this.frameTimeLimit);
        else
            this.loopable.update(deltaTime);
    }
}

// Create a Brain3D application

var app = new Brain3DApp();
var divJ = $('#view-top-right');
var div = divJ.get(0);
viewResizeCallbacks[1] = app.init(div, divJ.width(), divJ.height());