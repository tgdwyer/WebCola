var gulp 				= require('gulp');
var ts  				= require('gulp-typescript');
var browserify 	= require('browserify');
var source 			= require('vinyl-source-stream');
var transform 	= require('vinyl-transform');
var buffer 			= require('vinyl-buffer');
var uglify 			= require('gulp-uglify');
var sourcemaps 	= require('gulp-sourcemaps');
var qunit       = require('node-qunit-phantomjs');
var serve       = require('gulp-serve');
var ifElse      = require('gulp-if-else');
var phridge     = require('phridge');
var gutil       = require('gulp-util');
var run         = require('gulp-run')

var getBundleName = function () {
  var version = 'v'+require('./package.json').version.split('.')[0];
  var name = 'cola'
  return name + '.' + version + '.' + 'min';
};

var shouldMinify = true;

gulp.task('default', ['build-minify-test']);
gulp.task('nougly', ['build-test']);
gulp.task('nougly-notest', ['build']);
gulp.task('docs', ['typescript.examples'], function () {
  run('yuidoc ./lib --outdir WebCola/doc').exec();
});
gulp.task('full', ['default', 'examples'])

gulp.task('build', ['typescript.base'], function () {
  shouldMinify = false;
  return bfy(shouldMinify);
});

gulp.task('build-minify', ['typescript.base'], function () {
  shouldMinify = true;
  return bfy(shouldMinify);
});

gulp.task('build-minify-test', ['build-minify'], function() {
    qunit('./WebCola/test/test.html', { verbose: true })
});

gulp.task('build-test', ['build'], function() {
    qunit('./WebCola/test/test.html', { verbose: true })
});

function bfy (shouldMinify) {
    var bundler = browserify({
      entries: ['./browser.js'],
      debug: true
    });

    var bundle = function () {
      return bundler
        .bundle()
        .pipe(source(getBundleName() + '.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        // .pipe(ifElse(shouldMinify), uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('./WebCola/'))
    }

    return bundle();
};

gulp.task('typescript.base', function () {
  return gulp
    .src('./WebCola/src/*.ts')
    .pipe(ts({
        module: 'commonjs',
        target: 'ES5'
    }))
    .pipe(gulp.dest('./lib'));
});

gulp.task('typescript.examples', function () {
  return gulp
    .src('./WebCola/examples/*.ts')
    .pipe(ts({
      module: 'amd',
      target: 'ES5'
    }))
    .pipe(gulp.dest('./WebCola/examples'))
});

gulp.task('examples', ['typescript.examples'], function () {
  phridge.spawn()
  .then(function (phantom) {
    phantom.run(function () {
      var src = './WebCola/examples/';
      var urls = [];
      var errors = [];
      fs.list(src).forEach(function (f) {
        if (f.indexOf('.html') !== -1) {
          urls.push(src+f)
        }
      });

      urls.forEach(function (url) {
        var page = webpage.create();
        page.open(url, function (status) {
          console.log('page', url)
        } )
      })


    })
  }).then(function () {
    phridge.disposeAll().then(function () {
        console.log("All processes created by phridge.spawn() have been terminated");
    });
  })
});



gulp.task('copy', function () {
  return gulp
    .src('./WebCola/src/*.js')
    .pipe(gulp.dest('./lib'))
});







