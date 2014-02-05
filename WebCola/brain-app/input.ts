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
* the mouse, keyboard, and Leap Motion.
*/

declare var Leap;

class InputTarget {
    active: boolean = false;
    keyDownCallbacks = {};
    keyUpCallbacks = {};
    keyTickCallbacks = {};

    constructor(public targetCssId: string, public mouse) {}

    regKeyDownCallback(key: string, callback: () => void) {
        this.keyDownCallbacks[key] = callback;
    }

    regKeyUpCallback(key: string, callback: () => void) {
        this.keyUpCallbacks[key] = callback;
    }

    regKeyTickCallback(key: string, callback: (number) => void) {
        this.keyTickCallbacks[key] = callback;
    }

    localMousePosition() {
        var target = $(this.targetCssId);
        var pos = target.offset();
        return new THREE.Vector2((this.mouse.x - pos.left) / target.width() * 2 - 1, (pos.top - this.mouse.y) / target.height() * 2 + 1);
    }
}

class InputTargetManager {
    loop;
    mouse = new THREE.Vector2(-999999, -999999);
    keyboardKey = {};
    leap;
    prevLeapFrame;
    currLeapFrame;
    currentPointer; // Mouse or Leap
    inputTargets: Array<InputTarget>;

    constructor(targetCssIds: Array<string>) {
        this.loop = new Loop(this, Number.POSITIVE_INFINITY);

        var numTargets = targetCssIds.length;
        this.inputTargets = new Array(numTargets);
        for (var i = 0; i < numTargets; ++i) {
            this.inputTargets[i] = new InputTarget(targetCssIds[i], this.mouse);
        }
        this.currentPointer = this.mouse;

        // Leap controller variables
        this.leap = new Leap.Controller();
        this.leap.on('deviceConnected', function () {
            console.log("The Leap device has been connected.");
        });
        this.leap.on('deviceDisconnected', function () {
            console.log("The Leap device has been disconnected.");
        });

        this.leap.connect();
        this.prevLeapFrame = this.leap.frame(0);
        this.currLeapFrame = this.leap.frame(0);

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

        document.addEventListener('mousemove', (event) => {
            event.preventDefault();
            this.currentPointer = this.mouse;
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
                // Make the callbacks for all active input targets
                this.inputTargets.forEach(function(target: InputTarget) {
                    if (target.active) {
                        var callback = target.keyDownCallbacks[k];
                        if (callback) callback();
                    }
                });
            }
        }, false);

        document.addEventListener('keyup', (evt) => {
            var k = this.translateKeycode(evt.keyCode);
            this.keyboardKey[k] = false;
            //this.keyboardKeyReleased[k] = true;
            // Make the callbacks for all active input targets
            this.inputTargets.forEach(function(target: InputTarget) {
                if (target.active) {
                    var callback = target.keyUpCallbacks[k];
                    if (callback) callback();
                }
            });
        }, false);
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
        // Fetch new Leap frames
        this.prevLeapFrame = this.currLeapFrame;
        this.currLeapFrame = this.leap.frame();

        Object.keys(this.keyboardKey).forEach((key) => {
            if (this.keyboardKey[key]) {
                this.inputTargets.forEach(function(target: InputTarget) {
                    if (target.active) {
                        var callback = target.keyTickCallbacks[key];
                        if (callback) callback(deltaTime);
                    }
                });
            }
        });
    }

    setActiveTarget(index: number) {
        this.inputTargets.forEach(function (target) {
            target.active = false;
        });
        this.inputTargets[index].active = true;
    }

    getTarget(index: number) {
        return this.inputTargets[index];
    }
}