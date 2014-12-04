// Linear congruential pseudo random number generator
export class PseudoRandom {
    private a: number = 214013;
    private c: number = 2531011;
    private m: number = 2147483648;
    private range: number = 32767;

    constructor(public seed: number = 1) { }

    // random real between 0 and 1
    getNext(): number {
        this.seed = (this.seed * this.a + this.c) % this.m;
        return (this.seed >> 16) / this.range;
    }

    // random real between min and max
    getNextBetween(min: number, max: number) {
        return min + this.getNext() * (max - min);
    }
}