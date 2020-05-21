module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);
  require('./tasks/examples')(grunt);
  grunt.loadNpmTasks('grunt-typedoc');
  grunt.loadNpmTasks('dts-generator');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

      examples: {
        options: {
          browserifyOptions: {
            plugin: [
              [
                'tsify', { 
                  target: 'es6',
                  allowJs: true 
                },
              ]
            ],
            debug: true
          },
          transform: [["babelify", { "presets": ["es2015"] }]]
        },
        files: {
          'WebCola/examples/tmdbgraph.js': ['WebCola/examples/tmdbgraph.ts'],
          'WebCola/examples/3dlayout.js': ['WebCola/examples/3dlayout.ts'],
          'WebCola/examples/3dtree.js': ['WebCola/examples/3dtree.ts'],
          'WebCola/examples/dotpowergraph.js': ['WebCola/examples/dotpowergraph.ts'],
          'WebCola/examples/powergraphexample.js': ['WebCola/examples/powergraphexample.ts'],
          'WebCola/examples/pretrip.js': ['WebCola/examples/pretrip.ts'],
          'WebCola/examples/statemachinepowergraph.js': ['WebCola/examples/statemachinepowergraph.ts'],
          'WebCola/examples/tetrisbug.js': ['WebCola/examples/tetrisbug.ts'],
          'WebCola/examples/vhybridize.js': ['WebCola/examples/vhybridize.ts']
        }
      },
    },
    examples: {
      all: ["WebCola/examples/*.html"]
    },
  });

  grunt.registerTask('default', ['ts', 'browserify', 'uglify', 'qunit']);
  grunt.registerTask('nougly', ['ts', 'browserify', 'qunit']);
  grunt.registerTask('nougly-notest', ['ts']);
  grunt.registerTask('test', ['ts:test','browserify:test','qunit']);
  grunt.registerTask('examples', ['browserify:examples']);
  grunt.registerTask('docs', ['typedoc']);
  grunt.registerTask('full', ['default']);
};
