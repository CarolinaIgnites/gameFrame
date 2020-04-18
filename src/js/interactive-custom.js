var Physics = require('physicsjs/dist/physicsjs-full.min.js');

Physics.behavior('interactive-custom', function( parent ){

    let mobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());

    if ( !document ){
        // must be in node environment
        return {};
    }

    let defaults = {
            // the element to monitor
            el: null,
            // time between move events
            moveThrottle: 1000 / 100 | 0,
            // minimum velocity clamp
            minVel: { x: -5, y: -5 },
            // maximum velocity clamp
            maxVel: { x: 5, y: 5 }
        }
        ,getElementOffset = function( el ){
            let curleft = 0
                ,curtop = 0;

            if (el.offsetParent) {
                do {
                    curleft += el.offsetLeft;
                    curtop += el.offsetTop;
                } while (el = el.offsetParent);
            }

            return { left: curleft, top: curtop };
        }
        ,getCoords = function( e ){
            let offset = getElementOffset( e.target )
                ,obj = ( e.changedTouches && e.changedTouches[0] ) || e
                ,x = obj.pageX - offset.left
                ,y = obj.pageY - offset.top
                ;

            // Resize
            x *= 768.0/window.innerHeight;
            y *= 768.0/window.innerHeight;

            return {
                x: x
                ,y: y
            };
        }
        ;

    return {
        // extended
        init: function( options ){

            let self = this
                ,prevTreatment
                ,time
                ;

            // call parent init method
            parent.init.call( this );
            this.options.defaults( defaults );
            this.options( options );

            // vars
            this.mousePos = new Physics.vector();
            this.mousePosOld = new Physics.vector();
            this.offset = new Physics.vector();

            this.el = typeof this.options.el === 'string' ? document.getElementById(this.options.el) : this.options.el;

            if ( !this.el ){
                throw "No DOM element specified";
            }

            // init events
            let grab = function grab( e ){
                let pos = getCoords( e )
                    ,body
                    ;

                time = Physics.util.ticker.now();

                if ( self._world ){
                    body = self._world.findOne({ $at: new Physics.vector( pos.x, pos.y ), $in: self.getTargets() });

                    // we're trying to grab a body
                    if ( body ){

                        // fix the body in place
                        prevTreatment = body.treatment;
                        body.treatment = 'kinematic';
                        body.state.vel.zero();
                        body.state.angular.vel = 0;
                        // remember the currently grabbed body
                        self.body = body;
                        // remember the mouse offset
                        self.mousePos.clone( pos );
                        self.mousePosOld.clone( pos );
                        self.offset.clone( pos ).vsub( body.state.pos );

                        pos.body = body;
                        self._world.emit('interact:grab', pos);
                    } else if(e.type == "mousedown"){

                        body = self._world.findOne({ $at: new Physics.vector( pos.x, pos.y )});
                        if(body){
                            pos.body = body;
                            self._world.emit('interact:poke', pos);
                        }
                        self._world.emit('interact:click', pos);
                    }
                }
            };

            let move = Physics.util.throttle(function move( e ){
                let pos = getCoords( e )
                    ,state
                    ;

                if ( self.body ){
                    time = Physics.util.ticker.now();

                    self.mousePosOld.clone( self.mousePos );
                    // get new mouse position
                    self.mousePos.set(pos.x, pos.y);

                    pos.body = self.body;
                }

                self._world.emit('interact:move', pos);
            }, self.options.moveThrottle);

            let release = function release( e ){
                let pos = getCoords( e )
                    ,body
                    ,dt = Math.max(Physics.util.ticker.now() - time, self.options.moveThrottle)
                    ;

                // get new mouse position
                self.mousePos.set(pos.x, pos.y);

                // release the body
                if (self.body){
                    self.body.treatment = prevTreatment;
                    // calculate the release velocity
                    self.body.state.vel.clone( self.mousePos ).vsub( self.mousePosOld ).mult( 1 / dt );
                    // make sure it's not too big
                    self.body.state.vel.clamp( self.options.minVel, self.options.maxVel );
                    self.body = false;
                }

                if ( self._world ){

                    self._world.emit('interact:release', pos);
                }
            };

            this.el.addEventListener('mousedown', grab);
            this.el.addEventListener('mousemove', move);
            this.el.addEventListener('mouseup', release);
        },

        // extended
        connect: function( world ){

            // subscribe the .behave() method to the position integration step
            world.on('integrate:positions', this.behave, this);
        },

        // extended
        disconnect: function( world ){

            // unsubscribe when disconnected
            world.off('integrate:positions', this.behave);
        },

        // extended
        behave: function( data ){

            let self = this
                ,state
                ,dt = Math.max(data.dt, self.options.moveThrottle)
                ;

            if ( self.body ){

                // if we have a body, we need to move it the the new mouse position.
                // we'll do this by adjusting the velocity so it gets there at the next step
                state = self.body.state;
                state.vel.clone( self.mousePos ).vsub( self.offset ).vsub( state.pos ).mult( 1 / dt );
            }
        }
    };
});