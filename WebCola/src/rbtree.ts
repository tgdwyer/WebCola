module cola.vpsc {
    //Based on js_es:
    //
    //https://github.com/vadimg/js_bintrees
    //
    //Copyright (C) 2011 by Vadim Graboys
    //
    //Permission is hereby granted, free of charge, to any person obtaining a copy
    //of this software and associated documentation files (the "Software"), to deal
    //in the Software without restriction, including without limitation the rights
    //to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    //copies of the Software, and to permit persons to whom the Software is
    //furnished to do so, subject to the following conditions:
    //
    //The above copyright notice and this permission notice shall be included in
    //all copies or substantial portions of the Software.
    //
    //THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    //IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    //FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    //AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    //LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    //OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    //THE SOFTWARE.
    export class TreeBase {
        _root;
        size;
        _comparator;
        // removes all nodes from the tree
        clear() {
            this._root = null;
            this.size = 0;
        };

        // returns node data if found, null otherwise
        find(data) {
            var res = this._root;

            while (res !== null) {
                var c = this._comparator(data, res.data);
                if (c === 0) {
                    return res.data;
                }
                else {
                    res = res.get_child(c > 0);
                }
            }

            return null;
        };

        // returns iterator to node if found, null otherwise
        findIter = function (data) {
            var res = this._root;
            var iter = this.iterator();

            while (res !== null) {
                var c = this._comparator(data, res.data);
                if (c === 0) {
                    iter._cursor = res;
                    return iter;
                }
                else {
                    iter._ancestors.push(res);
                    res = res.get_child(c > 0);
                }
            }

            return null;
        };

        // Returns an interator to the tree node immediately before (or at) the element
        lowerBound(data) {
            return this._bound(data, this._comparator);
        };

        // Returns an interator to the tree node immediately after (or at) the element
        upperBound(data) {
            var cmp = this._comparator;

            function reverse_cmp(a, b) {
                return cmp(b, a);
            }

            return this._bound(data, reverse_cmp);
        };

        // returns null if tree is empty
        min() {
            var res = this._root;
            if (res === null) {
                return null;
            }

            while (res.left !== null) {
                res = res.left;
            }

            return res.data;
        };

        // returns null if tree is empty
        max() {
            var res = this._root;
            if (res === null) {
                return null;
            }

            while (res.right !== null) {
                res = res.right;
            }

            return res.data;
        };

        // returns a null iterator
        // call next() or prev() to point to an element
        iterator(): Iterator {
            return new Iterator(this);
        };

        // calls cb on each node's data, in order
        each(cb) {
            var it = this.iterator(), data;
            while ((data = it.next()) !== null) {
                cb(data);
            }
        };

        // calls cb on each node's data, in reverse order
        reach(cb) {
            var it = this.iterator(), data;
            while ((data = it.prev()) !== null) {
                cb(data);
            }
        };

        // used for lowerBound and upperBound
        _bound(data, cmp) {
            var cur = this._root;
            var iter = this.iterator();

            while (cur !== null) {
                var c = this._comparator(data, cur.data);
                if (c === 0) {
                    iter._cursor = cur;
                    return iter;
                }
                iter._ancestors.push(cur);
                cur = cur.get_child(c > 0);
            }

            for (var i = iter._ancestors.length - 1; i >= 0; --i) {
                cur = iter._ancestors[i];
                if (cmp(data, cur.data) > 0) {
                    iter._cursor = cur;
                    iter._ancestors.length = i;
                    return iter;
                }
            }

            iter._ancestors.length = 0;
            return iter;
        };
    }
    export class Iterator {
        _tree;
        _ancestors;
        _cursor;
        constructor(tree) {
            this._tree = tree;
            this._ancestors = [];
            this._cursor = null;
        }

        data() {
            return this._cursor !== null ? this._cursor.data : null;
        };

        // if null-iterator, returns first node
        // otherwise, returns next node
        next() {
            if (this._cursor === null) {
                var root = this._tree._root;
                if (root !== null) {
                    this._minNode(root);
                }
            }
            else {
                if (this._cursor.right === null) {
                    // no greater node in subtree, go up to parent
                    // if coming from a right child, continue up the stack
                    var save;
                    do {
                        save = this._cursor;
                        if (this._ancestors.length) {
                            this._cursor = this._ancestors.pop();
                        }
                        else {
                            this._cursor = null;
                            break;
                        }
                    } while (this._cursor.right === save);
                }
                else {
                    // get the next node from the subtree
                    this._ancestors.push(this._cursor);
                    this._minNode(this._cursor.right);
                }
            }
            return this._cursor !== null ? this._cursor.data : null;
        };

        // if null-iterator, returns last node
        // otherwise, returns previous node
        prev() {
            if (this._cursor === null) {
                var root = this._tree._root;
                if (root !== null) {
                    this._maxNode(root);
                }
            }
            else {
                if (this._cursor.left === null) {
                    var save;
                    do {
                        save = this._cursor;
                        if (this._ancestors.length) {
                            this._cursor = this._ancestors.pop();
                        }
                        else {
                            this._cursor = null;
                            break;
                        }
                    } while (this._cursor.left === save);
                }
                else {
                    this._ancestors.push(this._cursor);
                    this._maxNode(this._cursor.left);
                }
            }
            return this._cursor !== null ? this._cursor.data : null;
        };

        _minNode(start) {
            while (start.left !== null) {
                this._ancestors.push(start);
                start = start.left;
            }
            this._cursor = start;
        };

        _maxNode(start) {
            while (start.right !== null) {
                this._ancestors.push(start);
                start = start.right;
            }
            this._cursor = start;
        };
    }

    class Node {
        data;
        left;
        right;
        red;
        constructor(data) {
            this.data = data;
            this.left = null;
            this.right = null;
            this.red = true;
        }

        get_child(dir) {
            return dir ? this.right : this.left;
        };

        set_child(dir, val) {
            if (dir) {
                this.right = val;
            }
            else {
                this.left = val;
            }
        };
    }

    export class RBTree<T> extends TreeBase {

        _root;
        _comparator;
        size;
        constructor(comparator: (a: T, b: T) => number) {
            super();
            this._root = null;
            this._comparator = comparator;
            this.size = 0;
        }

        // returns true if inserted, false if duplicate
        insert(data) {
            var ret = false;

            if (this._root === null) {
                // empty tree
                this._root = new Node(data);
                ret = true;
                this.size++;
            }
            else {
                var head = new Node(undefined); // fake tree root

                var dir = false;
                var last = false;

                // setup
                var gp = null; // grandparent
                var ggp = head; // grand-grand-parent
                var p = null; // parent
                var node = this._root;
                ggp.right = this._root;

                // search down
                while (true) {
                    if (node === null) {
                        // insert new node at the bottom
                        node = new Node(data);
                        p.set_child(dir, node);
                        ret = true;
                        this.size++;
                    }
                    else if (RBTree.is_red(node.left) && RBTree.is_red(node.right)) {
                        // color flip
                        node.red = true;
                        node.left.red = false;
                        node.right.red = false;
                    }

                    // fix red violation
                    if (RBTree.is_red(node) && RBTree.is_red(p)) {
                        var dir2 = ggp.right === gp;

                        if (node === p.get_child(last)) {
                            ggp.set_child(dir2, RBTree.single_rotate(gp, !last));
                        }
                        else {
                            ggp.set_child(dir2, RBTree.double_rotate(gp, !last));
                        }
                    }

                    var cmp = this._comparator(node.data, data);

                    // stop if found
                    if (cmp === 0) {
                        break;
                    }

                    last = dir;
                    dir = cmp < 0;

                    // update helpers
                    if (gp !== null) {
                        ggp = gp;
                    }
                    gp = p;
                    p = node;
                    node = node.get_child(dir);
                }

                // update root
                this._root = head.right;
            }

            // make root black
            this._root.red = false;

            return ret;
        };

        // returns true if removed, false if not found
        remove(data) {
            if (this._root === null) {
                return false;
            }

            var head = new Node(undefined); // fake tree root
            var node = head;
            node.right = this._root;
            var p = null; // parent
            var gp = null; // grand parent
            var found = null; // found item
            var dir = true;

            while (node.get_child(dir) !== null) {
                var last = dir;

                // update helpers
                gp = p;
                p = node;
                node = node.get_child(dir);

                var cmp = this._comparator(data, node.data);

                dir = cmp > 0;

                // save found node
                if (cmp === 0) {
                    found = node;
                }

                // push the red node down
                if (!RBTree.is_red(node) && !RBTree.is_red(node.get_child(dir))) {
                    if (RBTree.is_red(node.get_child(!dir))) {
                        var sr = RBTree.single_rotate(node, dir);
                        p.set_child(last, sr);
                        p = sr;
                    }
                    else if (!RBTree.is_red(node.get_child(!dir))) {
                        var sibling = p.get_child(!last);
                        if (sibling !== null) {
                            if (!RBTree.is_red(sibling.get_child(!last)) && !RBTree.is_red(sibling.get_child(last))) {
                                // color flip
                                p.red = false;
                                sibling.red = true;
                                node.red = true;
                            }
                            else {
                                var dir2 = gp.right === p;

                                if (RBTree.is_red(sibling.get_child(last))) {
                                    gp.set_child(dir2, RBTree.double_rotate(p, last));
                                }
                                else if (RBTree.is_red(sibling.get_child(!last))) {
                                    gp.set_child(dir2, RBTree.single_rotate(p, last));
                                }

                                // ensure correct coloring
                                var gpc = gp.get_child(dir2);
                                gpc.red = true;
                                node.red = true;
                                gpc.left.red = false;
                                gpc.right.red = false;
                            }
                        }
                    }
                }
            }

            // replace and remove if found
            if (found !== null) {
                found.data = node.data;
                p.set_child(p.right === node, node.get_child(node.left === null));
                this.size--;
            }

            // update root and make it black
            this._root = head.right;
            if (this._root !== null) {
                this._root.red = false;
            }

            return found !== null;
        };

        static is_red(node) {
            return node !== null && node.red;
        }

        static single_rotate(root, dir) {
            var save = root.get_child(!dir);

            root.set_child(!dir, save.get_child(dir));
            save.set_child(dir, root);

            root.red = true;
            save.red = false;

            return save;
        }

        static double_rotate(root, dir) {
            root.set_child(!dir, RBTree.single_rotate(root.get_child(!dir), !dir));
            return RBTree.single_rotate(root, dir);
        }
    }
}