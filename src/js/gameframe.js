var Physics = require('physicsjs/dist/physicsjs-full.min.js');

var GameFrame;

// Keep everything in scope
(() => {
  // Building dom
  let game, templates, scoreboard, modal, style, clipboard, context, children;

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
  let running = true;

  /// Global physics vars
  let world;
  let renderer;

  // key references
  let keys = {};
  let special = {
    38 : "up",
    40 : "down",
    37 : "left",
    39 : "right",
  }

  // Our set dimension values. These are chosent o represent commpon laptop
  // aspect ratios.
  const WIDTH = 1366;
  const HEIGHT = 768;

  // Our set dimension values. These are chosent o represent commpon laptop
  // aspect ratios.
  const WIDTH = 1366;
  const HEIGHT = 768;

  // helpers
  let toFloat = (val, fallback) => { return isNaN(val) ? fallback : val; }

  // For boundary
  let viewportBounds = Physics.aabb(0, 0, window.innerWidth, window.innerHeight)
  let edgeBounce = Physics.behavior('edge-collision-detection', {
    aabb : viewportBounds,
    restitution : 0,
    cof : 0,
  });

  // Objs for lookup
  let Cache = function() { this.cache = {}; };
  Cache.prototype.key = (obj, src) => {
    return {
      "rect" : [ obj.width, obj.height, src ].toString(),
      "circle" : [ obj.geometry.radius, src ].toString(),
    }[obj.gf_type];
  };
  Cache.prototype.attempt = function(
      obj, src) { return this.cache[this.key(obj, src)]; };
  Cache.prototype.set = function(key, value) {
    this.cache[key] = value;
    GameFrame.prototype.external_cache(key, value);
  };
  let cache = new Cache();
  // Turn svg to object
  let taxonomy = {
    "circle" : function(el) {
      return Physics.body("circle", {
        name : el.classList.contains("movable") ? "movable" : "",
        treatment : el.classList.contains("static") ? "static" : "dynamic",
        x : (el.attributes["cx"] || el.attributes["x"] || 0).value | 0,
        y : (el.attributes["cy"] || el.attributes["y"] || 0).value | 0,
        radius : (el.attributes["r"] || 0).value | 0,
        vy : (el.attributes["vy"] || 0).value,
        vx : (el.attributes["vx"] || 0).value,
        restitution : toFloat((el.attributes["bounce"] || 0).value, 0.5),
        cof : toFloat((el.attributes["friction"] || 0).value, 0.5),
        impulse : !el.classList.contains('no-impulse'),
      });
    },
    "rect" : function(el) {
      return Physics.body("rectangle", {
        name : el.classList.contains("movable") ? "movable" : "",
        treatment : el.classList.contains("static") ? "static" : "dynamic",
        width : (el.attributes["width"] || 0).value | 0,
        height : (el.attributes["height"] || 0).value | 0,
        x : (el.attributes["x"] || 0).value | 0,
        y : (el.attributes["y"] || 0).value | 0,
        vy : (el.attributes["vy"] || 0).value,
        vx : (el.attributes["vx"] || 0).value,
        restitution : toFloat((el.attributes["bounce"] || 0).value, 0.5),
        cof : toFloat((el.attributes["friction"] || 0).value, 0.5),
        impulse : !el.classList.contains('no-impulse'),
      });
    },
    "g" : function(el) {
      let contained = [];
      for (let i = 0; i < el.children.length; i++) {
        contained[i] = createObj(el.children[i]);
      }
      if (contained.length == 0)
        return;
      return Physics.body("compound", {
        name : "movable" in el.classList ? "movable" : "",
        treatment : el.classList.contains("static") ? "static" : "dynamic",
        x : (el.attributes["x"] || 0).value | 0,
        y : (el.attributes["y"] || 0).value | 0,
        children : contained
      });
    }
  };

  // Format/clip images based on type
  let clip = {
    "rect" : (obj, img, src) => {
      return function() {
        // Adjust to size
        clipboard.width = obj.width;
        clipboard.height = obj.height;

        // scale. forget aspect ratio
        context.drawImage(img, 0, 0, img.width, img.height, 0, 0, obj.width,
                          obj.height);

        // Set the object src
        obj.view.src = clipboard.toDataURL("image/png");
        cache.set(cache.key(obj, src), obj.view.src);
      }
    },
    "circle" : (obj, img, src) => {
      return function() {
        let radius = obj.geometry.radius;

        // Adjust to size
        clipboard.width = radius * 2;
        clipboard.height = radius * 2;

        context.save();
        context.arc(radius, radius, radius, 0, 2 * Math.PI, false);
        context.clip();

        // scale. forget aspect ratio
        context.drawImage(img, 0, 0, img.width, img.height, 0, 0, radius * 2,
                          radius * 2);

        // Set the object src
        obj.view.src = clipboard.toDataURL("image/png");
        cache.set(cache.key(obj, src), obj.view.src);
      }
    },
  };

  // Helper functions
  // Determininstic key lookup given ids
  let keyHash = function(A, B) { return [ A, B ].sort().join(); };

  // get input type
  let getKey = function(code) {
    if (code in special) {
      return special[code];
    }
    return String.fromCharCode(code);
  };

  let resize = function() {
    let canvas = document.getElementById("viewport");
    if (!canvas)
      return;

    // Our canvas must cover full height of screen
    // regardless of the resolution
    let height = window.innerHeight;

    // So we need to calculate the proper scaled width
    // that should work well with every resolution
    let ratio = canvas.width / canvas.height;
    let width = height * ratio;

    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.style.left = ((window.innerWidth - width) / 2) + "px"

    // if boundaries and running, update the boundaries
    if (started && GameFrame.prototype.boundaries) {
      viewportBounds = Physics.aabb(0, 0, renderer.width, renderer.height);
      edgeBounce.setAABB(viewportBounds);
    }
  };

  // Setup orientation for mobile
  let orient = function() {
    // Paul warned us: "I am telling you this as a friend.
    // It exists. It is a thing, but it is a hack.
    // Please don't use it."
    if (!GameFrame.prototype.debug) {
      window.scrollTo(0, 1);
      if (document.body.webkitRequestFullScreen)
        document.body.webkitRequestFullScreen();
    }
  };

  // Get existing context from the page.
  let rebindDom = function() {
    game = document.getElementById('game') || {attributes : {}};
    templates = document.getElementById('templates');
    scoreboard = document.createElement("div");
    modal = document.createElement("div");
    style = document.createElement("style");
    clipboard = document.createElement("canvas");
    context = clipboard.getContext("2d");
    children = game.children || [];
  };

  // Render dom to page
  let buildDom = function() {
    rebindDom();

    // Create scoreboard
    scoreboard.id = "scoreboard";
    document.body.appendChild(scoreboard);

    // Create style element
    // Set background
    let src = (game.attributes["img"] || 0).value;
    if (src) {
      Promise.resolve(GameFrame.prototype.cache_proxy(src, "background"))
          .then(function(src) {
            style.innerHTML = "#viewport{background-image:url(" + src +
                              ");background-size: cover;}";
            document.body.appendChild(style);

            if (GameFrame.prototype.cache_background) {
              let img = new Image();
              img.onload = function() {
                clipboard.width = WIDTH;
                clipboard.height = HEIGHT;
                // scale. forget aspect ratio
                context.drawImage(img, 0, 0, img.width, img.height, 0, 0, WIDTH,
                                  HEIGHT);
                // Set the object src
                cache.set("background", clipboard.toDataURL("image/png"));
              };
              img.src = src;
            }
          });
    }

    // Create modal if needed
    if (!GameFrame.prototype.modal) {
      GameFrame.prototype.init()
      return;
    }
    modal.id = "modal";
    modal.innerHTML = `
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
    document.getElementById("comment").innerHTML =
        GameFrame.prototype.instructions;
  };

  // Create the object
  let createObj = function(el) {
    let type = el.nodeName.toLowerCase();
    let f = taxonomy[type];
    if (f == undefined) {
      console.warn("Woops, element " + type + " not known.");
      return;
    }
    let obj = f(el)
    let src = (el.attributes["img"] || 0).value;
    if (src && clip[type]) {
      obj.gf_type = type;
      GameFrame.prototype.image(obj, src);
    }
    return obj;
  };

  // add obj to lookups and hashmaps
  let buildObj = function(el) {
    let obj = createObj(el);

    if (obj) {
      let ids = [];
      if (!el.id) {
        el.id = "generated_" + seed;
        seed += 1;
      }
      lookup["#" + el.id] = obj;
      ids[ids.length] = "#" + el.id;
      for (let j = 0; j < el.classList.length; j++) {
        let c = "." + el.classList[j];
        if (!(c in lookup)) {
          lookup[c] = new Set();
        }
        lookup[c].add(obj);
        ids[ids.length] = c;
      }
      obj.ids = ids;
      world.add(obj);
    }
    return obj;
  };

  // start off all the physics
  let physics = function() {
    Physics({sleepDisabled : true}, function(w) {
      // Global scope
      world = w;

      // set edges
      edgeBounce = Physics.behavior('edge-collision-detection', {
        aabb : viewportBounds,
        restitution : toFloat((game.attributes["bounce"] || 0).value, 0.5),
        cof : toFloat((game.attributes["friction"] || 0).value, 0.5),
      });

      // Build from svg
      for (let i = 0; i < children.length; i++) {
        buildObj(children[i]);
      }

      renderer = Physics.renderer('canvas', {
        el : 'viewport',
        meta : false, // don't display meta data
        width : WIDTH,
        height : HEIGHT,
        autoResize : false
      });

      // add the renderer
      world.add(renderer);

      // collisions
      world.on('collisions:detected', function(data) {
        let col;
        for (let i = data.collisions.length - 1; i >= 0; i--) {
          col = data.collisions[i];
          if (!(col.bodyA.ids && col.bodyB.ids))
            continue;
          for (let j = 0; j < col.bodyA.ids.length; j++) {
            for (let k = 0; k < col.bodyB.ids.length; k++) {
              let hash = keyHash(col.bodyA.ids[j], col.bodyB.ids[k]);
              if (hash in collisions) {
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
      world.on('interact:click', function(data) {
        let key = "click";
        if (key in keyEvents) {
          for (let id in keyEvents[key]) {
            keyEvents[key][id](lookup[id], lookup, data);
          }
        }
      });

      // Add physics
      world.add([
        Physics.behavior('body-collision-detection', {checkAll : false}),
        Physics.behavior('sweep-prune'),
        Physics.behavior('interactive-custom', {el : renderer.el})
            .applyTo(world.find({name : 'movable'}))
      ]);

      if (GameFrame.prototype.boundaries)
        world.add(edgeBounce);
      if (GameFrame.prototype.impulse)
        world.add(Physics.behavior('body-impulse-response')
                      .applyTo(world.find({impulse : true})));
      if (GameFrame.prototype.gravity)
        world.add(Physics.behavior('constant-acceleration'));

      // Set up step
      world.on('step', function() {
          if (running) {
             pt = t;
            t = time;
            if (pt == 0)
              pt = t;
            world.step(time);
          }
         });
        let dt = t - pt;
        for (let i = 0; i < loops.length; i++) {
          loops[i](lookup, dt);
        }
        world.render();
      });

      // subscribe to ticker to advance the simulation
      if (!started) {
        Physics.util.ticker.on(function(time) {
          pt = t;
          t = time;
          if (pt == 0)
            pt = t;
          world.step(time);
        });
      }

      // Start it off
      Physics.util.ticker.start();
      started = true;
    });
  };

  // Event listeners
  let processKey = function(key) {
    keys[key] = true;
    if (key in keyEvents) {
      for (let id in keyEvents[key]) {
        keyEvents[key][id](lookup[id], lookup);
      }
    }
  };
  // capture keys
  document.addEventListener('keydown', function(e) {
    let key = getKey(e.keyCode);
    processKey(key);
  });
  document.addEventListener('keyup',
                            function(e) { keys[getKey(e.keyCode)] = false; });

  // Responsive?
  window.addEventListener('resize', resize, true);

  // Build out the GameFrame class
  // Construct sets up state
  GameFrame = function(settings, f) {
    // Set settings
    GameFrame.prototype.name = settings["name"] || "GameFrame Game";
    GameFrame.prototype.instructions =
        settings["instructions"] || "instructions";
    GameFrame.prototype.boundaries =
        "boundaries" in settings ? settings["boundaries"] : true;
    GameFrame.prototype.impulse =
        "impulse" in settings ? settings["impulse"] : true;
    GameFrame.prototype.gravity =
        "gravity" in settings ? settings["gravity"] : false;
    GameFrame.prototype.debug = "debug" in settings ? settings["debug"] : false;
    GameFrame.prototype.modal = "modal" in settings ? settings["modal"] : true;

    // For external caching
    GameFrame.prototype.external_cache = "external_cache" in settings
                                             ? settings["external_cache"]
                                             : function() {};
    GameFrame.prototype.cache_proxy = "cache_proxy" in settings
                                          ? settings["cache_proxy"]
                                          : function(src) { return src; };
    GameFrame.prototype.cache_background = "cache_background" in settings
                                          ? settings["cache_background"]
                                          : false;

    // For external score keeping
    GameFrame.prototype.set_score =
        "set_score" in settings
            ? settings["set_score"]
            : function(score) { localStorage.setItem("highscore", score) };
    GameFrame.prototype.get_score =
        "get_score" in settings
            ? settings["get_score"]
            : function(src) { return (localStorage["highscore"] | 0); };

    // For external gameover hook.
    GameFrame.prototype.gameOver_hook =
        "gameover_hook" in settings ? settings["gameover_hook"] : function() {};

    // Set score to 0 if not exists
    GameFrame.prototype.set_score(GameFrame.prototype.get_score());

    GameFrame.prototype.game = f;

    // Create modal and other pieces
    buildDom();
  };

  // Our API
  // Check for collisions between obj types
  GameFrame.prototype.collision = function(A, B, f) {
    let key = keyHash(A, B);
    collisions[key] = f;
  };

  // Kill the obj
  GameFrame.prototype.remove = function(obj) {
    world.removeBody(obj);

    delete lookup[obj.ids[0]];
    for (let i = 1; i < obj.ids.length; i++) {
      lookup[obj.ids[i]].delete(obj);
    }
  };

  // Bind events
  let joystick;
  GameFrame.prototype.registerKeys = function(id, keys) {
    for (let key in keys) {
      if (!(key in keyEvents)) {
        keyEvents[key] = {};
      }
      keyEvents[key][id] = keys[key];

      // capture joy stick
      if (!joystick && Object.values(special).indexOf(key) + 1 &&
          typeof nipplejs !== 'undefined') {
        joystick = nipplejs.create({zone : document.body, color : 'blue'});
        joystick.on('dir:up plain:up dir:left plain:left dir:down ' +
                        'plain:down dir:right plain:right',
                    function(evt, data) {
                      let k = data.direction.angle;
                      Object.values(special).forEach(
                          (check) => { keys[check] = check == k; })
                      processKey(k);
                    });
      }
    }
  };

  // On loop execution
  GameFrame.prototype.registerLoops = function(f) { loops[loops.length] = f; };

  // Create a obj from a template
  GameFrame.prototype.template = function(id, x, y) {
    let el = templates.querySelector(id).cloneNode(true);
    el.setAttribute('x', (x || el.attributes["x"]) | 0);
    el.setAttribute('y', (y || el.attributes["y"]) | 0);
    return buildObj(el);
  };

  // Change the image of an object
  GameFrame.prototype.image = function(obj, src) {
    let type = obj.gf_type
    if (!type) return;

    let img = new Image();
    obj.view = new Image();
    let image;
    if (image = cache.attempt(obj, src)) {
      obj.view.src = image;
    } else {
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = clip[type](obj, img, src);
      Promise.resolve(GameFrame.prototype.cache_proxy(src, cache.key(obj, src)))
          .then(function(src) {
            img.src = src;
          });
    }
  };

  // Kill the game and launch modal
  GameFrame.prototype.gameOver = function() {
    modal.classList = "";
    document.getElementById("viewport").remove();
    document.getElementById("modal-title").innerHTML = "Gameover";
    let comment = document.getElementById("comment");
    // In case there's latency between get_score and set_score, we take the
    // max. Noticed bug in app implementation.
    let highscore = Math.max(score, GameFrame.prototype.get_score());
    comment.innerHTML = "Score:" + score;
    comment.innerHTML += "<br/> Highscore:" + highscore;
    if (joystick) {
      joystick.destroy();
      joystick = undefined;
    }
    Physics.util.ticker.stop();
    world.destroy();
    console.log(GameFrame.prototype.gameOver_hook)
    GameFrame.prototype.gameOver_hook();
  };

  // Increment the score
  GameFrame.prototype.score = function(value) {
    score += value || 0;
    if (score > GameFrame.prototype.get_score()) {
      GameFrame.prototype.set_score(score);
    }
    scoreboard.innerHTML = "Score: " + score;
  };

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
