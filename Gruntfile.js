module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);
  require('./tasks/examples')(grunt);
  grunt.loadNpmTasks('typedoc');
  grunt.loadNpmTasks('dts-generator');
  grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      copy: {
          d3: {
              src: 'node_modules/d3/d3.min.js',
              dest: 'WebCola/extern/d3.min.js'
          },
          qunit: {
              src: 'node_modules/qunitjs/qunit/*',
              dest: 'WebCola/test/'
          },
      },
    watch: {
      typescript: {
        files: ["<%= typescript.base.src %>","<%= typescript.examples.src %>"],
        tasks: ["typescript"]
      },
      test: {
        files: ["WebCola/test/*.js"],
        tasks: ["qunit"]
      }
    },
    browserify: {
      dist: {
        options: {
          browserifyOptions: {
            standalone: 'cola'
          }
        },
        files: {
          'WebCola/cola.js': ['WebCola/index.js']
        }
      },
      test: {
        files: {
          'WebCola/test/bundle.js': ['WebCola/test/vpsctests.js', 'WebCola/test/apitests.js', 'WebCola/test/tests.js', '!WebCola/test/bundle.js']
        }
      }
    },
    ts: {
      commonjs: {
        src: 'WebCola/index.ts',
        options: {
          failOnTypeErrors: false,
          sourceMap: true,
          target: 'es5'
        }
      },
      test: {
        src: ['WebCola/test/*.ts', '!WebCola/index.ts', '!WebCola/src/batch.ts'],
        options: {
          failOnTypeErrors: false,
          target: 'es5',
          sourceMap: true
        }
      },
      examples: {
        src: ['WebCola/examples/*.ts', '!WebCola/index.ts', '!WebCola/src/batch.ts'],
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
            excludes: ['extern/d3.d.ts']
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
      options: {
          module: 'amd',
          target: 'es5',
          out: 'doc/',
          name: 'WebCoLa AKA cola.js',
          theme: 'minimal'
      },
      src: ["<%= ts.base.src %>"]
    },
    connect: {
      server: {
        options: {
          port: 1337,
          base: './WebCola',
          keepalive: true
        }
      }
    }
  });

  grunt.registerTask('default', ['copy', 'ts', 'browserify', 'uglify', 'qunit']);
  grunt.registerTask('nougly', ['ts', 'browserify', 'qunit']);
  grunt.registerTask('nougly-notest', ['ts']);
  grunt.registerTask('docs', ['typedoc', 'ts:examples']);
  grunt.registerTask('examples', ['ts:examples']);
  grunt.registerTask('full', ['default', 'ts:examples', 'examples']);
};
