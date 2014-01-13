
function endFullScreen(oncancel) {
    if (!RunPrefixMethod(document, "FullScreen") && !RunPrefixMethod(document, "IsFullScreen")) {
        oncancel();
    }
}
function fullScreen(e, oncancel) {
    if (RunPrefixMethod(document, "FullScreen") || RunPrefixMethod(document, "IsFullScreen")) {
        RunPrefixMethod(document, "CancelFullScreen");
    }
    else {
        RunPrefixMethod(e, "RequestFullScreen");
        e.setAttribute("width", screen.width);
        e.setAttribute("height", screen.height);
    }
    if (arguments.length > 1) {
        var f = function () { endFullScreen(oncancel); };
        document.addEventListener("fullscreenchange", f, false);
        document.addEventListener("mozfullscreenchange", f, false);
        document.addEventListener("webkitfullscreenchange", f, false);
    }
}

var pfx = ["webkit", "moz", "ms", "o", ""];
function RunPrefixMethod(obj, method) {

    var p = 0, m, t;
    while (p < pfx.length && !obj[m]) {
        m = method;
        if (pfx[p] == "") {
            m = m.substr(0, 1).toLowerCase() + m.substr(1);
        }
        m = pfx[p] + m;
        t = typeof obj[m];
        if (t != "undefined") {
            pfx = [pfx[p]];
            return (t == "function" ? obj[m]() : obj[m]);
        }
        p++;
    }
}

function isFullScreen() {
    var fullscreenEnabled = document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled;
    return fullscreenEnabled;
}