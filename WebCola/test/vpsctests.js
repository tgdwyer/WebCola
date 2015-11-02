var vpsctestcases = [{
    description: "no splits",
    variables: [
        { desiredPosition: 2 },
        { desiredPosition: 9 },
        { desiredPosition: 9 },
        { desiredPosition: 9 },
        { desiredPosition: 2 }],
    constraints: [
        { "left": 0, "right": 4, "gap": 3 },
        { "left": 0, "right": 1, "gap": 3 },
        { "left": 1, "right": 2, "gap": 3 },
        { "left": 2, "right": 4, "gap": 3 },
        { "left": 3, "right": 4, "gap": 3 }
    ],
    expected: [1.4, 4.4, 7.4, 7.4, 10.4]
},
{
    description: "simple scale",
    variables:
    [
        { desiredPosition: 0, weight: 1, scale: 2 },
        { desiredPosition: 0, weight: 1, scale: 1 }
    ], constraints: [
            { left: 0, right: 1, gap: 2 }
    ],
    expected: [-0.8, 0.4]
},
{
    description: "simple scale 2",
    variables: [
        { desiredPosition: 1, weight: 1, scale: 3 },
        { desiredPosition: 1, weight: 1, scale: 2 },
        { desiredPosition: 1, weight: 1, scale: 4 }
    ], constraints: [
        { left: 0, right: 1, gap: 2 },
        { left: 1, right: 2, gap: 2 }
    ],
    expected: [0.2623, 1.3934, 1.1967]
},
{
    description: "non-trivial merging",
    variables: [4, 6, 9, 2, 5],
    constraints: [
        { left: 0, right: 2, gap: 3 },
        { left: 0, right: 3, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 2, right: 3, gap: 3 },
        { left: 3, right: 4, gap: 3 }
    ],
    expected: [0.5, 6, 3.5, 6.5, 9.5]
},
{
    variables: [5, 6, 7, 4, 3],
    constraints: [
        { left: 0, right: 4, gap: 3 },
        { left: 1, right: 2, gap: 3 },
        { left: 2, right: 3, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 }
    ],
    expected: [5, 0.5, 3.5, 6.5, 9.5]
}
, {
    description: "split block to activate different constraint",
    variables: [7, 1, 6, 0, 2],
    constraints: [
        { left: 0, right: 3, gap: 3 },
        { left: 0, right: 1, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 2, right: 3, gap: 3 },
        { left: 3, right: 4, gap: 3 }
    ],
    expected: [0.8, 3.8, 0.8, 3.8, 6.8]
}, {
    description: "non-trivial split",
    variables: [0, 9, 1, 9, 5, 1, 2, 1, 6, 3],
    constraints: [
        { left: 0, right: 3, gap: 3 }, { left: 1, right: 8, gap: 3 },
        { left: 1, right: 6, gap: 3 }, { left: 2, right: 6, gap: 3 },
        { left: 3, right: 5, gap: 3 }, { left: 3, right: 6, gap: 3 },
        { left: 3, right: 7, gap: 3 }, { left: 4, right: 8, gap: 3 },
        { left: 4, right: 7, gap: 3 }, { left: 5, right: 8, gap: 3 },
        { left: 5, right: 7, gap: 3 }, { left: 5, right: 8, gap: 3 },
        { left: 6, right: 9, gap: 3 }, { left: 7, right: 8, gap: 3 },
        { left: 7, right: 9, gap: 3 }, { left: 8, right: 9, gap: 3 }],
    expected: [-3.71429, 4, 1, -0.714286, 2.28571, 2.28571, 7, 5.28571, 8.28571, 11.2857],
    precision: 3
}, {
    description: "Test 6",
    variables: [
        { desiredPosition: 7, weight: 1 },
        { desiredPosition: 0, weight: 1 },
        { desiredPosition: 3, weight: 1 },
        { desiredPosition: 1, weight: 1 },
        { desiredPosition: 4, weight: 1 }
    ],
    constraints: [
        { left: 0, right: 3, gap: 3 },
        { left: 0, right: 2, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 2, right: 3, gap: 3 },
        { left: 3, right: 4, gap: 3 }
    ],
    expected: [-0.75, 0, 2.25, 5.25, 8.25],
}, {
    description: "Test 7",
    variables: [
        { desiredPosition: 4, weight: 1 },
        { desiredPosition: 2, weight: 1 },
        { desiredPosition: 3, weight: 1 },
        { desiredPosition: 1, weight: 1 },
        { desiredPosition: 8, weight: 1 }
    ],
    constraints: [
        { left: 0, right: 4, gap: 3 },
        { left: 0, right: 2, gap: 3 },
        { left: 1, right: 3, gap: 3 },
        { left: 2, right: 3, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 }
    ],
    expected: [-0.5, 2, 2.5, 5.5, 8.5],
},
{
    description: "Test 8",
    variables: [
        { desiredPosition: 3, weight: 1 },
        { desiredPosition: 4, weight: 1 },
        { desiredPosition: 0, weight: 1 },
        { desiredPosition: 5, weight: 1 },
        { desiredPosition: 6, weight: 1 }
    ],
    constraints: [
        { left: 0, right: 1, gap: 3 },
        { left: 0, right: 2, gap: 3 },
        { left: 1, right: 2, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 2, right: 3, gap: 3 },
        { left: 2, right: 3, gap: 3 },
        { left: 3, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 }
    ],
    expected: [-2.4, 0.6, 3.6, 6.6, 9.6]
}, {
    description: "Test 9",
    variables: [
        { desiredPosition: 8, weight: 1 },
        { desiredPosition: 2, weight: 1 },
        { desiredPosition: 6, weight: 1 },
        { desiredPosition: 5, weight: 1 },
        { desiredPosition: 3, weight: 1 }],
    constraints: [
        { left: 0, right: 4, gap: 3 },
        { left: 0, right: 3, gap: 3 },
        { left: 1, right: 2, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 2, right: 3, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 }],
    expected: [3.6, 0.6, 3.6, 6.6, 9.6]
}, {
    description: "Test 10",
    variables: [
        { desiredPosition: 8.56215, weight: 1, scale: 4.99888 },
        { desiredPosition: 1.27641, weight: 1, scale: 8.06009 },
        { desiredPosition: 6.28523, weight: 1, scale: 1.06585 },
        { desiredPosition: 4.09743, weight: 1, scale: 0.924166 },
        { desiredPosition: 0.369025, weight: 1, scale: 6.12702 }],

    constraints: [
        { left: 0, right: 2, gap: 3 },
        { left: 0, right: 1, gap: 3 },
        { left: 0, right: 1, gap: 3 },
        { left: 1, right: 3, gap: 3 },
        { left: 1, right: 3, gap: 3 },
        { left: 1, right: 2, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 }],

    //expected: [-1,2,5,5,8],	
}, {
    description: "Test 11",
    variables: [
        { desiredPosition: 1.31591, weight: 1, scale: 9.02545 },
        { desiredPosition: 1.48155, weight: 1, scale: 3.68918 },
        { desiredPosition: 3.5091, weight: 1, scale: 2.07033 },
        { desiredPosition: 3.47131, weight: 1, scale: 8.75145 },
        { desiredPosition: 0.77374, weight: 1, scale: 0.967941 }],

    constraints: [
        { left: 0, right: 3, gap: 3 },
        { left: 0, right: 1, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 1, right: 2, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 }],

    //expected: [-1,2,5,5,8],	
}, {
    description: "Test 12",
    variables: [
        { desiredPosition: 2.83063, weight: 1, scale: 6.67901 },
        { desiredPosition: 6.81696, weight: 1, scale: 7.28642 },
        { desiredPosition: 9.27616, weight: 1, scale: 0.918345 },
        { desiredPosition: 3.4094, weight: 1, scale: 3.39673 },
        { desiredPosition: 2.92492, weight: 1, scale: 2.36269 }],
    constraints: [
        { left: 0, right: 3, gap: 3 },
        { left: 0, right: 2, gap: 3 },
        { left: 0, right: 1, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 1, right: 4, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 }],
}, {
    description: "Test 13",
    variables: [
        { desiredPosition: 0.485024, weight: 1, scale: 1 },
        { desiredPosition: 3.52714, weight: 1, scale: 1 },
        { desiredPosition: 4.01263, weight: 1, scale: 1 },
        { desiredPosition: 4.58524, weight: 1, scale: 1 },
        { desiredPosition: 5.40796, weight: 1, scale: 1 }],
    constraints: [
        { left: 0, right: 4, gap: 3 },
        { left: 0, right: 4, gap: 3 },
        { left: 0, right: 4, gap: 3 },
        { left: 0, right: 2, gap: 3 },
        { left: 1, right: 3, gap: 3 },
        { left: 1, right: 3, gap: 3 },
        { left: 1, right: 2, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 2, right: 4, gap: 3 },
        { left: 2, right: 3, gap: 3 },
        { left: 3, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 },
        { left: 3, right: 4, gap: 3 }],
    //expected: [-1,2,5,5,8],
}];