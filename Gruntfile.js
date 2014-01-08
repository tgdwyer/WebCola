module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-typescript');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
 
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        typescript: {
            base: {
                src: ['WebCola/src/*.ts'],
                dest: 'WebCola/compiledtypescript.js',
                options: {
                    module: 'amd',
                    target: 'es5',
                    sourcemap: false
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
                files: {
                    'WebCola/cola.v1.min.js': ['WebCola/compiledtypescript.js', 'WebCola/src/d3adaptor.js', 'WebCola/src/rbtree.js', 'WebCola/src/scc.js']
                }
            }
        },
        qunit: {
            all: ['WebCola/test/*.html']
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
 
    grunt.registerTask('default', ['typescript', 'uglify', 'qunit', 'yuidoc']);
 
}
