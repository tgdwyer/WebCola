///<reference path="layout.ts"/>

module cola {
    export class LayoutAdaptor extends Layout {
        
        // dummy functions in case not defined by client
        trigger(e: Event) {};
        kick() {};
        drag() {};
        on(eventType: EventType | string, listener: () => void) : LayoutAdaptor { return this; };
        
        dragstart: (d:any) => void;
        dragStart: (d:any) => void;
        dragend: (d:any) => void;
        dragEnd: (d:any) => void;
        
        constructor( options ) {
            super();
            
            // take in implementation as defined by client
            
            var self = this;
            var o = options;
            
            if ( o.trigger ) {
                this.trigger = o.trigger;
            }
            
            if ( o.kick ){
                this.kick = o.kick;
            }
            
            if ( o.drag ){
                this.drag = o.drag;
            }
            
            if ( o.on ){
                this.on = o.on;
            }
            
            this.dragstart = this.dragStart = Layout.dragStart;
            this.dragend = this.dragEnd = Layout.dragEnd;
        }
    }

    /**
     * provides an interface for use with any external graph system (e.g. Cytoscape.js):
     */
    export function adaptor( options ): LayoutAdaptor {
        return new LayoutAdaptor( options );
    }
}
