module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);
  require('./tasks/examples')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      default: {
        files: ["<%= concat.dist.src %>", "Gruntfile.js", "templates/*"],
        tasks: ["default"]
      },
      typescript: {
        files: ["<%= typescript.base.src %>"],
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
          sourceMap: false
        }
      },
      examples: {
        src: ['WebCola/examples/*.ts'],
        options: {
          module: 'amd',
          target: 'es5',
          sourceMap: false
        }
      }
    },
    concat: {
      options: {},
      dist: {
        src: [
          'WebCola/cola.js',
          'WebCola/src/rbtree.js',
          'WebCola/src/scc.js',
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
    yuidoc: {
      compile: {
        name: 'cola.js',
        description: 'Javascript constraint based layout for high-quality graph visualization and exploration using D3.js and other web-based graphics libraries.',
        version: '1',
        url: 'http://marvl.infotech.monash.edu/webcola',
        options: {
          paths: 'WebCola/src',
          outdir: 'WebCola/doc'
        }
      }
    }
  });
 
  grunt.registerTask('default', ['typescript:base', 'concat', 'uglify', 'qunit']);
  grunt.registerTask('nougly', ['typescript:base', 'concat', 'qunit']);
  grunt.registerTask('nougly-notest', ['typescript', 'concat']);
  grunt.registerTask('docs', ['yuidoc', 'typescript:examples']);
  grunt.registerTask('full', ['default', 'typescript:examples', 'examples']);
};
