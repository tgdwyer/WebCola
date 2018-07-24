module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);
  require('./tasks/examples')(grunt);
  grunt.loadNpmTasks('grunt-typedoc');
  grunt.loadNpmTasks('dts-generator');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      scripts: {
        files: ["WebCola/src/*.ts"],
        tasks: ["browserify:dist"]
      },
      tests: {
        files: ["WebCola/test/*.ts","WebCola/test/*.js"],
        tasks: ["ts:test", "browserify:test", "qunit"]
      }
    },
    browserify: {
      dist: {
        options: {
          browserifyOptions: {
            // plugin: [
            //   [
            //     'tsify', { target: 'es6' },
            //   ]
            // ],
            standalone: 'cola',
            debug: true
          },
          // transform: [["babelify", { "presets": ["es2015"] }]]
        },
        files: {
          'WebCola/cola.js': ['dist/index.js']
        }
      },
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
      test: {
        files: {
          'WebCola/test/bundle.js': ['WebCola/test/vpsctests.js', 'WebCola/test/apitests.js', 'WebCola/test/tests.js', 'WebCola/test/routingtests.js','WebCola/test/gridrouting.js','!WebCola/test/bundle.js'/*,'WebCola/test/matrixperftest.js'*/]
        },
        options: {
          //browserifyOptions: { debug: true },
          transform: [["babelify", { "presets": ["es2015"] }]]
        }
      }
    },
    ts: {
      commonjs: {
        tsconfig: true,
        options: {
          inlineSourceMap: true
        }
      },
      test: {
        src: ['WebCola/test/*.ts', '!WebCola/index.ts', '!WebCola/src/batch.ts'],
        options: {
          failOnTypeErrors: false,
          target: 'es5',
          sourceMap: true
        }
      }
    },
    dtsGenerator: {
        options: {
            name: 'cola',
            baseDir: 'WebCola/src',
            out: 'WebCola/cola.d.ts',
            excludes: ['extern/d3v3.d.ts']
        },
        default: {
          src: ['WebCola/src/*.ts', '!WebCola/src/batch.ts', '!WebCola/src/cola.ts'],
        }
    },
    umd: {
      all: {
        src: '<%= dist.dest %>',
        template: 'templates/umd.hbs',
        objectToExport: 'cola',
        deps: {
          'default': ['d3']
        }
      }
    },
    uglify: {
      options: {
        sourceMap: true
      },
      dist: {
        files: {
          'WebCola/cola.min.js': [
            'WebCola/cola.js'
          ]
        }
      }
    },
    qunit: {
      all: ['WebCola/test/*.html'],
      options: {
        force: true
      }
    },
    examples: {
      all: ["WebCola/examples/*.html"]
    },
    typedoc: {
        build: {
          options: {
              module: 'commonjs',
              target: 'es5',
              out: 'doc/',
              name: 'WebCola',
              theme: 'minimal'
          },
          src: ["./WebCola/src/**/*.ts"]
        }
    },
    connect: {
      server: {
        options: {
          port: 8080,
          base: './WebCola',
          keepalive: true
        }
      }
    }
  });

  grunt.registerTask('default', ['ts', 'browserify', 'uglify', 'qunit']);
  grunt.registerTask('nougly', ['ts', 'browserify', 'qunit']);
  grunt.registerTask('nougly-notest', ['ts']);
  grunt.registerTask('test', ['ts:test','browserify:test','qunit']);
  grunt.registerTask('examples', ['browserify:examples']);
  grunt.registerTask('docs', ['typedoc']);
  grunt.registerTask('full', ['default']);
};
