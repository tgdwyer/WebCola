///<reference path="jquery.d.ts"/>
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
        constructor(public type: NodeType, public id: number, public name: string) { }
    }
    export class Edge {
        constructor(public source: string, public target: string) { }
        toString(): string {
            return this.source + '-' + this.target;
        }
    }
    export class Graph {
        request(type: NodeType, id: number, content: string = null, append: string = null): JQueryPromise<any> {
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
        nodes: any = {};
        edges: any = {};
        expandNeighbours(node: Node): JQueryPromise<Node[]> {
            var dn = node.cast.map((v) => this.getNode(node.type.next(), v.id));
            var d = $.Deferred<Node>();
            $.when.apply($, dn)
                .then(() => {
                    var neighbours = Array.prototype.slice.call(arguments);
                    d.resolve(neighbours)
                    });
            return d.promise();
        }
        fullyExpanded(node: Node): boolean {
            return node.cast.every(v=> typeof this.nodes[node.type.next() + v.id] !== 'undefined');
        }
        getNode(type: NodeType, id: number): JQueryPromise<Node> {
            var d = $.Deferred<Node>();
            var name: string = type + id.toString();
            if (name in this.nodes) {
                return this.nodes[name];
            }
            var node = new Node(type, id, name);
            this.nodes[name] = node;
            //var images = this.request(type, id, "images");
            var cast = this.request(type, id, null, type.credits);
            $.when(/*images,*/ cast).then((c) => {
                //var paths = i[0][type.imagesarray];

                //node.imgurl = paths.length > 0
                //? 'http://image.tmdb.org/t/p/w185/' + paths[0].file_path
                //: 'http://upload.wikimedia.org/wikipedia/commons/3/37/No_person.jpg';

                node.label = c[0][type.label];

                (node.cast = c[0][type.credits].cast).forEach((v) => {
                    var neighbourname: string = type.next() + v.id.toString();
                    if (neighbourname in this.nodes) {
                        var edge = type.makeEdge(node.name, neighbourname);
                        var ename = edge.toString();
                        if (!(ename in this.edges)) {
                            this.edges[ename] = edge;
                        }
                    }
                });
                d.resolve(node);
            });
            return d.promise();
        }
    }
}