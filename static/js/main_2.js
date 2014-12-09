// Static settings variables
var DEBUG = true,
    GAME_WIDTH = 800,
    GAME_HEIGHT = 600,
    GROUND_HEIGHT = 128,
    PATRICK_VELOCITY_X = 300,
    PATRICK_VELOCITY_Y_PATTY = 400,
    PATRICK_VELOCITY_Y_GRAVITY_LOSS = 30,
    PATTY_SPEED_BOOST = 350,
    ENERGY_CAP = 500,
    ALTITUDE_CHUNK = 4000,
    ALTITUDE_SPEED_INCREASE_RATE = 1 / 60,
    SPEED_GAME_LOSS_THRESHHOLD = -1000,
    GAME_TEXT = 'Lucida Grande',
    BLACK_HEX = '#000',
    GREEN_HEX = '#5DFC0A',
    COOKIE_USERNAME_KEY = 'fatty_big_star_username',
    COOKIE_EXPIRATION_DAYS = 7;

var game = new Phaser.Game(
        GAME_WIDTH,
        GAME_HEIGHT,
        Phaser.AUTO,
        'game_box',
        {
            preload: preload,
            create: create,
            update: update
        }
);

var DIPLOMACY = {
    OBSTACLE: 0,
    POWERUP: 1,
    NEUTRAL: 2
};

var entity_spawn_map = {
    'bubble': {
        // all rates are in seconds
        spawn_rate: Phaser.Timer.SECOND * 0.1,
        spawn_timer: null,
        spawn_timer_params: [add_grouped, this, 'bubble'],
        diplomacy: DIPLOMACY.NEUTRAL
    },
    'patty': {
        spawn_rate: Phaser.Timer.SECOND * 0.25,
        spawn_timer: null,
        spawn_timer_params: [add_krabby_patty, this],
        RATE_CAP: Phaser.Timer.SECOND * 2,
        DIPLOMACY: DIPLOMACY.POWERUP
    },
    'jellyfish': {
        spawn_rate: Phaser.Timer.SECOND * 3,
        spawn_timer: null,
        spawn_timer_params: [add_grouped, this, 'jellyfish'],
        RATE_CAP: Phaser.Timer.SECOND * 2,
        diplomacy: DIPLOMACY.OBSTACLE
    },
    'shark': {
        spawn_rate: Phaser.Timer.SECOND * 3.5,
        spawn_timer: null,
        spawn_timer_params: [add_shark, this],
        RATE_CAP: Phaser.Timer.SECOND * 2,
        diplomacy: DIPLOMACY.OBSTACLE
    },
    'clam': {
        spawn_rate: Phaser.Timer.SECOND * 2,
        spawn_timer: null,
        spawn_timer_params: [add_clam, this],
        RATE_CAP: Phaser.Timer.SECOND * 2,
        diplomacy: DIPLOMACY.OBSTACLE
    },
    'squid': {
        spawn_rate: Phaser.Timer.SECOND * 13,
        spawn_timer: null,
        spawn_timer_params: [add_squid, this],
        RATE_CAP: Phaser.Timer.SECOND * 7,
        diplomacy: DIPLOMACY.OBSTACLE
    },
    'shield': {
        spawn_rate: Phaser.Timer.SECOND * 5,
        spawn_timer: null,
        spawn_timer_params: [add_bubble_shield, this],
        RATE_CAP: Phaser.Timer.SECOND * 15,
        diplomacy: DIPLOMACY.POWERUP
    }
};


