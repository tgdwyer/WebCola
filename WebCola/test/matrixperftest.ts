import * as QUnit from 'qunit';
QUnit.test("matrix perf experiment", function (assert) {
    console.log("Array test:");
    const repeats = 1000, n = 100;
    let startTime: number, M: number[][], description: string;
    const startTimer = (desc: string) => {
        description = desc;
        startTime = window.performance.now();
    }
    const stopTimer = () => {
        const t = window.performance.now() - startTime
        console.log(`${description} = ${t}`)
        return t;
    } 

    startTimer("init matrix");
    for (var k = 0; k < repeats; ++k) {
        M = new Array(n);
        for (var i = 0; i < n; ++i) {
            M[i] = new Array(n);
        }
    }
    let totalRegularArrayTime = stopTimer();

    startTimer("write array");
    for (var k = 0; k < repeats; ++k) {
        for (var i = 0; i < n; ++i) {
            for (var j = 0; j < n; ++j) {
                M[i][j] = 1;
            }
        }
    }
    totalRegularArrayTime += stopTimer();

    startTimer("read array");
    for (var k = 0; k < repeats; ++k) {
        var sum = 0;
        for (var i = 0; i < n; ++i) {
            for (var j = 0; j < n; ++j) {
                sum += M[i][j];
            }
        }
        //equal(sum, n * n);
    }
    totalRegularArrayTime += stopTimer();

    console.log("Typed Array test:");
    startTimer("init");
    var MT;
    for (var k = 0; k < repeats; ++k) {
        MT = new Float32Array(n * n);
    }
    let totalTypedArrayTime = stopTimer();
    
    startTimer("write array");
    for (var k = 0; k < repeats; ++k) {
        for (var i = 0; i < n * n; ++i) {
            MT[i] = 1;
        }
    }
    totalTypedArrayTime += stopTimer();
    
    startTimer("read array");
    for (var k = 0; k < repeats; ++k) {
        var sum = 0;
        for (var i = 0; i < n * n; ++i) {
            sum += MT[i];
        }
        //equal(sum, n * n);
    }
    totalTypedArrayTime += stopTimer();
    assert.ok(isNaN(totalRegularArrayTime) || totalRegularArrayTime < totalTypedArrayTime, "totalRegularArrayTime=" + totalRegularArrayTime + " totalTypedArrayTime="+totalTypedArrayTime+" - if this consistently fails then maybe we should switch to typed arrays");
});