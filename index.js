var extend = require('xtend');
var linkLengths = require('./lib/linklengths');
var rectangle = require('./lib/rectangle');
var vspc = require('./lib/vspc');


var cola = {
	Locks: require('lib/locks'),
	Descent: require('./lib/descent'),
	geom: require('./lib/geom'),
	GridRouter: require('./gridrouter'),
	LongestCommonSubsequence: require('longest-common-subsequence'),
	powergraph: require('./lib/powergraph'),
	PseudoRandom: require('./pseudo-random'),
	vspc: extend(vspc, rectangle),
	shortestpaths: require('./lib/shortestpaths')
}

cola = module.exports = extend(cola, linklengths);

