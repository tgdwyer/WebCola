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
"use strict";
var input = {};
(function (input) {
    input.mouse = new THREE.Vector2(-999999, -999999);
    input.currentPointer = input.mouse;

    // Leap controller variables
    input.leap = new Leap.Controller();

    input.leap.on('deviceConnected', function () {
        console.log("The Leap device has been connected.");
    });

    input.leap.on('deviceDisconnected', function () {
        console.log("The Leap device has been disconnected.");
    });

    input.leap.connect();

    input.prevLeapFrame = input.leap.frame(0);
    input.currLeapFrame = input.leap.frame(0);

    // Mouse input handling
    document.addEventListener('mousedown', function (event) {
        switch (event.which) {
            case 1:
                input.mouse.leftHeld = true;
                if (input.mouse.leftPressedCallback !== undefined)
                    input.mouse.leftPressedCallback();
                break;
            case 2:
                input.mouse.middleHeld = true;
                break;
            case 3:
                input.mouse.rightHeld = true;
        }
    });
    document.addEventListener('mouseup', function (event) {
        switch (event.which) {
            case 1:
                input.mouse.leftHeld = false;
                if (input.mouse.leftReleasedCallback !== undefined)
                    input.mouse.leftReleasedCallback();
                break;
            case 2:
                input.mouse.middleHeld = false;
                break;
            case 3:
                input.mouse.rightHeld = false;
        }
    });
    document.addEventListener('mousemove', function (event) {
        event.preventDefault();
        input.currentPointer = input.mouse;
        input.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        input.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }, false);

    // Keyboard input handling
    input.keyboard = {};
    input.keyboard.key = {};
    input.keyboard.keyToggle = {};
    input.keyboard.keyPressed = {};
    input.keyboard.keyReleased = {};

    function translateKeycode(code) {
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

    document.addEventListener('keydown', function (evt) {
        //evt.preventDefault(); // Don't do browser built-in search with key press
        var t = translateKeycode(evt.keyCode);

        if (!input.keyboard.key[t]) {
            input.keyboard.keyToggle[t] = !input.keyboard.keyToggle[t];
            input.keyboard.keyPressed[t] = true;
        }
        input.keyboard.key[t] = true;
    }, false);

    document.addEventListener('keyup', function (evt) {
        var t = translateKeycode(evt.keyCode);
        input.keyboard.key[t] = false;
        input.keyboard.keyReleased[t] = true;
    }, false);

    input.update = function () {
        // Fetch new Leap frames
        input.prevLeapFrame = input.currLeapFrame;
        input.currLeapFrame = input.leap.frame();
    };

    input.reset = function () {
        for (var t in input.keyboard.keyPressed) {
            input.keyboard.keyPressed[t] = false;
        }
        for (var t in input.keyboard.keyReleased) {
            input.keyboard.keyReleased[t] = false;
        }
    };

    return input;
})(input);