/// <reference path="../extern/three.d.ts"/>
/*
Copyright (c) 2013, Faculty of Information Technology, Monash University.
All rights reserved.
Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of Monash University nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
/*
* Author: Nicholas Smith
*
* This module defines all objects and functions needed to handle input from
* the mouse, keyboard, and Leap Motion and direct them to specific targets.
* A 'target' is usually a sub-application within a browser window.
*
* Please note the Leap motion-related code may be poorly designed and unmaintainable.
*/

declare var Leap; // Defined by leap.js

// Leap and screen spatial information (to have the location you point at on the screen detected accurately)
var screenAspectRatio = 16 / 9;
var screenSize = 15.6 * 25.4; // mm diagonally
var screenHeight = Math.sqrt(screenSize * screenSize / (screenAspectRatio * screenAspectRatio + 1));
var screenWidth = Math.sqrt(screenSize * screenSize - screenHeight * screenHeight);
var leapDistance = 250; // in mm, from the screen
var leapHeight = 0; //in mm, relative to the bottom of the display

// A reference to an instance of this class is passed to all the input targets so they each have a valid reference to the
// position of the current pointer (the 'ptr' member holds this reference)
class PointerIndirection {
    ptr;
}

// Holds the state of and the callbacks to be made for a particular input target
class InputTarget {
    active: boolean = false;
    sliderEvent: boolean = false;

    keyDownCallbacks = {};
    keyUpCallbacks = {};
    keyTickCallbacks = {};

    leapXCallback;
    leapYCallback;
    leapZCallback;

    mouseDragCallback;
    mouseRightClickCallback;
    mouseWheelCallback;
    mouseDoubleClickCallback;

    getRotationCallback;
    setRotationCallback;

    // Accepts the CSS ID of the div that is to represent the input target, and the extra borders
    // which describe where in the div the region of interest is (and where the coordinates should be scaled around)
    constructor(public targetCssId: string, public currentPointer: PointerIndirection, public leftBorder = 0, public rightBorder = 0, public topBorder = 0, public bottomBorder = 0) { }

    regKeyDownCallback(key: string, callback: () => void) {
        this.keyDownCallbacks[key] = callback;
    }

    regKeyUpCallback(key: string, callback: () => void) {
        this.keyUpCallbacks[key] = callback;
    }

    regKeyTickCallback(key: string, callback: (number) => void) {
        this.keyTickCallbacks[key] = callback;
    }

    regLeapXCallback(callback: (number) => void) {
        this.leapXCallback = callback;
    }

    regLeapYCallback(callback: (number) => void) {
        this.leapYCallback = callback;
    }

    regLeapZCallback(callback: (number) => void) {
        this.leapZCallback = callback;
    }

    regMouseDragCallback(callback: (dx:number, dy:number, mode: number) => void) {
        this.mouseDragCallback = callback;
    }

    regMouseRightClickCallback(callback: (x: number, y: number) => void) {
        this.mouseRightClickCallback = callback;
    }

    regMouseWheelCallback(callback: (delta: number) => void) {
        this.mouseWheelCallback = callback;
    }

    regMouseDoubleClickCallback(callback: () => void) {
        this.mouseDoubleClickCallback = callback;
    }

    regGetRotationCallback(callback: () => number[]) {
        this.getRotationCallback = callback;
    }

    regSetRotationCallback(callback: (rotation: number[]) => void) {
        this.setRotationCallback = callback;
    }

    // Return the pointer coordinates within the input target as a pair (x, y) E [-1, 1]x[-1, 1] as they lie within the target's borders
    localPointerPosition() {
        var target = $(this.targetCssId);
        var pos = target.offset();
        return new THREE.Vector2(
            (this.currentPointer.ptr.x - pos.left - this.leftBorder) / (target.width() - this.leftBorder - this.rightBorder) * 2 - 1,
            (pos.top + this.topBorder - this.currentPointer.ptr.y) / (target.height() - this.topBorder - this.bottomBorder) * 2 + 1
            );
    }
}

// The interface required by a DOM element which represents the on-screen pointer for pointing with the Leap
interface PointerImage {
    updatePosition(position);
    show();
    hide();
}