function preload() {
    game.load.image('ocean', 'static/imgs/undersea.jpg');
    game.load.image('black_bg', 'static/imgs/game_over.png');
    game.load.image('ground', 'static/imgs/platform.png');
    game.load.image('coral_ledge', 'static/imgs/coral_ledge.png');
    game.load.image('coral_side', 'static/imgs/coral_side.png');
    game.load.spritesheet('coral', 'static/imgs/coral_sprite.png', 300, 208);
    game.load.spritesheet('seaweed', 'static/imgs/seaweed_sprite.png', 48, 60);

    game.load.spritesheet('patrick', 'static/imgs/patrick_sprites.png', 46, 54);
    game.load.image('patty', 'static/imgs/patty.png');
    game.load.image('bubble', 'static/imgs/bubble.png');
	game.load.image('clam', 'static/imgs/clam.png');
    game.load.spritesheet('shark', 'static/imgs/sharks.png', 103,45);
    game.load.spritesheet('squid', 'static/imgs/squidsheet.png', 49, 121);
    game.load.spritesheet('ink', 'static/imgs/ink.png', 600, 600);
    game.load.spritesheet('jellyfish', 'static/imgs/jellyfish_sprites.png', 29, 25);

    game.load.spritesheet('aura_good', 'static/imgs/powerup_sprite.png', 192, 192);
    game.load.image('golden_bubble', 'static/imgs/golden_bubble.png');
    game.load.image('energy_bar', 'static/imgs/energy_bar.png');
    game.load.image('empty_energy_bar', 'static/imgs/empty_energy_bar.png');

    game.load.image('sound_off_button', 'static/imgs/turn_off_sound.png');
    game.load.image('sound_on_button', 'static/imgs/turn_on_sound.png');

    game.load.audio('background_music', ['static/sounds/485299_Underwater-Grotto-T.mp3']);
    game.load.audio('patrick_hurt', ['static/sounds/patrick_hurt.mp3']);
    game.load.audio('bubble_pop', ['static/sounds/bubble_pop.wav']);
}


var _____,

    // Physics varaibles
    speed = 0,
    acceleration = 0,
    altitude = 0,
    energy = 0,
    patty_boost_timer = 0,

    // Every 4000 altitude, the game gets 'harder', powerups and patties
    // are spawned rarer while obstacles are spawned more frequently
    // This # was chosen b/c 4000 altitude gets traversed every few seconds
    altitude_checkmark = ALTITUDE_CHUNK,
    final_altitude = 0,

    // Entity groups
    player,
    platforms,
    patties,
    jellyfishes,
    cursors,
    bubbles,
    aura,
    sharks,
    energy_bar,
    inks,
    squids,
	clams,
    corals,
    seaweeds,
    bubble_shields,
    shield,

    // Text
    altitude_text,
    energy_text,
    press_space_blink_text,

    // Timer,
    squid_timer,

    // Music
    sounds,

    // Flags
    facing_right = true,
    game_ended = false,
    set_spawn_timers = false,
    in_shield = false;


/*
 * NOTE: Sprites are rendered in the order in which their
 * objects or groups are declared, e.g., `inks` is intentionally
 * at the very end because we want the ink to be displayed over
 * other other entities. Redeclaring an object or group will
 * effectively bring that sprite back to the top.
 */
