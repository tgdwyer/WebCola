///<reference path="../extern/jquery.d.ts"/>
module tmdb {
    export class NodeType {
        constructor(
            public type: string,
            public credits: string,
            public label: string,
            public imagesarray: string) { }

        toString(): string {
            return this.type; 
        }

        next(): NodeType {
            return this === Movie ? Person : Movie;
        }

        makeEdge(thisName: string, otherName: string): Edge {
            return this === Movie ? new Edge(thisName, otherName) : new Edge(otherName, thisName);
        }
    }

    export var Movie = new NodeType("movie", "credits", "title", "posters");
    export var Person = new NodeType("person", "movie_credits", "name", "profiles");

    export class Node {
        imgurl: string;
        cast: any[];
        label: string;
        degree: number = 0;
        constructor(public type: NodeType, public id: number) { }
        name(): string { return this.type + this.id.toString(); }
        getImage(): JQueryPromise<Node> {
            var d = $.Deferred<Node>();
            var images = request(this.type, this.id, "images");
            $.when(images).then(i=> {
                var paths = i[this.type.imagesarray];
                this.imgurl = paths.length > 0
                ? 'http://image.tmdb.org/t/p/w185/' + paths[0].file_path
                : 'http://upload.wikimedia.org/wikipedia/commons/3/37/No_person.jpg';
                d.resolve(this);
            });
            return d.promise();
        }
    }

    export class Edge {
        constructor(public source: string, public target: string) { }
        toString(): string {
            return this.source + '-' + this.target;
        }
    }
    function request(type: NodeType, id: number, content: string = null, append: string = null): JQueryPromise<any> {
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
    export class Graph {
        nodes: any = {};
        edges: any = {};
        expandNeighbours(node: Node, f: (v: Node) => void): JQueryPromise<Node[]> {
            var dn = node.cast.map(c=> this.getNode(node.type.next(), c.id, v => {
                v.label = c[v.type.label];
                this.addEdge(node, v);
                f(v);
            }));
            var d = $.Deferred<Node[]>();
            $.when.apply($, dn)
                .then(function () {
                    var neighbours = Array.prototype.slice.call(arguments);
                    d.resolve(neighbours);
                    });
            return d.promise();
        }
        fullyExpanded(node: Node): boolean {
            return node.cast && node.cast.every(v=> (node.type.next() + v.id) in this.nodes);
        }
        addNode(type: NodeType, id: number): Node {
            var node = new Node(type, id);
            return this.nodes[node.name()] = node;
        }
        getNode(type: NodeType, id: number, f: (v: Node) => void): JQueryPromise<Node> {
            var d = $.Deferred<Node>();
            var name: string = type + id.toString();
            if (name in this.nodes) {
                return this.nodes[name];
            }
            var node = this.addNode(type, id);
            f(node);
            var cast = request(type, id, null, type.credits);
            $.when(cast).then(c=> {
                node.label = c[type.label];
                (node.cast = c[type.credits].cast).forEach((v) => {
                    var neighbourname: string = type.next() + v.id.toString();
                    if (neighbourname in this.nodes) {
                        this.addEdge(node, this.nodes[neighbourname]);
                    }
                });
                d.resolve(node);
            });
            return d.promise();
        }
        addEdge(u: Node, v: Node) {
            var edge = u.type.makeEdge(u.name(), v.name());
            var ename = edge.toString();
            if (!(ename in this.edges)) {
                this.edges[ename] = edge;
            }
            ++u.degree, ++v.degree;
        }
    }
}