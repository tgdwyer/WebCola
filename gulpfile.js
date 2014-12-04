var gulp = require('gulp');
var ts  = require('gulp-typescript');

gulp.task('default', function () {
  return gulp
    .src('WebCola/src/*.ts')
    .pipe(ts({
        module: 'commonjs',
        target: 'ES5'
    }))
    .pipe(gulp.dest('lib'));
});