function create() {
    sounds = {
        bg_music: game.add.audio('background_music'),
        hurt: game.add.audio('patrick_hurt'),
        bubble_pop: game.add.audio('bubble_pop'),
    };

    // sounds.bg_music.play(); TODO: play on repeat

    game.physics.startSystem(Phaser.Physics.ARCADE);

    game.add.sprite(0, 0, 'ocean');

    platforms = game.add.group();
    platforms.enableBody = true;
    var ground = platforms.create(
                        0,
                        game.world.height - GROUND_HEIGHT,
                        'ground');

    // Scale ground to fit the width of the game
    ground.scale.setTo(2, 4);

    // `body.immovable` set prevents movement after collisions
    ground.body.immovable = true;

    player = game.add.sprite(
                game.world.width / 2,
                game.world.height - 150,
                'patrick');
    game.physics.arcade.enable(player);
    player.body.immovable = true;
    player.body.collideWorldBounds = true;

    player.animations.add('swimming',
                          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                          60,
                          true);
    player.animations.add('falling',
                          [11, 12, 13],
                          30,
                          true);
    player.animations.add('walking',
                          [14, 15, 16, 17, 18, 19, 20, 21, 22],
                          25,
                          true);

    player.animations.play('swimming');
    player.anchor.setTo(0.5, 0.5);

    aura = game.add.sprite(50, 50, 'aura_good');
    aura.animations.add('revive', 
            [0, 1, 2, 3, 4, 5, 6, 7,
            8, 9, 10, 11, 12]);

    aura.scale.setTo(0.5, 0.5);
    aura.anchor.setTo(0.5, 0.5);
    aura.exists = false;

    shield = game.add.sprite(0,0, 'golden_bubble');
    shield.exists = false;
    shield.scale.setTo(0.43, 0.43);
    shield.anchor.setTo(0.43, 0.43);
	
    jellyfishes = game.add.group();
    jellyfishes.enableBody = true;

    squids = game.add.group();
    squids.enableBody = true;

    patties = game.add.group();
    patties.enableBody = true;

    sharks = game.add.group();
    sharks.enableBody = true;

    bubbles = game.add.group();
    bubbles.enableBody = true;

    inks = game.add.group();
    inks.enableBody = true;
	
	clams = game.add.group();
	clams.enableBody = true;

    seaweeds = game.add.group();
    seaweeds.enableBody = true;

    corals = game.add.group();
    corals.enableBody = true;
	
    bubble_shields = game.add.group();
    bubble_shields.enableBody = true;

    // ===== Initial background scenery =====
    var scenery_y_base = game.world.height - GROUND_HEIGHT - 170;

    var coral_ledge = platforms.create(0, scenery_y_base, 'coral_ledge');
    coral_ledge.scale.setTo(0.5, 0.5);
    var coral_ledge_2 = platforms.create(game.width + 110,
                                         scenery_y_base - 50,
                                         'coral_ledge');
    coral_ledge_2.scale.setTo(0.7, 0.7);
    coral_ledge_2.scale.x *= -1; 

    var init_sw_1 = seaweeds.create(150, scenery_y_base + 120, 'seaweed');
    var init_sw_2 = seaweeds.create(550, scenery_y_base + 200, 'seaweed');
    init_sw_1.animations.add('flapping', [0, 1, 2], 15, true);
    init_sw_2.animations.add('flapping', [2, 1, 0], 15, true);
    init_sw_1.play('flapping');
    init_sw_2.play('flapping');

    var coral_1 = corals.create(150, scenery_y_base + 225, 'coral');
    coral_1.animations.add('flapping', [0, 1, 2, 3], 20, true);
    coral_1.scale.setTo(0.2, 0.2);
    coral_1.play('flapping');

    var coral_2 = corals.create(600, scenery_y_base + 120, 'coral');
    coral_2.animations.add('flapping', [3, 4, 0, 1], 20, true);
    coral_2.scale.setTo(0.4, 0.4);
    coral_2.play('flapping');

    var coral_3 = corals.create(550, scenery_y_base + 130, 'coral');
    coral_3.animations.add('flapping', [2, 1, 3, 0], 20, true);
    coral_3.scale.setTo(0.3, 0.3);
    coral_3.play('flapping');

    // initial patty on ground to give Patrick a boost
    var first_patty = patties.create(
            0.5 * game.world.width - 20,
            10, 
            'patty');
    first_patty.scale.setTo(0.4, 0.4);
    first_patty.body.gravity.y = 600;
	
    // ===== Buttons & controls seperate from game world =====
    add_sound_control_button();
	
    empty_energy_bar = game.add.sprite(game.width - (216 + 10), 10,
            'empty_energy_bar');
    empty_energy_bar.scale.setTo(1, 0.5);

    energy_bar = game.add.sprite(game.width - (216 + 10), 10,
            'energy_bar');
    energy_bar.scale.setTo(1, 0.5);

    altitude_text = game.add.text(
            10, 
            10,
            'Altitude: 0', 
            { font: '20px ' + GAME_TEXT,
                fill: GREEN_HEX }
            );

    energy_text = game.add.text(
            game.width - (212/2 + 20), 
            12,
            '0%', 
            { font: '11px ' + GAME_TEXT,
                fill: GREEN_HEX }
            );

    cursors = game.input.keyboard.createCursorKeys();
}


