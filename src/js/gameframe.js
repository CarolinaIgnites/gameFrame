var GameFrame;

// Keep everything in scope
(()=>{

    // Building dom
    let game = document.getElementById('game') || {attributes:{}};
    let templates = document.getElementById('templates');
    let scoreboard = document.createElement("div");
    let modal = document.createElement("div");
    let style = document.createElement("style");
    let clipboard = document.createElement("canvas");
    let context = clipboard.getContext("2d");
    let children = game.children;

    // Scoped states
    let started = false;
    let collisions = {};
    let keyEvents = {};
    let loops = [];
    let lookup = {};
    let score = 0;
    let seed = 0;

    // time vars
    let t = 0;
    let pt = 0;

    /// Global physics vars
    let world;
    let renderer;

    // key references
    let keys = {};
    let special = {
        38: "up",
        40: "down",
        37: "left",
        39: "right",
    }

    // helpers
    let toFloat = (val,fallback)=>{return isNaN(val)?fallback:val;}

    // For boundary   
    let viewportBounds = Physics.aabb(0, 0, window.innerWidth, window.innerHeight)
    let edgeBounce = Physics.behavior('edge-collision-detection', {
        aabb: viewportBounds,
        restitution: toFloat((game.attributes["bounce"] || 0).value, 0.5),
        cof: toFloat((game.attributes["friction"] || 0).value, 0.5),
    });

    // Objs for lookup
    // Turn svg to object
    let taxonomy = {
        "circle" : function(el){
            return Physics.body("circle",{
                name: el.classList.contains("movable") ? "movable" : "",
                treatment: el.classList.contains("static") ? "static" : "dynamic",
                x: (el.attributes["cx"] || el.attributes["x"] || 0).value | 0,
                y: (el.attributes["cy"] || el.attributes["y"] || 0).value | 0,
                radius: (el.attributes["r"] || 0).value | 0,
                vy: (el.attributes["vy"] || 0).value,
                vx: (el.attributes["vx"] || 0).value,
                restitution: toFloat((el.attributes["bounce"] || 0).value, 0.5),
                cof: toFloat((el.attributes["friction"] || 0).value, 0.5),
                impulse: !el.classList.contains('no-impulse'),
            });
        },
        "rect" : function(el){
            return Physics.body("rectangle",{
                name: el.classList.contains("movable") ? "movable" : "",
                treatment: el.classList.contains("static") ? "static" : "dynamic",
                width: (el.attributes["width"] || 0).value | 0,
                height: (el.attributes["height"] || 0).value | 0,
                x: (el.attributes["x"] || 0).value | 0,
                y: (el.attributes["y"] || 0).value | 0,
                vy: (el.attributes["vy"] || 0).value,
                vx: (el.attributes["vx"] || 0).value,
                restitution: toFloat((el.attributes["bounce"] || 0).value, 0.5),
                cof: toFloat((el.attributes["friction"] || 0).value, 0.5),
                impulse: !el.classList.contains('no-impulse'),
            });
        },
        "g" : function(el){
            let contained = [];
            for(let i = 0; i < el.children.length; i++){
                contained[i] = createObj(el.children[i]);
            }
            if (contained.length == 0) return;
            return Physics.body("compound",{
                name: "movable" in el.classList ? "movable" : "",
                treatment: el.classList.contains("static") ? "static" : "dynamic",
                x: (el.attributes["x"] || 0).value | 0,
                y: (el.attributes["y"] || 0).value | 0,
                children: contained
            });
        }
    };

    // Format/clip images based on type
    let clip = {
        "rect": (obj, img)=>{
            return function(){

                // Adjust to size
                clipboard.width = obj.width;
                clipboard.height = obj.height;

                // scale. forget aspect ratio
                context.drawImage(img, 0, 0, img.width, img.height,
                                0,0, obj.width, obj.height);

                // Set the object src
                obj.view.src = clipboard.toDataURL("image/png");
            }
        },
        "circle": (obj, img)=>{
            return function(){

                let radius = obj.geometry.radius;

                // Adjust to size
                clipboard.width = radius * 2;
                clipboard.height = radius * 2;

                context.save();
                context.arc(radius, radius, radius, 0, 2 * Math.PI, false);
                context.clip();

                // scale. forget aspect ratio
                context.drawImage(img, 0, 0, img.width, img.height,
                                0,0, radius * 2, radius * 2);

                // Set the object src
                obj.view.src = clipboard.toDataURL("image/png");
            }
        },
    }

    // Helper functions
    // Determininstic key lookup given ids
    let keyHash = function(A,B){
        return [A, B].sort().join();
    }

    // get input type
    let getKey = function(code){
        if(code in special){
            return special[code];
        }
        return String.fromCharCode(code);
    }

    let resize = function () {
        let canvas = document.getElementById("viewport");
        if(!canvas) return;

        // Our canvas must cover full height of screen
        // regardless of the resolution
        let height = window.innerHeight;

        // So we need to calculate the proper scaled width
        // that should work well with every resolution
        let ratio = canvas.width/canvas.height;
        let width = height * ratio;
        
        canvas.style.width = width+'px';
        canvas.style.height = height+'px';

        // if boundaries and running, update the boundaries
        if(started && GameFrame.prototype.boundaries){
            viewportBounds = Physics.aabb(0, 0, renderer.width, renderer.height);
            edgeBounce.setAABB(viewportBounds);
        }
    }

    // Setup orientation for mobile
    let orient = function(){
        // Paul warned us: "I am telling you this as a friend. 
        // It exists. It is a thing, but it is a hack. 
        // Please don't use it."
        if(!GameFrame.prototype.debug){
            window.scrollTo(0,1);
            document.body.webkitRequestFullScreen();
        }
    }

    // Render dom to page
    let buildDom = function(){
        // Create scoreboard
        scoreboard.id = "scoreboard";
        document.body.appendChild(scoreboard);

        // Create style element
        // Set background
        let src = (game.attributes["img"] || 0).value;
        if(src){
            style.innerHTML = "#viewport{background-image:url('"+src+"');background-size: cover;}";
            document.body.appendChild(style);
        }

        // Create modal if needed
        if(!GameFrame.prototype.modal) return;
        modal.id = "modal";
        modal.innerHTML =`
            <div id="box">
                <h1 id="modal-title"></h1>
                <div id="comment"></div>
                <button type="button" 
                        id="button" 
                        onclick="GameFrame.prototype.init()" 
                        class="btn btn-primary">Play game</button>
            </div>
            <div id="backdrop"></div>
        `;

        // Set internals
        document.body.appendChild(modal);
        document.getElementById("modal-title").innerHTML = GameFrame.prototype.name;
        document.getElementById("comment").innerHTML = GameFrame.prototype.instructions;
    }

    // Create the object
    let createObj = function(el){
        let type = el.nodeName.toLowerCase();
        let f = taxonomy[type];
        if(f == undefined){
            console.warn("Woops, element " + type + " not known.");
            return;
        }
        let obj = f(el)
        let src = (el.attributes["img"] || 0).value;
        if(src && clip[type]){
            obj.gf_type = type;
            GameFrame.prototype.image(obj, src);
        }
        return obj;
    }

    // add obj to lookups and hashmaps
    let buildObj = function(el){
        let obj = createObj(el);

        if(obj){
            let ids = [];
            if(!el.id){
                el.id = "generated_" + seed;
                seed += 1;
            }
            lookup["#" + el.id] = obj;
            ids[ids.length] = "#" + el.id;
            for (let j = 0; j < el.classList.length; j++) {
                let c = "." + el.classList[j];
                if(!(c in lookup)){
                    lookup[c] = new Set();
                }
                lookup[c].add(obj);
                ids[ids.length] = c;
            }
            obj.ids = ids;
            world.add(obj);
        }
    }

    // start off all the physics
    let physics = function(){
        Physics({
            sleepDisabled:true
        }, function(w){

            // Global scope
            world = w;

            // Build from svg
            for (let i = 0; i < children.length; i++) {
                buildObj(children[i]);
            }

            renderer = Physics.renderer('canvas', {
                el: 'viewport',
                meta: false, // don't display meta data
                width:1366,
                height:768,
                autoResize: false
            });

            // add the renderer
            world.add(renderer);

            // collisions
            world.on('collisions:detected', function(data){
                let col;
                for (let i = data.collisions.length - 1; i >= 0; i--) {
                    col = data.collisions[i];
                    if(!(col.bodyA.ids && col.bodyB.ids)) continue;
                    for (let j = 0; j < col.bodyA.ids.length; j++) {
                        for (let k = 0; k < col.bodyB.ids.length; k++) {
                            let hash = keyHash(col.bodyA.ids[j], col.bodyB.ids[k]);
                            if(hash in collisions) {
                                datum = {};
                                datum[col.bodyA.ids[j]] = col.bodyA;
                                datum[col.bodyB.ids[k]] = col.bodyB;
                                collisions[hash](datum, lookup);
                            }
                        }
                    }
                }
            });

            // click action
            world.on('interact:click', function(data){
                let key = "click";
                if(key in keyEvents){
                    for (let id in keyEvents[key]) {
                        keyEvents[key][id](lookup[id], lookup, data);
                    }
                }
            });

            // Add physics
            world.add([
                Physics.behavior('body-collision-detection', { checkAll: false }),
                Physics.behavior('sweep-prune'),
                Physics.behavior('interactive-custom', {el: renderer.el }).applyTo(world.find({ name: 'movable' }))
            ]);

            if(GameFrame.prototype.boundaries) world.add(edgeBounce);
            if(GameFrame.prototype.impulse) world.add(Physics.behavior('body-impulse-response').applyTo(world.find({impulse: true})));
            if(GameFrame.prototype.gravity) world.add(Physics.behavior('constant-acceleration'));

            // Set up step
            world.on('step', function(){
                let dt = t - pt;
                for (let i = 0; i < loops.length; i++) {
                    loops[i](lookup, dt);
                }
                world.render();
            });

            // subscribe to ticker to advance the simulation
            if(!started){
                Physics.util.ticker.on(function(time){
                    pt = t;
                    t = time;
                    if(pt == 0) pt = t;
                    world.step(time);
                });
            }

            // Start it off
            Physics.util.ticker.start();
            started = true;
        });
    };

    // Event listeners
    // capture keys
    document.addEventListener('keydown', function(e){
        let key = getKey(e.keyCode);
        keys[key] = true;
        if(key in keyEvents){
            for (let id in keyEvents[key]) {
                keyEvents[key][id](lookup[id], lookup);
            }
        }
    });
    document.addEventListener('keyup', function(e){
        keys[getKey(e.keyCode)] = false;
    });

    // Responsive?
    window.addEventListener('resize', resize, true);

    // Build out the GameFrame class
    // Construct sets up state
    GameFrame = function(settings, f){

        // Set score to 0 if not exists
        localStorage.setItem("highscore", (localStorage["highscore"] | 0));

        // Set settings
        GameFrame.prototype.name = settings["name"] || "GameFrame Game";
        GameFrame.prototype.instructions = settings["instructions"] || "instructions";
        GameFrame.prototype.boundaries = "boundaries" in settings ? settings["boundaries"] : true;
        GameFrame.prototype.impulse = "impulse" in settings ? settings["impulse"] : true;
        GameFrame.prototype.gravity = "gravity" in settings ? settings["gravity"] : false;
        GameFrame.prototype.debug = "debug" in settings ? settings["debug"] : false;
        GameFrame.prototype.modal = "modal" in settings ? settings["modal"] : true;
        GameFrame.prototype.game = f;

        // Create modal and other pieces
        buildDom();
    }

    // Our API
    // Check for collisions between obj types
    GameFrame.prototype.collision = function(A,B,f){
        let key = keyHash(A,B);
        collisions[key] = f;
    }

    // Kill the obj
    GameFrame.prototype.remove = function(obj){
        world.removeBody(obj);

        delete lookup[obj.ids[0]];
        for (let i = 1; i < obj.ids.length; i++) {
            lookup[obj.ids[i]].delete(obj);
        }
    }

    // Bind events
    GameFrame.prototype.registerKeys = function(id, keys){
        for (let key in keys) {
            if(!(key in keyEvents)){
                keyEvents[key] = {};
            }
            keyEvents[key][id] = keys[key];
        }
    }

    // On loop execution
    GameFrame.prototype.registerLoops = function(f){
        loops[loops.length] = f;
    }

    // Create a obj from a template
    GameFrame.prototype.template = function(id, x, y){
        let el = templates.querySelector(id).cloneNode(true);
        el.setAttribute('x', (x || el.attributes["x"]) | 0);
        el.setAttribute('y', (y || el.attributes["y"]) | 0);
        buildObj(el);
    }

    // Change the image of an object
    GameFrame.prototype.image = function(obj, src){
        let type = obj.gf_type
        if(!type) return;

        let img = new Image();
        obj.view = new Image();
        img.setAttribute('crossOrigin', 'anonymous');
        img.onload = clip[type](obj, img);
        img.src = src;
    }


    // Kill the game and launch modal
    GameFrame.prototype.gameOver = function(){
        modal.classList = "";
        document.getElementById("viewport").remove();
        document.getElementById("modal-title").innerHTML = "Gameover";
        let comment = document.getElementById("comment");
        comment.innerHTML = "Score:" + score;
        comment.innerHTML += "<br/> Highscore:" + localStorage["highscore"];
        Physics.util.ticker.stop();
        world.destroy();
    }

    // Increment the score
    GameFrame.prototype.score = function(value){
        score += value || 0;
        if(score > (localStorage["highscore"] | 0)){
            localStorage.setItem("highscore", score);
        }
        scoreboard.innerHTML = "Score: " + score;
    }

    // Restart the game and physics
    GameFrame.prototype.init = function() {

        // Hide modal
        modal.classList = "hidden";

        // Set orientation
        orient();

        // reset vars
        score = 0
        t = 0;
        tp = 0;
        collisions = {};
        keyEvents = {};
        loops = [];
        lookup = {};

        // Start the game
        physics();
        GameFrame.prototype.score(0);
        GameFrame.prototype.game(this);
        resize();
    };

})();
