const 
    gulp = require('gulp'),
    source = require('vinyl-source-stream'),
    browserify = require('browserify'),
    tsify = require('tsify'),
    uglifyJs = require('gulp-uglify'),
    rename = require('gulp-rename'),
    qunit = require('gulp-qunit'),
    typedoc = require("gulp-typedoc"),
    path = 'WebCola',
    config = {
        main: 'index.ts',
        result: 'cola.js',
        minresult: 'cola.min.js',
        testpath: path + '/test',
        docpath: path + '/doc',
        testhtml: 'test.html'
    };

gulp.task('compile-js', () => 
    browserify({basedir: path})
        .add(config.main)
        .plugin(tsify)
        .bundle()
        .pipe(source(config.result))
        .pipe(gulp.dest(path))
);

gulp.task('uglify-js', ['compile-js'], () => 
    gulp.src(path + '/' + config.result)
		.pipe(uglifyJs())
		.pipe(rename(config.minresult))
		.pipe(gulp.dest(path))
);

gulp.task('compile-test', ['compile-js'], () =>
    browserify({basedir: config.testpath})
        .add('apitests.ts')
        .plugin(tsify)
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(gulp.dest(config.testpath))
);

gulp.task('test', ['compile-test'], () =>
    gulp.src(`${config.testpath}/${config.testhtml}`)
        .pipe(qunit())
);
 
gulp.task("typedoc", () =>
    gulp.src([path + '/' + config.main])
        .pipe(typedoc({
            // TypeScript options (see typescript docs) 
            module: "commonjs",
            target: "es5",
            includeDeclarations: true,
            out: config.docpath,
            name: "WebCola",
            theme: "minimal",
            ignoreCompilerErrors: false,
            version: true,
        }))
);

gulp.task('default',['test','uglify-js']);