function add_sound_control_button() {
    sound_off_button = game.add.sprite(game.width - 50, 40, 'sound_off_button');
    sound_off_button.width = 25;
    sound_off_button.height = 25;
	
    sound_on_button = game.add.sprite(game.width - 50, 40, 'sound_on_button');
    sound_on_button.width = 0;
    sound_on_button.height = 25;

    sound_off_button.inputEnabled = true;
    sound_on_button.inputEnabled = true;

    sound_off_button.events.onInputDown.add(sound_off, this);
    sound_on_button.events.onInputDown.add(sound_on, this);
}


function sound_off() {
    sounds.bg_music.volume = 0;
    sound_off_button.width = 0;
    sound_on_button.width = 25;
}


function sound_on() {
    sounds.bg_music.volume = 1;
    sound_off_button.width = 25;
    sound_on_button.width = 0;
}


/*
 * This function toggles the rate of which the spawn rate method
 * for each entity is called. The rate is based on altitude.
 */
function set_spawn_rates() {
    var entity_names = Object.keys(entity_spawn_map);

    if (altitude < altitude_checkmark) {
        if (set_spawn_timers) {
            return;
        }
        // init the spawn timer only after patrick begins going up
        if (altitude > 0) {
            // set spawn timers after altitude passes 0
            for (var i = 0; i < entity_names.length; i++) {
                var entity = entity_spawn_map[entity_names[i]];
                if (entity.spawn_timer === null) {
                    var params = entity.spawn_timer_params;
                    params.unshift(entity.spawn_rate);
                    entity.spawn_timer =
                        game.time.events.loop.apply(game.time.events, params);
                }
            }
            set_spawn_timers = true;
        }
        return;
    }

    altitude_checkmark += ALTITUDE_CHUNK;

    for (var i = 0; i < entity_names.length; i++) {
        var entity = entity_spawn_map[entity_names[i]];
        // update the spawn rate based on altitude
        var rate_delta = Phaser.Timer.SECOND * 0.25;
        if (entity.diplomacy === DIPLOMACY.OBSTACLE) {
            // obstacles get more frequent
            entity.spawn_rate = Math.max(
                entity.spawn_rate - rate_delta, entity.RATE_CAP);
            entity.spawn_timer.delay = entity.spawn_rate;
        }
        else if (entity.diplomacy === DIPLOMACY.POWERUP) {
            // powerups start at a high rate and lose frequency
            entity.spawn_rate = Math.min(
                entity.spawn_rate + rate_delta, entity.RATE_CAP);
            entity.spawn_timer.delay = entity.spawn_rate;
        }
        else if (entity.diplomacy === DIPLOMACY.NEUTRAL) {
            // do nothing
        }
    }
}


/*
 * Inputs a number and returns the same number but
 * with a little subtracted or added to it. "A little"
 * here means a small percentage of the number itself
 */
function fuzz_number(number) {
    var percentage_num = Math.ceil(number * 0.30);
    var rand_coeff = Math.random() * percentage_num;
    if (Math.random() > 0.5) {
        rand_coeff *= -1;
    }
    return Math.ceil(number + rand_coeff);
}


function add_krabby_patty() {
    var patty = patties.create(
            Math.floor(Math.random() * game.world.width),
            0,
            'patty');
    patty.checkWorldBounds = true; 
    patty.outOfBoundsKill = true;
    patty.scale.setTo(0.4, 0.4);
}


/*
 * Some entities are different, we want to add them in groups
 * instead of randomlly spread out
 */
