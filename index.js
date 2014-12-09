var extend 							= require('xtend');
var linklengths 				= require('./lib/linklengths');
var handleDisconnected 	= require('./lib/handle_disconnected');
var rectangle 					= require('./lib/rectangle');
var vpsc 								= require('./lib/vpsc');

var cola = {
	Locks: require('./lib/locks').Locks,
	Descent: require('./lib/descent').Descent,
	geom: require('./lib/geom'),
	GridRouter: require('./lib/gridrouter').GridRouter,
	LongestCommonSubsequence: require('./lib/longest-common-subsequence').LongestCommonSubsequence,
	powergraph: require('./lib/powergraph'),
	PseudoRandom: require('./lib/pseudo-random').PseudoRandom,
	vpsc: extend(vpsc, rectangle),
	shortestpaths: require('./lib/shortestpaths')
}

cola = module.exports = extend(cola, linklengths, handleDisconnected);

