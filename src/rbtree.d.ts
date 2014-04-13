declare class Iterator<T> {
    next(): T;
    prev(): T;
}
declare class RBTree<T> {
    constructor(comparator: (a: T, b: T) => number);
    insert(data: T): boolean;
    remove(data: T): boolean;
    findIter(data: T): Iterator<T>;
    iterator(): Iterator<T>;
    size: number;
}