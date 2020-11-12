
describe("matrix performance", () => {
    test("matrix perf experiment", function () {
        console.log("Array test:");
        const repeats = 1000, n = 100;
        let startTime: number, M: number[][], MT: Float32Array[], description: string;
        const time = (desc: string, func: () => void) => {
            description = desc;
            startTime = window.performance.now();
            func();
            const t = window.performance.now() - startTime
            console.log(`${description} = ${t}`)
            return t;
        }

        let totalRegularArrayTime = time("init matrix", () => {
            for (var k = 0; k < repeats; ++k) {
                M = new Array(n);
                for (var i = 0; i < n; ++i) {
                    M[i] = new Array(n);
                }
            }
        });

        totalRegularArrayTime += time("write array", () => {
            for (var k = 0; k < repeats; ++k) {
                for (var i = 0; i < n; ++i) {
                    for (var j = 0; j < n; ++j) {
                        M[i][j] = 1;
                    }
                }
            }
        });

        totalRegularArrayTime += time("read array", () => {
            for (var k = 0; k < repeats; ++k) {
                var sum = 0;
                for (var i = 0; i < n; ++i) {
                    for (var j = 0; j < n; ++j) {
                        sum += M[i][j];
                    }
                }
                expect(sum).toBe(n * n);
            }
        });
    
        console.log("Typed Array test:");
        let totalTypedArrayTime = time("init", () => {
            MT = new Array<Float32Array>(n);
            for (var k = 0; k < repeats; ++k) {
                for (var i = 0; i < n; ++i) {
                    MT[i] = new Float32Array(n);
                }
            }
        });
    
        totalTypedArrayTime += time("write array", () => {
            for (var k = 0; k < repeats; ++k) {
                for (var i = 0; i < n; ++i) {
                    for (let j = 0; j < n; ++j) {
                        MT[i][j] = 1;
                    }
                }
            }
        });
    
        totalTypedArrayTime += time("read array", () => {
            for (var k = 0; k < repeats; ++k) {
                var sum = 0;
                for (var i = 0; i < n; ++i) {
                    for (let j = 0; j < n; ++j) {
                        sum += MT[i][j];
                    }
                }
                expect(sum).toBe(n * n);
            }
        });
        expect(totalRegularArrayTime > totalTypedArrayTime || "totalRegularArrayTime=" + totalRegularArrayTime + " totalTypedArrayTime=" + totalTypedArrayTime + " - if this consistently fails then maybe we should switch to typed arrays").toBe(true);
    });
});