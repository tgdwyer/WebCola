module.exports = function (grunt) {
  var _ = require('underscore'),
    fs = require('fs'),
    path = require('path'),
    
    pkg = grunt.file.readJSON('package.json'),
    bwr = grunt.file.readJSON('bower.json');

  require('load-grunt-tasks')(grunt);
  require('./tasks/examples')(grunt);

  function _build_examples(action){
    var examples = grunt.file.expand(['site/examples/*/index.jade']);
    return examples.map(function(example){
      var html = example.replace(/^site(.*)jade$/, 'dist$1html'),
        thumb = html.replace('index.html', 'thumbnail.png'),
        screenshot = '.tmp/' + thumb;
      if(action === 'jade'){
        return {src: example, dest: html};
      }else if(action === 'screenshot'){
        return {
          url: html,
          file: screenshot,
          selector: 'svg'
        };
      }else if(action === 'crop'){
        return {
          src: [screenshot],
          dest: thumb
        };
      }
    });
  }

  grunt.initConfig({
    pkg: pkg,
    bwr: bwr,
    watch: {
      default: {
        files: ['<%= concat.dist.src %>'],
        tasks: ['default']
      },
      typescript: {
        files: ['<%= typescript.base.src %>'],
        tasks: ['typescript']
      },
      test: {
        files: ['test/**/*.js'],
        tasks: ['newer:copy', 'qunit']
      },
      site: {
        files: ['site/data/**'],
        tasks: ['newer:copy']
      },
      jade: {
        files: ['site/**/*.jade', '!site/**/_*.jade'],
        tasks: ['newer:jade']
      },
      jade_partials: {
        files: ['site/**/_*.jade'],
        tasks: ['jade']
      },
      less: {
        files: ['site/**/*.less'],
        tasks: ['newer:less']
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
        template: 'site/cola.js.hbs',
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
      all: ['dist/test/*.html']
    },
    examples: {
      all: ['site/examples/*/']
    },
    'screenshot-element': {
      examples: {
        options: {timeout: 1000},
        images: _build_examples('screenshot')
      },
    },
    image_resize: {
      options: {
        width: 230,
        height: 184,
        crop: true,
        overwrite: true
      },
      examples: {
        files: _build_examples('crop')
      }
    },
    yuidoc: {
      compile: {
        name: 'cola.js',
        description: 'Javascript constraint based layout for high-quality graph visualization and exploration using D3.js and other web-based graphics libraries.',
        version: '1',
        url:pkg.homepage,
        options: {
          paths: ['src', 'lib'],
          outdir: 'dist/api'
        }
      }
    },
    jade: {
      options: {
        pretty: true,
        data: function(dest, src){
          var root = dest.split('/')
            .slice(2)
            .map(function(){ return '..'; })
            .join('/');
          root = root ? root + '/' : root;

          return _.extend({},
            grunt.config.data,
            {
              root: root,
              bc: root + 'bower_components/',
              examples: grunt.file.expand(grunt.config.data.examples.all)
                .map(function(ex){ return ex.replace(/^site\//, ''); }),
              inline: function(file_src){
                return fs.readFileSync(
                  path.join(path.dirname(src[0]), file_src)
                );
              }
            }
          );
        }
      },
      test: {
        files: [{src: ['site/test/index.jade'], dest: 'dist/test/index.html'}]
      },
      site: {
        files: [{src: ['site/index.jade'], dest: 'dist/index.html'}]
          .concat(_build_examples('jade'))
      }
    },
    less: {
      default: {
        files: [{
          src: ['site/style.less'],
          dest: 'dist/style.css'
        }]
      }
    },
    copy: {
      data: {
        files: [
          {expand: true, cwd: 'site', src: ['data/**'], dest: 'dist'}
        ]
      },
      test: {
        files: [
          {expand: true, src: ['test/**'], dest: 'dist'}
        ]
      }
    },
    concurrent: {
      site: [
        'jade',
        'less',
        'copy',
        'yuidoc'
      ]
    }
  });

  grunt.registerTask('build', [
    'typescript:base',
    'concat',
    'newer:copy',
    'jade:test',
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

  grunt.registerTask('site', [
    'concurrent:site',
    'screenshot-element',
    'image_resize'
  ]);

  grunt.registerTask('full', [
    'default',
    'site',
    'examples'
  ]);
};