function add_grouped(entity_name) {
    var variance_mapping = {
        'bubble': 100,
        'jellyfish': 50
    };
    var spawn_mapping = {
        'bubble': add_bubble,
        'jellyfish': add_jellyfish
    }
    var max_mapping = {
        'bubble': 50,
        'jellyfish': 30
    }
    var x_coord = Math.floor(Math.random() * game.world.width);
    var y_coord = 0;
    var n = Math.floor(4 + (Math.random() * max_mapping[entity_name]));

    for (var i = 0; i < n; i++) {
        var pos_neg = Math.random() <= 0.5 ? -1 : 1;
        var x_variance = pos_neg * Math.random() * variance_mapping[entity_name];
        var y_variance = -1 * Math.random() * variance_mapping[entity_name];

        spawn_mapping[entity_name](
            x_coord + x_variance, y_coord + y_variance);
    }
}


function add_bubble(x_coord, y_coord) {
    var bubble = bubbles.create(x_coord, y_coord, 'bubble');

    bubble.body.bounce.y = 0.9 + Math.random() * 0.2;
    bubble.checkWorldBounds = true; 
    bubble.outOfBoundsKill = true;
    // bubbles should vary in size, but should be on the smaller
    // end because we have shitty sprites
    var size_variance = 0.1 + (Math.random() * 0.5);
    bubble.scale.setTo(size_variance, size_variance);
    // rotate the bubble for a cool effect
    bubble.angle = Math.floor(181 * Math.random());
}


function add_jellyfish(x_coord, y_coord) {
    var jelly = jellyfishes.create(x_coord, y_coord, 'jellyfish');

	var direction = (Math.random() < 0.5) ? -1 : 1;
    jelly.body.bounce.y = 0.7 + Math.random() * 0.2;
    jelly.checkWorldBounds = true; 
    jelly.outOfBoundsKill = true;
    jelly.animations.add('swim', [0, 1, 2, 3], 12, true);
    jelly.animations.play('swim');
    jelly.oscl_coef = (Math.random() * (100) + 200) * direction;
	if (direction > 0) {
		jelly.x_speed = (jelly.oscl_coef - 100);
	} else {
		jelly.x_speed = (jelly.oscl_coef + 100);
	}	
    // Start each jellyfish at a random animation to look more real
    jelly.animations.currentAnim.frame = Math.floor(Math.random() * 3);
}


function add_shark() {
    var y_coord = 300;
    var coin = (Math.random() <= 0.5) ? -1 : 1;
    var x_coord = (coin === -1) ? GAME_WIDTH : 0;
	var shark = sharks.create(x_coord, y_coord, 'shark');

    shark.anchor.setTo(0.5, 1);
    shark.scale.x = coin;
	shark.side = coin;		
    shark.checkWorldBounds = true; 
    shark.outOfBoundsKill = true;
    shark.animations.add('swim', [0, 1, 2], 12, true);
    shark.animations.play('swim');

    shark.animations.currentAnim.frame = 
                        Math.floor(Math.random() * 2);
}


function add_clam() {
	var clam = clams.create(player.x - 22.8, 0, 'clam');
    clam.scale.setTo(0.4, 0.4);
	clam.checkWorldBounds = true;
	clam.outOfBoundsKill = true;
}


function add_bubble_shield() {
    var shield = bubble_shields.create(Math.random() * 650,
                                       0,
                                       'golden_bubble');
    shield.checkWorldBounds = true;
    shield.outOfBoundsKill = true;
    shield.scale.setTo(0.43, 0.43);
}


function add_ink() {
    var ink = inks.create(player.x - 300, -200, 'ink');

    ink.checkWorldBounds = true;
    ink.outOfBoundsKill = true;
    ink.animations.add('show', [0] , 12, true);
    ink.animations.play('show');
}