// Reads input and directs it to the currently-active input target.
class InputTargetManager {
    loop;
    mouse = new THREE.Vector2(-999999, -999999);
    keyboardKey = {};
    currentPointer: PointerIndirection; // Mouse or Leap
    inputTargets: Array<InputTarget>;
    activeTarget = 0;

    // Leap variables
    leap;
    fingerPointer = new THREE.Vector2(-999999, -999999); // Vector respresenting the current position of the Leap on the screen

    pointingHandID = -1;
    pointingHandCheckedIn = false; // Whether the pointing hand was found during the last update
    pointingHandLenience = 0; // The grace period left before we consider the pointing hand lost
    maxPointingHandLenience = 10;
    fingerLostLenience = 0;
    maxFingerLostLenience = 10;

    fingerSmoothingLevel = 3; // Finger smoothing when pointing
    fingerPositions;
    fpi = 0;

    yokingView: boolean = false;

    mouseDownMode: number;
    isMouseDown: boolean = false;
    onMouseDownPosition = new THREE.Vector2();
    mouseLocationCallback;
    mouseUpCallback;

    rightClickLabel;
    rightClickLabelAppended: boolean = false;

    regMouseLocationCallback(callback: (x:number, y:number) => number) {
        this.mouseLocationCallback = callback;
    }

    regMouseUpCallback(callback: () => void) {
        this.mouseUpCallback = callback;
    }

