///<reference path="jquery.d.ts"/>
var tmdb;
(function (tmdb) {
    var NodeType = (function () {
        function NodeType(type, credits, label, imagesarray) {
            this.type = type;
            this.credits = credits;
            this.label = label;
            this.imagesarray = imagesarray;
        }
        NodeType.prototype.toString = function () {
            return this.type;
        };

        NodeType.prototype.next = function () {
            return this === tmdb.Movie ? tmdb.Person : tmdb.Movie;
        };

        NodeType.prototype.makeEdge = function (thisName, otherName) {
            return this === tmdb.Movie ? new Edge(thisName, otherName) : new Edge(otherName, thisName);
        };
        return NodeType;
    })();
    tmdb.NodeType = NodeType;

    tmdb.Movie = new NodeType("movie", "credits", "title", "posters");
    tmdb.Person = new NodeType("person", "movie_credits", "name", "profiles");

    var Node = (function () {
        function Node(type, id) {
            this.type = type;
            this.id = id;
            this.degree = 0;
        }
        Node.prototype.name = function () {
            return this.type + this.id.toString();
        };
        Node.prototype.getImage = function () {
            var _this = this;
            var d = $.Deferred();
            var images = request(this.type, this.id, "images");
            $.when(images).then(function (i) {
                var paths = i[_this.type.imagesarray];
                _this.imgurl = paths.length > 0 ? 'http://image.tmdb.org/t/p/w185/' + paths[0].file_path : 'http://upload.wikimedia.org/wikipedia/commons/3/37/No_person.jpg';
                d.resolve(_this);
            });
            return d.promise();
        };
        return Node;
    })();
    tmdb.Node = Node;

    var Edge = (function () {
        function Edge(source, target) {
            this.source = source;
            this.target = target;
        }
        Edge.prototype.toString = function () {
            return this.source + '-' + this.target;
        };
        return Edge;
    })();
    tmdb.Edge = Edge;
    function request(type, id, content, append) {
        if (typeof content === "undefined") { content = null; }
        if (typeof append === "undefined") { append = null; }
        var query = "https://api.themoviedb.org/3/" + type + "/" + id;
        if (content) {
            query += "/" + content;
        }
        query += "?api_key=1bba0362f468d50d2ec27acff6d5e05a";
        if (append) {
            query += "&append_to_response=" + append;
        }
        return $.get(query);
    }
    var Graph = (function () {
        function Graph() {
            this.nodes = {};
            this.edges = {};
        }
        Graph.prototype.expandNeighbours = function (node, f) {
            var _this = this;
            var dn = node.cast.map(function (c) {
                return _this.getNode(node.type.next(), c.id, function (v) {
                    v.label = c[v.type.label];
                    _this.addEdge(node, v);
                    f(v);
                });
            });
            var d = $.Deferred();
            $.when.apply($, dn).then(function () {
                var neighbours = Array.prototype.slice.call(arguments);
                d.resolve(neighbours);
            });
            return d.promise();
        };
        Graph.prototype.fullyExpanded = function (node) {
            var _this = this;
            return node.cast && node.cast.every(function (v) {
                return (node.type.next() + v.id) in _this.nodes;
            });
        };
        Graph.prototype.addNode = function (type, id) {
            var node = new Node(type, id);
            return this.nodes[node.name()] = node;
        };
        Graph.prototype.getNode = function (type, id, f) {
            var _this = this;
            var d = $.Deferred();
            var name = type + id.toString();
            if (name in this.nodes) {
                return this.nodes[name];
            }
            var node = this.addNode(type, id);
            f(node);
            var cast = request(type, id, null, type.credits);
            $.when(cast).then(function (c) {
                node.label = c[type.label];
                (node.cast = c[type.credits].cast).forEach(function (v) {
                    var neighbourname = type.next() + v.id.toString();
                    if (neighbourname in _this.nodes) {
                        _this.addEdge(node, _this.nodes[neighbourname]);
                    }
                });
                d.resolve(node);
            });
            return d.promise();
        };
        Graph.prototype.addEdge = function (u, v) {
            var edge = u.type.makeEdge(u.name(), v.name());
            var ename = edge.toString();
            if (!(ename in this.edges)) {
                this.edges[ename] = edge;
            }
            ++u.degree, ++v.degree;
        };
        return Graph;
    })();
    tmdb.Graph = Graph;
})(tmdb || (tmdb = {}));
//# sourceMappingURL=tmdbgraph.js.map
