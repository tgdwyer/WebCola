declare class Iterator<T> {
    next(): T;
    prev(): T;
}
declare class RBTree<T> {
    constructor(comparator: (a: T, b: T) => number);
    insert(data: T): bool;
    remove(data: T): bool;
    findIter(data: T): Iterator<T>;
    iterator(): Iterator<T>;
    size: number;
}