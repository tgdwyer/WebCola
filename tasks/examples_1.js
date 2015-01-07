var page = require('webpage').create(), loadInProgress = false, fs = require('fs');
var htmlFiles = new Array();
 
console.log(fs.workingDirectory);
console.log(phantom.args[0]);
 
var curdir = phantom.args[0] || fs.workingDirectory;
var curdirList = fs.list(curdir);
console.log("dir file count: " + curdirList.length);
 
// loop through files and folders //
for(var i = 0; i< curdirList.length; i++) {
    var fullpath = curdir + fs.separator + curdirList[i];
    // check if item is a file //
    if(fs.isFile(fullpath)) {
        // check that file is html //
        if(fullpath.toLowerCase().indexOf('.html') != -1) {
            // show full path of file //
            // console.log('File path: ' + fullpath);
            htmlFiles.push(fullpath); // todo: make this more async (i.e. pop on/off stack WHILE rending pages)
        }
    }
}
 
console.log('HTML files found: ' + htmlFiles.length);

phantom.exit();