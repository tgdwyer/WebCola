var async = require('async'),
  PhantomJS = require(
    'phantomjs-prebuilt'
  );
module.exports = function(grunt){
  grunt.registerMultiTask('examples', 'Run all the examples.', function(){
    var phantomjs = PhantomJS.init(grunt),
      errors = [],
      // This task is async.
      done = this.async(),

      urls = grunt.file.expand(this.data);

    phantomjs.on('error.onError', function(msg, stack, foo) {
      grunt.log.write('X'.red);
      errors.push(msg + "\n" + stack.map(function(frame){
        return "- "+ frame.file.split("/").slice(-2).join("/") +
          ":" + frame.line;
      }).join("\n"));
    });

    phantomjs.on('onResourceReceived', function(res){
      if(res.stage === 'end' && res.status && res.status >= 400){
        errors.push(res.status + " " + res.status_text + " " +
          res.url.split("/").slice(-2).join("/"));
      }
    });

    // Built-in error handlers.
    phantomjs.on('fail.load', function(url) {
      phantomjs.halt();
    });

    phantomjs.on('fail.timeout', function() {
      phantomjs.halt();
    });

    phantomjs.on('onLoadFinished', function() {
      grunt.log.write('.');
      phantomjs.halt();
    });

    async.eachLimit(urls, 10,
      function(url, next){
        // try to load each example page
        phantomjs.spawn(url, {
          options: {},
          done: function(err) {
            err ? done() : next();
          }
        });
      },
      // All tests have been run.
      function(err) {
        // Log results.
        grunt.log.writeln();
        if (errors.length) {
          grunt.fail.warn(errors.join("\n"));
        } else {
          grunt.log.ok();
        }
        // All done!
        done();
      }
    );
  });
};
