module.exports = function (grunt) {
  var _ = require("underscore"),
    fs = require("fs");
  require('load-grunt-tasks')(grunt);
  require('./tasks/examples_smoke')(grunt);

  function _build_examples(){
    var examples = grunt.file.expand(["site/examples/*/index.jade"]);
    return examples.map(function(example){
      return {
        src: example,
        dest: example.replace(/^site(.*)jade$/, "dist$1html")
      }
    });
  }

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    bwr: grunt.file.readJSON('bower.json'),
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
      },
      jade: {
        files: ["site/**/*.jade"],
        tasks: ["jade"]
      },
      jade: {
        files: ["site/**/*.less"],
        tasks: ["less"]
      }
    },
    typescript: {
      base: {
        src: ['src/**/*.ts'],
        dest: '.tmp/compiledtypescript.js',
        options: {
          module: 'amd',
          target: 'es5',
          sourcemap: false
        }
      },
      examples: {
        src: ['WebCola/examples/*.ts'],
        options: {
          module: 'amd',
          target: 'es5',
          sourcemap: false
        }
      }
    },
    concat: {
      options: {},
      dist: {
        src: ['<%= typescript.base.dest %>', 'lib/**/*.js'],
        dest: 'dist/cola.js'
      }
    },
    umd: {
      all: {
        src: '<%= concat.dist.dest %>',
        dest: '<%= concat.dist.dest %>',
        template: 'templates/umd.hbs',
        objectToExport: 'cola',
        deps: {
          'default': ['d3']
        }
      }
    },
    uglify: {
      dist: {
        options: {
          //sourceMap: 'WebCola/cola.min.map',
          //sourceMapIn: 'WebCola/compiledtypescript.js.map',
          //sourceMapRoot: 'WebCola'
        },
        src: ['<%= umd.all.dest %>'],
        dest: 'dist/cola.min.js'
      }
    },
    qunit: {
      all: ['WebCola/test/*.html']
    },
    examples: {
      all: ["site/examples/*/"]
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
    },
    jade: {
      site: {
        options: {
          data: function(dest, src){
            return _.extend({},
              grunt.config.data,
              {
                bc: "bower_components/",
                examples: grunt.file.expand(grunt.config.data.examples.all)
                  .map(function(ex){ return ex.replace(/^site\//, ""); })
              }
            );
          }
        },
        files: [{src: ["site/index.jade"], dest: "dist/index.html"}]
          .concat(_build_examples())
      }
    },
    less: {
      default: {
        files: [{
          src: ["site/style.less"],
          dest: "dist/style.css"
        }]
      }
    }
  });

  grunt.registerTask('build', [
    'typescript:base',
    'concat',
    'umd'
  ]);
 
  grunt.registerTask('default', [
    'build',
    'uglify',
    'qunit'
  ]);

  grunt.registerTask('nougly', [
    'build',
    'qunit'
  ]);

  grunt.registerTask('docs', [
    'jade',
    'less',
    'yuidoc',
    'typescript:examples'
  ]);

  grunt.registerTask('full', [
    'default',
    'docs',
    'examples'
  ]);
};
