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
    typescript: {
      base: {
        src: ['WebCola/src/*.ts'],
        dest: 'WebCola/cola.js',
        options: {
          module: 'amd',
          target: 'es5',
          sourceMap: true
        }
      },
      test: {
        src: ['WebCola/test/*.ts'],
        options: {
          module: 'amd',
          target: 'es5',
          sourceMap: true
        }
      },
      commonjs: {
        src: ['WebCola/index.ts'],
        dest: 'WebCola/index.js',
        options: {
          module: 'commonjs',
          target: 'es5'
        }
      },
      examples: {
        src: ['WebCola/examples/*.ts'],
        options: {
          module: 'amd',
          target: 'es5',
          sourceMap: true
        }
      }
    },
    dtsGenerator: {
        options: {
            name: 'cola',
            baseDir: 'WebCola',
            out: 'WebCola/cola.d.ts',
	    excludes: ['extern/d3.d.ts']
        },
        default: {
            src: [ 'WebCola/src/*.ts' ]
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
            '<%= typescript.base.dest %>'
          ]
        }
      }
    },
    qunit: {
      all: ['WebCola/test/*.html']
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
      src: ["<%= typescript.base.src %>"]
    }
  });
 
  grunt.registerTask('default', ['copy', 'typescript', 'uglify', 'qunit']);
  grunt.registerTask('nougly', ['typescript', 'qunit']);
  grunt.registerTask('nougly-notest', ['typescript']);
  grunt.registerTask('docs', ['typedoc', 'typescript:examples']);
  grunt.registerTask('examples', ['typescript:examples']);
  grunt.registerTask('full', ['default', 'typescript:examples', 'examples']);
};
