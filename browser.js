
var cola  = require('./index');

cola.d3adaptor = require('./lib/d3Adaptor');

window.cola = cola
window.PriorityQueue = require('./lib/pqueue').PriorityQueue;
window.RBTree = require('bintrees/lib/rbtree');