    // Accepts the CSS IDs of each of the divs that represent an input target, as well as an object that implements the interface for a Leap motion pointer
    constructor(public targetCssIds: Array<string>, public pointerImage: PointerImage) {
        this.loop = new Loop(this, Number.POSITIVE_INFINITY); // Create a loop object so we can continually make callbacks for held-down keys
        this.currentPointer = new PointerIndirection();
        this.currentPointer.ptr = this.mouse;

        // Create the array to hold the input target objects - we'll create them later when we actually have a div to be targetted
        var numTargets = targetCssIds.length;
        this.inputTargets = new Array(numTargets);

        // Leap controller variables
        this.leap = new Leap.Controller();
        this.leap.on('deviceConnected', function () {
            console.log("The Leap device has been connected.");
        });
        this.leap.on('deviceDisconnected', function () {
            console.log("The Leap device has been disconnected.");
        });

        this.leap.connect();

        // Initialize finger smoothing variables
        this.fingerPositions = new Array(this.fingerSmoothingLevel);
        for (var i = 0; i < this.fingerSmoothingLevel; ++i)
            this.fingerPositions[i] = [1, 1, 1];

        var varYokingViewAcrossPanels = () => { this.yokingViewAcrossPanels(); }

        // Mouse input handling
        /*
        document.addEventListener('mousedown', function (event) {
            switch (event.which) {
                case 1:
                    this.mouse.leftHeld = true;
                    if (this.mouse.leftPressedCallback !== undefined)
                        this.mouse.leftPressedCallback();
                    break;
                case 2:
                    this.mouse.middleHeld = true;
                    break;
                case 3:
                    this.mouse.rightHeld = true;
            }
        });
        document.addEventListener('mouseup', function (event) {
            switch (event.which) {
                case 1:
                    this.mouse.leftHeld = false;
                    if (this.mouse.leftReleasedCallback !== undefined)
                        this.mouse.leftReleasedCallback();
                    break;
                case 2:
                    this.mouse.middleHeld = false;
                    break;
                case 3:
                    this.mouse.rightHeld = false;
            }
        });*/

        document.addEventListener('mousedown', (event) => {
            if (this.rightClickLabel && this.rightClickLabelAppended) {
                document.body.removeChild(this.rightClickLabel);
                this.rightClickLabelAppended = false;
            }

            this.mouseDownMode = event.which;

            var viewID = this.mouseLocationCallback(event.clientX, event.clientY);

            if (viewID == this.activeTarget) {
                var it = this.inputTargets[this.activeTarget];
                if (it && (it.sliderEvent == true)) return;

                this.isMouseDown = true;

                this.mouse.x = event.clientX;
                this.mouse.y = event.clientY;

                this.onMouseDownPosition.x = event.clientX;
                this.onMouseDownPosition.y = event.clientY;
            }
        }, false);

        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();

            var record: string;
            var x, y;

            var it = this.inputTargets[this.activeTarget];
            if (it) {
                x = this.mouse.x;
                y = this.mouse.y;

                var callback = it.mouseRightClickCallback;
                if (callback) record = callback(x, y);
            }

            if (record) {
                this.rightClickLabel = document.createElement('div');
                this.rightClickLabel.style.position = 'absolute';
                this.rightClickLabel.style.zIndex = '1';    
                this.rightClickLabel.style.backgroundColor = '#feeebd'; // the color of the control panel
                var s = record.replace(/;/g, '<br />');
                this.rightClickLabel.innerHTML = s;
                this.rightClickLabel.style.left = x + 'px';
                this.rightClickLabel.style.top = y + 'px';
                this.rightClickLabel.style.padding = '5px';
                this.rightClickLabel.style.borderRadius = '5px';

                document.body.appendChild(this.rightClickLabel);
                this.rightClickLabelAppended = true;
            }

            return false; // disable the context menu
        }, false);

        document.addEventListener('mouseup', (event) => {
            this.isMouseDown = false;

            setTimeout(this.mouseUpCallback, 200);
        }, false);

        document.addEventListener('dblclick', (event) => {
            event.preventDefault();

            var viewID = this.mouseLocationCallback(event.clientX, event.clientY);

            if (viewID == this.activeTarget) {
                var it = this.inputTargets[this.activeTarget];
                if (it) {
                    var callback = it.mouseDoubleClickCallback;
                    if (callback) callback();

                    if (this.yokingView) varYokingViewAcrossPanels();

                    clearSelection();
                }
            }
        }, false);

        document.addEventListener('mousewheel', (event) => {
            var viewID = this.mouseLocationCallback(event.clientX, event.clientY);         

            if (viewID == this.activeTarget) {
                var it = this.inputTargets[this.activeTarget];
                if (it) {
                    //console.log(event.wheelDelta);
                    var callback = it.mouseWheelCallback;
                    if (callback) callback(-event.wheelDelta/2000);
                }
            }

        }, false);

        document.addEventListener('mousemove', (event) => {
            this.currentPointer.ptr = this.mouse;
            this.pointerImage.hide();

            if (this.isMouseDown === true) {
                var it = this.inputTargets[this.activeTarget];
                if (it) {
                    var dx = event.clientX - this.mouse.x;
                    var dy = event.clientY - this.mouse.y;

                    var callback = it.mouseDragCallback;
                    if (callback) callback(dx, dy, this.mouseDownMode);

                    if (this.yokingView) varYokingViewAcrossPanels();
                    /*
                    if (this.yokingView) {
                        var rotation = null;
                        callback = it.getRotationCallback;
                        if (callback) rotation = callback();
                        if (rotation) {
                            for (var i = 0; i < this.inputTargets.length; i++) {
                                if (i != this.activeTarget) {
                                    var input = this.inputTargets[i];
                                    if (input) {
                                        callback = input.setRotationCallback;
                                        if (callback) callback(rotation);
                                    }
                                }
                            } 
                        }
                    }
                    */
                }
            }

            this.mouse.x = event.clientX;
            this.mouse.y = event.clientY;
        }, false);

        // Keyboard input handling
        //this.keyboard['keyPressed'] = {};
        //this.keyboard['keyReleased'] = {};
        //this.keyboard['keyToggle'] = {};

        document.addEventListener('keydown', (evt) => {
            //evt.preventDefault(); // Don't do browser built-in search with key press
            var k = this.translateKeycode(evt.keyCode);

            if (!this.keyboardKey[k]) {
                this.keyboardKey[k] = true;
                //this.keyboardKeyToggle[k] = !this.keyboardKeyToggle[k];
                //this.keyboardKeyPressed[k] = true;
                // Make the callbacks for the active input target
                var it = this.inputTargets[this.activeTarget];
                if (it) {
                    var callback = it.keyDownCallbacks[k];
                    if (callback) callback();

                    if (this.yokingView) varYokingViewAcrossPanels();
                }
            }
        }, false);

        document.addEventListener('keyup', (evt) => {
            var k = this.translateKeycode(evt.keyCode);
            this.keyboardKey[k] = false;
            //this.keyboardKeyReleased[k] = true;
            // Make the callbacks for the active input target
            var it = this.inputTargets[this.activeTarget];
            if (it) {
                var callback = it.keyUpCallbacks[k];
                if (callback) callback();
            }
        }, false);
    }

    yokingViewAcrossPanels() {
        if (!this.yokingView) return;

        var activeInput = this.inputTargets[this.activeTarget];
        if (activeInput) {
            var rotation = null;
            var callback = activeInput.getRotationCallback;
            if (callback) rotation = callback();
            if (rotation) {
                for (var i = 0; i < this.inputTargets.length; i++) {
                    if (i != this.activeTarget) {
                        var input = this.inputTargets[i];
                        if (input) {
                            callback = input.setRotationCallback;
                            if (callback) callback(rotation);
                        }
                    }
                }
            }

        }
    }

    translateKeycode(code) {
        if (code >= 65 && code < 65 + 26)
            return "abcdefghijklmnopqrstuvwxyz"[code - 65];
        if (code >= 48 && code < 48 + 10)
            return "0123456789"[code - 48];
        if (code >= 37 && code <= 40)
            return "AWDS"[code - 37];

        if (code == 32)
            return ' ';
        if (code == 27)
            return 0x1B;
        if (code == 192)
            return '`';
        if (code == 13)
            return '\n';
        if (code == 59)
            return ';';
        if (code == 61)
            return '=';
        if (code == 173)
            return '-';

        return code;
    }

    update(deltaTime: number) {
        // Make callbacks for keys held down
        Object.keys(this.keyboardKey).forEach((key) => {
            if (this.keyboardKey[key]) {
                var it = this.inputTargets[this.activeTarget];
                if (it) {
                    var callback = it.keyTickCallbacks[key];
                    if (callback) callback(deltaTime);

                    if (this.yokingView) this.yokingViewAcrossPanels();
                }
            }
        });

        // Gets the position of the finger on the screen in pixels from the top-left corner.
        var getFingerOnScreen = (finger) => {
            var pos = finger.tipPosition.slice(0);
            var dir = finger.direction;

            // Get the position of the finger tip relative to screen centre
            pos[1] += leapHeight - screenHeight / 2;
            pos[2] += leapDistance;
            // Follow finger tip over to screen surface
            var factor = -pos[2] / dir[2];
            pos[0] += dir[0] * factor;
            pos[1] += dir[1] * factor;
            pos[2] += dir[2] * factor;
            // pos[0] & pos[1] are now mm from screen centre
            // Calculate the pointing position on the screen in pixels from the top left (same format as mouse)
            this.fingerPositions[this.fpi] = [(pos[0] + (0.5 * screenWidth)) / screenWidth * window.innerWidth, (-pos[1] + (0.5 * screenHeight)) / screenHeight * window.innerHeight];
            this.fpi = (this.fpi + 1) % this.fingerSmoothingLevel;
            var smoothed = averageOfVectors(this.fingerPositions, this.fingerSmoothingLevel);

            var coords = new THREE.Vector2();
            coords.x = smoothed[0];
            coords.y = smoothed[1];
            return coords;
        };

        // Works out the gestures currently being performed by the given hand
        var checkHandInput = (hand) => {
            var fingers = hand.fingers;

            if (fingers.length === 1) {
                this.currentPointer.ptr = this.fingerPointer;
                this.pointerImage.show();

                // Try and claim this hand as the pointing hand
                if (this.pointingHandID === -1) {
                    this.pointingHandID = hand.id;
                }

                if (this.pointingHandID === hand.id) {
                    this.pointingHandCheckedIn = true;
                    if ((<any>this.fingerPointer).id !== fingers[0].id) {
                        // Give a few frames slack if we can't find the finger we had before
                        if (this.fingerLostLenience > 0) {
                            --this.fingerLostLenience;
                            return;
                        }
                        else {
                            (<any>this.fingerPointer).id = fingers[0].id;
                        }
                    }
                    this.fingerLostLenience = this.maxFingerLostLenience;
                    this.fingerPointer.copy(getFingerOnScreen(fingers[0]));
                    this.pointerImage.updatePosition(this.fingerPointer);
                }
            }
            else if (this.pointingHandID === hand.id && fingers.length === 2) {
                // If we see two fingers but one is the finger we were already tracking,
                // ignore the second finger.
                this.pointingHandCheckedIn = true;
                if (fingers[0].id === (<any>this.fingerPointer).id) {
                    this.fingerPointer.copy(getFingerOnScreen(fingers[0]));
                    //console.log("Lenient.");
                }
                else if (fingers[1].id === (<any>this.fingerPointer).id) {
                    this.fingerPointer.copy(getFingerOnScreen(fingers[1]));
                    //console.log("Lenient.");
                }
            }

            if (this.pointingHandID === -1) {
                if (hands.length === 1 && fingers.length >= 4) {
                    // Make callbacks for hand motion
                    var t = hand.translation(this.leap.frame(1));
                    if (t[0] != 0) {
                        var it = this.inputTargets[this.activeTarget];
                        if (it) {
                            if (it.leapXCallback) it.leapXCallback(t[0]);
                        }
                    }
                    if (t[1] != 0) {
                        var it = this.inputTargets[this.activeTarget];
                        if (it) {
                            if (it.leapYCallback) it.leapYCallback(t[1]);
                        }
                    }
                    if (t[2] != 0) {
                        var it = this.inputTargets[this.activeTarget];
                        if (it) {
                            if (it.leapZCallback) it.leapZCallback(t[2]);
                        }
                    }
                }
            }
            /*
            else if (this.pointingHandID !== hand.id) {
                this.grabbingHandCheckedIn = true;
                if (this.grabWarmup === -1) {
                    if (fingers.length < 2) {
                        this.grabWarmup = this.maxGrabWarmup;
                    }
                }
                else if (fingers.length >= 4) {
                    releaseGrab();
                    this.grabWarmup = -1;
                }
                else if (grabWarmup > 0) {
                    this.grabWarmup -= deltaTime;
                }
                else if (this.grabWarmup !== -2) {
                    this.grabWarmup = -2;
                    selectWithCurrentPointer();
                }
            }
            */
        }

        // Check for hand motions and gestures

        var hands = this.leap.frame(0).hands;
        if (hands.length > 0) {
            checkHandInput(hands[0]);
            if (hands.length > 1)
                checkHandInput(hands[1]);
        }

        // Missing hands (or missing gestures) are addressed here,
        // with a grace period for their return
        if (this.pointingHandID !== -1) {
            if (!this.pointingHandCheckedIn) {
                --this.pointingHandLenience;
                if (this.pointingHandLenience < 0) {
                    this.pointingHandID = -1;
                }
            }
            else this.pointingHandLenience = this.maxPointingHandLenience;

            /*
            if (!this.grabbingHandCheckedIn && this.grabbedNode != null) {
                --this.grabbingHandLenience;
                if (this.grabbingHandLenience < 0) {
                    this.releaseGrab();
                }
            }
            else this.grabbingHandLenience = this.maxGrabbingHandLenience;
            */
        }
        this.pointingHandCheckedIn = false;
        //this.grabbingHandCheckedIn = false;
    }

    setActiveTarget(index: number) {
        this.activeTarget = index;
    }

    // Return a function that can be used to create a new input target with the specified border sizes.
    // This is intended to be passed to an application so they can set their own borders.
    newTarget(index: number): (l: number, r: number, t: number, b: number) => InputTarget {
        return (leftBorder = 0, rightBorder = 0, topBorder = 0, bottomBorder = 0) => {
            // Create the input target and return it
            return this.inputTargets[index] = new InputTarget(this.targetCssIds[index], this.currentPointer, leftBorder, rightBorder, topBorder, bottomBorder);
        };
    }
}

function averageOfVectors(vectors, numVectors) {
    var result = new Array();
    for (var i = 0; i < vectors[0].length; ++i) {
        result[i] = 0;
        for (var j = 0; j < numVectors; ++j)
            result[i] += vectors[j][i];
        result[i] /= numVectors;
    }
    return result;
}

function clearSelection() {
    if (document.selection && document.selection.empty) {
        document.selection.empty();
    } else if (window.getSelection) {
        var sel = window.getSelection();
        sel.removeAllRanges();
    }
}