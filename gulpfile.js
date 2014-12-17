var gulp 				= require('gulp');
var ts  				= require('gulp-typescript');
var browserify 	= require('browserify');
var source 			= require('vinyl-source-stream');
var transform 	= require('vinyl-transform');
var buffer 			= require('vinyl-buffer');
var uglify 			= require('gulp-uglify');
var sourcemaps 	= require('gulp-sourcemaps');
var qunit       = require('gulp-qunit');

var getBundleName = function () {
  var version = 'v'+require('./package.json').version.split('.')[0];
  var name = 'cola'
  return name + '.' + version + '.' + 'min';
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

gulp.task('copy', function () {
  return gulp
    .src('./WebCola/src/*.js')
    .pipe(gulp.dest('./lib'))
})

gulp.task('browserify', function () {
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
      .pipe(uglify())
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./WebCola/'));
  }

  return bundle();
});

gulp.task('test', function() {
    return gulp.src('./test/test.html')
        .pipe(qunit());
});

