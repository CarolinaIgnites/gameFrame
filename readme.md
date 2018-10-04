                  ▄▄▄▄                                          
                 ██▀▀▀                                          
      ▄███▄██  ███████    ██▄████   ▄█████▄  ████▄██▄   ▄████▄  
     ██▀  ▀██    ██       ██▀       ▀ ▄▄▄██  ██ ██ ██  ██▄▄▄▄██ 
     ██    ██    ██       ██       ▄██▀▀▀██  ██ ██ ██  ██▀▀▀▀▀▀ 
     ▀██▄▄███    ██       ██       ██▄▄▄███  ██ ██ ██  ▀██▄▄▄▄█ 
      ▄▀▀▀ ██    ▀▀       ▀▀        ▀▀▀▀ ▀▀  ▀▀ ▀▀ ▀▀    ▀▀▀▀▀  
      ▀████▀▀                                                   
                                  
---

About
===

Gameframe is a wrapper for [PhysicsJS](https://github.com/wellcaffeinated/PhysicsJS/wiki), with the idea of making basic game development as simple as possible. The project was developed for Highschool out reach at RidgeView Highscool, as part of the University of South Carolina, Google IgniteCS program. The results of this program can be found at [www.carolinaignites.org](https://www.carolinaignites.org)

Starting out
===

Physics objecs are specificed in DOM, under the `<svg id="game">` element. The game frame object is initialized, a modal is opened, and the games can begin.

Here is an example of flappy bird:
```html
<link href="//www.carolinaignites.org/assets/css/gameframe.css" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/PhysicsJS/0.7.0/physicsjs-full.min.js"></script>
<script src="//www.carolinaignites.org/assets/js/interactive-custom.js"></script>
<script src="//www.carolinaignites.org/assets/js/gameframe.js"></script>

<svg id="game">
        <rect class="bound static" width="2000" height="50" x=1000 y=0> </rect>
        <circle id="player" r="50" x=500 y=350 img="bird0.gif"> </circle>
        <rect class="bound static" width="2000" height="50" x=1000 y=768> </rect>
</svg>

<svg id="templates">
    <g class="block static">
        <rect width="50" height="200" x=0 y=0> </rect>
        <rect width="50" height="200" x=0 y=500> </rect>
    </g>
</svg>


<script type="text/javascript">

    new GameFrame({
            "name": "The Bird is the word",
            "instructions": `Remember flappy bird? Well it's back in 40 lines of code`,
            "boundaries": false,
            "impulse": true,
            "gravity": true,
        },function(gf){
            let image = 0;
            gf.collision(".bound", "#player", function(data, lookup){
                gf.gameOver();
            })
            gf.collision(".block", "#player", function(data, lookup){
                gf.gameOver();
            })
            gf.registerKeys("#player", {
                'click': function(player, lookup){
                    player.state.vel.y -= .5;
                    image = (image + 1) % 4;
                    gf.image(player, "bird" + image + ".gif");
                },
            })
            gf.registerLoops(function(lookup){
                for (let obj of lookup[".block"]) {
                    if(obj.state.pos.x > 1000){
                        gf.remove(obj);
                        gf.template(".block", 0, Math.random() * 400)
                        gf.score(10);
                    }else{
                        obj.state.pos.x += 4;
                    }
                }
            });
            // Start off with random points
            gf.template(".block", -500, Math.random() * 400)
            gf.template(".block", 0, Math.random() * 400)
    });
