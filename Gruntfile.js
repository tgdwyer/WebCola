module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);
  require('./tasks/examples')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    name: 'cola.v3.min',
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
        dest: './lib',
        options: {
          module: 'commonjs',
          target: 'es5',
          sourceMap: true
        }
      },
      examples: {
        src: ['WebCola/examples/*.ts'],
        options: {
          module: 'commonjs',
          target: 'es5',
          sourceMap: false
        }
      }
    },
    browserify: {
      dist: {
        files: {
          'WebCola/<%= name %>.js': ['./browser.js']
        }
      }
    },
    umd: {
      all: {
        src: 'WebCola/<%= name %>.js',
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
          'WebCola/<%= name %>.js': [
            'WebCola/<%= name %>.js'
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
 
  grunt.registerTask('default', ['typescript:base', 'browserify', 'uglify', 'qunit']);
  grunt.registerTask('nougly', ['typescript:base', 'browserify', 'qunit']);
  grunt.registerTask('nougly-notest', ['typescript', 'browserify']);
  grunt.registerTask('docs', ['yuidoc', 'typescript:examples']);
  grunt.registerTask('full', ['default', 'typescript:examples', 'examples']);
};