function add_squid() {
    var squid = game.add.sprite(
                    50 + Math.floor(Math.random() * 650),
                    600,
                    'squid');
    squid.inputEnabled = true;
    squid.events.onInputDown.add(clicked, this);
    squid.events.onAddedToGroup.add(added_squid, this);
    squid.events.onOutOfBounds.add(squid_left, this);

    squids.add(squid);

    squid.checkWorldBounds = true;
    squid.outOfBoundsKill = true;
    squid.animations.add('swim', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 12, true);
    squid.animations.play('swim');
}


function squid_left() {
    game.time.events.remove(squid_timer);
    squid_timer = undefined;
}


function clicked(sprite) {
    sprite.destroy();
    game.time.events.remove(squid_timer);
    squid_timer = undefined;
}


function added_squid(){
    if (squid_timer === undefined) {
        squid_timer = game.time.events.loop(
                Phaser.Timer.SECOND * 2.5 , add_ink, this);
    }

}


function numberWithCommas(n) {
    var parts=n.toString().split(".");
    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
                            (parts[1] ? "." + parts[1] : "");
}


function update_physics() {
    aura.x = player.x;
    aura.y = player.y;

    shield.x = player.x;
    shield.y = player.y;

    if (in_shield) {
        shield.exists = true;
    } else {
        shield.exists = false;
    }
	
    platforms.forEach(function(item) {
        item.body.velocity.y = speed;
        item.body.acceleration.y = acceleration;
    }, this);

    jellyfishes.forEach(function(item) {
        item.body.velocity.x = item.x_speed;
        item.body.velocity.y = item.oscl_coef *
                                Math.sin(game.time.now / 100) + speed;
    }, this);

    bubbles.forEach(function(item) {
        if (game_ended) {
            item.body.velocity.y = 120;
        } else {
            item.body.velocity.y = speed;
        }
        item.body.acceleration.y = acceleration;
        item.angle = item.angle + ((Math.random() <= 0.5) ? 1 : -1);
    }, this);

    sharks.forEach(function(item) {
        item.body.velocity.x = 700 * item.side;
        item.body.acceleration.x = 1000 * item.side;
        if (speed < 0 || acceleration < 0) {
            item.body.acceleration.y = -500;
            item.body.velocity.y = -500;
        } else {
            item.body.velocity.y = 0;
            item.body.acceleration.y = 0;
        }
    }, this);

    patties.forEach(function(item) {
        // first patty has acceleration
        if (item.body.gravity.y === 0) {
            item.body.velocity.y = speed;
        }
        item.body.acceleration.y = acceleration;
    }, this);

    inks.forEach(function(item) {
        item.body.velocity.y = speed;
        item.body.acceleration.y = acceleration;
    }, this);

    clams.forEach(function(item) {
        item.body.velocity.y = speed * 2;
        item.body.acceleration.y = acceleration;
        if (speed < 0 || acceleration < 0) {
            item.body.velocity.y = PATRICK_VELOCITY_Y_PATTY;
            item.body.acceleration.y = 200;
            item.body.gravity.y = 150;
        }
    }, this);	

    seaweeds.forEach(function(item) {
        item.body.velocity.y = speed;
        item.body.acceleration.x = acceleration;
    }, this);

    corals.forEach(function(item) {
        item.body.velocity.y = speed;
        item.body.acceleration.x = acceleration;
    }, this);

    bubble_shields.forEach(function(item) {
        item.body.velocity.y = speed * 1.5;
        item.body.acceleration.y = acceleration;
        item.body.gravity.y = 150;
        if (speed < 0 || acceleration < 0) {
            item.body.velocity.y = PATRICK_VELOCITY_Y_PATTY;
            item.body.acceleration.y = 200;
            item.body.gravity.y = 150;
        }
    }, this);
	
    squids.forEach(function(item) {
        // Fix squid physics effect. Squids are unique because they 
        // are naturally floating upwards, not downwards.
    
        // If our speed is negative (falling) the squid should quickly
        // zoom up, not the before action (fall down slowly)
        var speed_coeff = -1;
        if (speed > 0) {
            speed_coeff = -0.1;
        }
        item.body.velocity.y = speed_coeff  * speed;
    }, this);

    // Game over when Patrick has been falling for a little bit
    // Safe assumption because all entities are killed after
    // they fall off the map, Patrick has no way of getting up
    if ((speed < SPEED_GAME_LOSS_THRESHHOLD || altitude < 0) && !game_ended) {
        game_over();
    }

    // Exhaust effect of patties so they don't last forever
    if (energy > 0) {
        speed = PATRICK_VELOCITY_Y_PATTY;
        if (patty_boost_timer > 0) {
            speed = speed + PATTY_SPEED_BOOST;
            patty_boost_timer--;
        }
        energy--;
    }
    else if (altitude > 0) {
        speed -= PATRICK_VELOCITY_Y_GRAVITY_LOSS;
    }

    if (speed > 0) {
        altitude += Math.floor(speed * ALTITUDE_SPEED_INCREASE_RATE);
    }

    // Reset the player's horiz velocity (movement)
    player.body.velocity.x = 0;
}


