module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);
  require('./tasks/examples')(grunt);
  grunt.loadNpmTasks('typedoc');
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      default: {
        files: ["<%= concat.dist.src %>", "Gruntfile.js", "templates/*"],
        tasks: ["default"]
      },
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
      examples: {
        src: ['WebCola/examples/*.ts'],
        options: {
          module: 'amd',
          target: 'es5',
          sourceMap: true
        }
      }
    },
    concat: {
      options: {},
      dist: {
        src: [
          'WebCola/src/rbtree.js',
          'WebCola/src/scc.js',
          'WebCola/cola.js',
        ],
        dest: 'WebCola/cola.js'
      }
    },
    umd: {
      all: {
        src: '<%= concat.dist.dest %>',
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
            '<%= concat.dist.dest %>'
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
 
  grunt.registerTask('default', ['typescript:base', 'concat', 'uglify', 'qunit']);
  grunt.registerTask('nougly', ['typescript:base', 'concat', 'qunit']);
  grunt.registerTask('nougly-notest', ['typescript', 'concat']);
  grunt.registerTask('docs', ['typedoc', 'typescript:examples']);
  grunt.registerTask('examples', ['typescript:examples']);
  grunt.registerTask('full', ['default', 'typescript:examples', 'examples']);
};