</script>
```


Please refer to other examples for other uses.


The API
===

HTML
--

### SVG wrappers
#### Main game wrapper
`<svg id="game" img="URI" bounce>`
All elements under this will be rendered to the canvas

#### Template wrapper
`<svg id="templates"> </svg>`
All elements under this can be added by the `GameFrame.prototype.template` function

### Object types
#### Rectangle
`<rect width="2000" height="50" x=1000 y=0> </rect>`

Creates a rectangle object

    id - string - CSS identifier referenced by #<id> in GameFrame lookup (optional)

    class - string - CSS identifier referenced by .<class> in GameFrame lookup (optional)

    src - string URI - URI specifying initial image of the rectangle (optional)

    bounce - float - the coefficent of restitution, from 0-1.0 (1 is most bouncy)

    friction - float - the coefficent of friction, from 0-1.0 (1 is frictional)

    width - number - width of the object 

    height - number - height of the object

    x - number - x center point of rectangle

    y - number - y center point of rectangle

#### Circle
`<circle r="50" x=500 y=350> </circle>`

Creates a circle object

    id - string - CSS identifier referenced by #<id> in GameFrame lookup (optional)

    class - string - CSS identifier referenced by .<class> in GameFrame lookup (optional)

    src - string URI - URI specifying initial image of the circle (optional)

    bounce - float - the coefficent of restitution, from 0-1.0. 1 is most bouncy, default 0.5 (optional)

    friction - float - the coefficent of friction, from 0-1.0. 1 is frictional, default 0.5 (optional)

    r - number - radius of the circle 

    x - number - x center point of circle

    y - number - y center point of circle

#### Group
`<g x=500 y=350> </g>`

Creates a group of objects, where everything nested inside the group is considered as part of one object

    id - string - CSS identifier referenced by #<id> in GameFrame lookup (optional)

    class - string - CSS identifier referenced by .<class> in GameFrame lookup (optional)

    x - number - x center point of group

    y - number - y center point of group


### Object classes
`.static`
When Collision and gravity is on, this object will stay in place even when bumped

`.movable`
This should be draggable and movable by clicking and dragging from the user 


Javascript
--

#### Main initializer to start game
`GameFrame = function(settings, f)`

    settings - hashmap - Contains meta information for the game to start 
```javascript
    {
        "name": "This is the name for your game",
        "instructions": `This exaplains your game`,
        "debug": false, // default false, this stop the game from fullscreen mode
        "modal": true, // default true, this will create the start modal on object construction
        "boundaries": true, // default true, this will cause collisions with edge of screen
        "impulse": true, // default true, this will allow for reactive collisions
        "gravity": false, // default false, this will cause a downwards pulling force on all objects
        "external_cache": (key, value)=> {}, // default noop, this is a callback for setting an external cache
        "cache_proxy": (src)=> src, // default identity, this is a callback setting the url for an external cache lookup
    }
```

    f(gf) - function - callback once game frame has initialized itself

---

#### ***collision*** - Check for collisions between obj types
`GameFrame.prototype.collision = function(A,B,f)`

    A - string- CSS identifier for object

    B - string- CSS identifier for object

    f(data, lookup) - function - Handler for collision callback
        data - Hashmap of objects collided eg. 
```javascript
            data = {
                "#obj": [Object],
                ".obj": [Object]
            }
```

        lookup - Hashmap of all objects by CSS selectors

---

#### ***remove*** - Kill the obj
`GameFrame.prototype.remove = function(obj)`

    obj - object - Physics Object to be deleted from the game

---

#### ***registerKeys*** - Bind events
`GameFrame.prototype.registerKeys = function(id, keys)`


    id - string - Element selector for object to respond to keys

    keys - hashmap - hashmap of keys and the corresponding callbacks eg. 
```javascript
        {
            // Standard letter keys
            'a':function(obj, lookup){alert('a was pressed')},
            'b':function(obj, lookup){alert('b was pressed')},
            ...

            // Arrow keys
            'up' : function(obj, lookup){alert('up was pressed')},
            'down' : function(obj, lookup){alert('down was pressed')},
            'left' : function(obj, lookup){alert('left was pressed')},
            'right' : function(obj, lookup){alert('right was pressed')},

            // Click events
            'click': function(obj, lookup){alert('game was clicked');
            'poke': function(obj, lookup){alert('obj was clicked');
        }
```


---

#### ***registerLoops*** - On loop execution
`GameFrame.prototype.registerLoops = function(f)`

    f(lookup) - function - runs on everyloop

---

#### ***template*** - Create a obj from a template
`GameFrame.prototype.template = function(id, x, y)`

    id - string - CSS selector for template element

    x - number - starting x coordinate for template object

    y - number - starting y coordinate for template object

---

#### ***image*** - Change the image of an object
`GameFrame.prototype.image = function(obj, src)`

    obj - object - Physics Object to change image

    src - string URI - URI specifying new image

---

#### ***gameOver*** - Kill the game and launch modal
`GameFrame.prototype.gameOver = function()`


---

#### ***score*** - Increment the score
`GameFrame.prototype.score = function(value)`

    value - number - Adds this number to the total score

---
