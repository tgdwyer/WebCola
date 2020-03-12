"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var QUnit = require("qunit");
QUnit.module("matrix performance");
QUnit.test("matrix perf experiment", function (assert) {
    console.log("Array test:");
    var repeats = 1000, n = 100;
    var startTime, M, MT, description;
    var time = function (desc, func) {
        description = desc;
        startTime = window.performance.now();
        func();
        var t = window.performance.now() - startTime;
        console.log(description + " = " + t);
        return t;
    };
    var totalRegularArrayTime = time("init matrix", function () {
        for (var k = 0; k < repeats; ++k) {
            M = new Array(n);
            for (var i = 0; i < n; ++i) {
                M[i] = new Array(n);
            }
        }
    });
    totalRegularArrayTime += time("write array", function () {
        for (var k = 0; k < repeats; ++k) {
            for (var i = 0; i < n; ++i) {
                for (var j = 0; j < n; ++j) {
                    M[i][j] = 1;
                }
            }
        }
    });
    totalRegularArrayTime += time("read array", function () {
        for (var k = 0; k < repeats; ++k) {
            var sum = 0;
            for (var i = 0; i < n; ++i) {
                for (var j = 0; j < n; ++j) {
                    sum += M[i][j];
                }
            }
            assert.equal(sum, n * n);
        }
    });
    console.log("Typed Array test:");
    var totalTypedArrayTime = time("init", function () {
        MT = new Array(n);
        for (var k = 0; k < repeats; ++k) {
            for (var i = 0; i < n; ++i) {
                MT[i] = new Float32Array(n);
            }
        }
    });
    totalTypedArrayTime += time("write array", function () {
        for (var k = 0; k < repeats; ++k) {
            for (var i = 0; i < n; ++i) {
                for (var j = 0; j < n; ++j) {
                    MT[i][j] = 1;
                }
            }
        }
    });
    totalTypedArrayTime += time("read array", function () {
        for (var k = 0; k < repeats; ++k) {
            var sum = 0;
            for (var i = 0; i < n; ++i) {
                for (var j = 0; j < n; ++j) {
                    sum += MT[i][j];
                }
            }
            assert.equal(sum, n * n);
        }
    });
    assert.ok(totalRegularArrayTime < totalTypedArrayTime, "totalRegularArrayTime=" + totalRegularArrayTime + " totalTypedArrayTime=" + totalTypedArrayTime + " - if this consistently fails then maybe we should switch to typed arrays");
});
//# sourceMappingURL=matrixperftest.js.map