/*
 * IMPORTANT: Because the update function's contents vary in
 * functionality and depend on each other, the separate functions
 * must be divided in sequences.
 *
 * 1. Check for all collisions
 * 2. Insert or delete entities
 * 3. Update physics
 * 4. Update user inputs
 * 5. Update text & counters
 */
function update() {
    // ==========================
    // ==== Check collisions ====
    // ==========================

	game.physics.arcade.collide(clams, platforms);
    game.physics.arcade.collide(jellyfishes, platforms);
    game.physics.arcade.collide(patties, platforms);
    game.physics.arcade.collide(
        player,
		patties,
		collect_patty,
		null,
		this
    );
    game.physics.arcade.overlap(
        player,
		jellyfishes,
		hit_jellyfish,
		null,
		this
    );
	game.physics.arcade.overlap(
        player,
		clams,
		hit_clam,
		null,
		this
    );
    game.physics.arcade.overlap(
        player,
        sharks,
        hit_shark,
        null,
        this
    );
	game.physics.arcade.overlap(
        player,
		bubble_shields,
		hit_shield,
		null,
		this
    );
		
    set_spawn_rates();

    update_physics();

    // ====================
    // ==== Controller ====
    // ====================

    var walking = altitude === 0;
    var falling = (speed <= 0 && altitude > 0);
    var swimming = (speed > 0 && altitude > 0); 

    if (swimming) {
        player.animations.play('swimming');
    }
    else if (walking) {
        player.animations.play('walking');
    }
    else if (falling) {
        player.animations.play('falling');
    }
    else {
        player.animations.stop();
    }

    if (cursors.left.isDown) {
        player.body.velocity.x = -PATRICK_VELOCITY_X;
        if (facing_right) {
            facing_right = false; 
            player.scale.x *= -1;
        }
    } else if (cursors.right.isDown) {
        player.body.velocity.x = PATRICK_VELOCITY_X;
        if (!facing_right) {
            facing_right = true; 
            player.scale.x *= -1;
        }
    } else if (walking) {
        // stand still, no horiz movement, but only if walking!
        player.animations.stop();
        player.frame = 14;
    }

    // ===========================
    // ==== Text and counters ====
    // ===========================

    altitude_as_string = numberWithCommas(altitude);
    altitude_text.text = 'Altitude: ' + altitude_as_string;

    var energy_percent = Math.floor(
            (energy / ENERGY_CAP) * 100).toString() + "%";
    energy_text.text = energy_percent;
    energy_bar.width = (energy / ENERGY_CAP) * 212;
}


function collect_patty(player, patty) {
    patty.kill();

    aura.reset(player.x, player.y);
    aura.play('revive', 60, false, true);

    energy += 100;
    energy = Math.min(energy, ENERGY_CAP);

    patty_boost_timer = 15;
}


function hit_jellyfish(player, jellyfish) {
    jellyfish.kill();
	if (!in_shield) {
        energy = 0;
    }
	in_shield = false;
}


