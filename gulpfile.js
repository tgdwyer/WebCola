var gulp 				= require('gulp');
var ts  				= require('gulp-typescript');
var browserify 	= require('browserify');
var source 			= require('vinyl-source-stream');
var transform 	= require('vinyl-transform');
var buffer 			= require('vinyl-buffer');
var uglify 			= require('gulp-uglify');
var sourcemaps 	= require('gulp-sourcemaps');

var getBundleName = function () {
  var version = require('./package.json').version;
  var name = require('./package.json').name;
  return version + '.' + name + '.' + 'min';
};


gulp.task('compile', function () {
  return gulp
    .src('./WebCola/src/*.ts')
    .pipe(ts({
        module: 'commonjs',
        target: 'ES5'
    }))
    .pipe(gulp.dest('./lib'));
});

gulp.task('browserify', function () {
  var browserified = transform(function(filename) {
    var b = browserify({
    	entries: [filename],
    	debug: true
    });
    return b.bundle();
  });
  
  return gulp.src(['./index.js'])
    .pipe(browserified)
    .pipe(source(getBundleName() + '.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
      // Add transformation tasks to the pipeline here.
      .pipe(uglify())
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./WebCola/'));
});

// gulp.task('cncat')