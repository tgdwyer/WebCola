// Interface
interface IPoint {
    getDist(): number;
}

// Module
module Shapes {

    // Class
    export class Point implements IPoint {
        // Constructor
        constructor (public x: number, public y: number) { }

        // Instance member
        getDist() { return Math.sqrt(this.x * this.x + this.y * this.y); }

        // Static member
        static origin = new Point(0, 0);
    }

    export class A {
        public b: B;
        constructor(b: B) {
            this.b = b;
        }
    }

    export class B {
        public a: A;
        constructor() {
            this.a = new A(this);
        }
    }
}

// Local variables
var p: IPoint = new Shapes.Point(3, 4);
var dist = p.getDist();