function hit_clam(player, clam) {
    clam.kill();
    if (!in_shield) {
        energy = Math.max(energy - 50, 0);
        sounds.hurt.play();
    } else {
        sounds.bubble_pop.play();
    }
    in_shield = false;    
}	


function hit_shield(player, bubble) {
	shield.exists = true;
	in_shield = true;
	bubble.kill();
}


function hit_shark(player, shark) {
	shark.kill();
    if (!game_ended && !in_shield) {
        game_over();
    }
	in_shield = false;
}


function add_end_text(text, x_coord, y_coord, size) {
    return game.add.text(x_coord, y_coord, text, 
            {font: size + ' ' + GAME_TEXT, fill: '#add8e6'});
}


function send_highscores() {
    var username = $('#username_field').val();
    var post_to = '/api/highscore_send';
    
    if (!username || 0 === username.length) {
        alert('Enter a valid username!');
        return;
    }

    $.post(post_to, { name: username, score: final_altitude },
        function(response) {
            var send_status = response.status;
            if (!send_status) {
                add_end_text('HIGHSCORE SEND ERROR');
            } else {
                $.cookie(COOKIE_USERNAME_KEY,
                         username,
                         {expires: 7});
                window.location.reload();
            }
        }, 'json'
    );
}


function game_over() {
    game_ended = true;
    speed = 0;
    acceleration = 0;

    game.add.sprite(0, 0, 'black_bg'); 

    // re-add new bubbles group over the black background
    bubbles = game.add.group();
    bubbles.enableBody = true;

    final_altitude = altitude.toString();

    add_end_text('Game Over!',
                 game.width / 2 - 110,
                 game.height/2 - 170,
                 '40px');

    add_end_text('Final score: ' + final_altitude,
                 game.width / 2 - 70,
                 game.height/2 + 170,
                 '18px');

    press_space_blink_text = add_end_text('Press ? to skip',
                                          game.width / 2 - 65,
                                          game.height - 70,
                                          '18px');

    game.time.events.loop(Phaser.Timer.SECOND * 0.6,
                          function(text) {
                              text.visible = !text.visible;
                          }, this, press_space_blink_text);

    // remove the spawn timer after the game ends
    var entity_names = Object.keys(entity_spawn_map); 
    for (var i = 0; i < entity_names.length; i++) {
        var entity = entity_spawn_map[entity_names[i]];
        if (entity.spawn_timer) {
            game.time.events.remove(entity.spawn_timer);
        }
    }

    // add a spawn timer for bubbles, for garnishing the exit screen
    var bubble_dat = entity_spawn_map['bubble'];
    var bubble_spawn_params = bubble_dat.spawn_timer_params;
    var post_game_bubble_timer = game.time.events.loop.apply(
        game.time.events, bubble_spawn_params);
    post_game_bubble_timer.delay = Phaser.Timer.SECOND * 0.75;

    var body = $('body');
    body.append(
        '<div id="username_input_group" class="input-group" ' +
        'style="position:absolute;' +
            'left:' +
            (($( window ).width() / 2) - 150).toString() + 'px;' +
            'top: ' +
            (game.height / 2).toString() + 'px;">' +
        '<input id="username_field" type="text" ' +
           'class="form-control" placeholder="username, then press enter">' + 
        '<span class="input-group-btn">' + 
           '<button onclick="send_highscores()" class="btn btn-default" ' +
               'type="button">enter</button>' +
        '</span>' +
        '</div>');
    
    var prev_username = $.cookie(COOKIE_USERNAME_KEY);
    if (prev_username !== undefined) {
        $('#username_field').val(prev_username);
    }

    // autoselect the input field
    $('#username_field').select();

    // add listener so user can submit pressing enter
    $('#username_field').keypress(function( event ) {
        if (event.which === 13) {
            send_highscores();
        }
    });

    body.keypress(function( event ) {
        if (event.which === 63) {
            window.location.reload();
        }
    });
}