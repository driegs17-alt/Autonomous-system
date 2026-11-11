/*
  UNDERCURRENT
  An autonomous generative drawing system in p5.js.

  Every run, the sketch rolls a new "world": a seed, a palette, a field scale,
  a twist amount and a drawing mode. Then about 1,000 agents drift across the
  page, following an invisible current made with Perlin noise.

  The system draws on its own, but you can disturb the water:
  your cursor is a whirlpool the current bends around, and dragging pours
  new ink into the stream. Leave it alone and it finishes and signs itself.

  random() -> makes the jumpy, one-time DECISIONS (which palette, which mode,
              where an agent is born, how long it lives, paper grain).
  noise()  -> makes the smooth, continuous BEHAVIOUR (which way agents flow,
              which colour region they belong to, how thick their line is).

  Controls
    move mouse        whirlpool: the current swirls around your cursor
    click / N         new drawing (new seed)
    click + drag      pour ink: agents spill out from the cursor
    G                 switch between flow and grid mode, live
    R                 replay the same seed
    S                 save the canvas as a PNG
    SPACE             pause / resume
*/

// ---------- CONFIG ----------
const W = 800;              // canvas width
const H = 1000;             // canvas height (portrait, like a print)
const MARGIN = 70;          // border around the drawing
const DURATION = 900;       // minimum frames before the piece can finish (~15 s)
const IDLE_LIMIT = 240;     // ...and it finishes after this many frames without mouse input (~4 s)

const VORTEX_RADIUS = 170;  // how far the whirlpool reaches
const POUR_RATE = 10;       // agents poured per frame while dragging

// Each palette: a background, a flag for dark backgrounds, then the inks.
const PALETTES = [
  { name: 'Tide',        bg: '#F2EDE4',             inks: ['#0B3954', '#087E8B', '#9CC5D8', '#FF5A5F'] },
  { name: 'Ember',       bg: '#17161A', dark: true, inks: ['#F4A261', '#E76F51', '#E9C46A', '#FAF3E0'] },
  { name: 'Moss',        bg: '#EDEFE4',             inks: ['#2D4739', '#6B8F71', '#C9A227', '#1E1E1E'] },
  { name: 'Ink',         bg: '#F5F3EE',             inks: ['#111111', '#3A3A3A', '#8C8C8C', '#D7263D'] },
  { name: 'Night Bloom', bg: '#0E1428', dark: true, inks: ['#7B9E89', '#F95738', '#EE964B', '#F4D35E'] }
];

// ---------- STATE ----------
let world;                  // the rules for the current drawing
let particles = [];         // array of agent objects
let paused = false;
let pourIndex = 0;          // which agent gets poured next
let press = null;           // where and when the mouse went down (click vs drag)

// ---------- SETUP ----------
function setup() {
  createCanvas(W, H).parent('stage');
  pixelDensity(2);          // sharper lines and higher-resolution saved PNGs
  newWorld();
}

// ---------- DRAW ----------
function draw() {
  world.z += 0.0015;        // the current slowly changes over time

  const active = mouseOnCanvas() && (mouseIsPressed || mouseX !== pmouseX || mouseY !== pmouseY);
  world.idle = active ? 0 : world.idle + 1;

  // How hard the whirlpool pulls: stronger when the mouse moves fast.
  const mouseSpeed = dist(mouseX, mouseY, pmouseX, pmouseY);
  world.vortex = mouseOnCanvas() ? constrain(0.35 + mouseSpeed / 25, 0.35, 1) : 0;

  // The whirlpool's size breathes smoothly over time, driven by noise().
  world.radius = VORTEX_RADIUS * map(noise(frameCount * 0.01, 300), 0.25, 0.75, 0.6, 1.3, true);

  if (mouseIsPressed && isDragging()) pourInk();

  for (const p of particles) {
    p.update();
    p.show();
  }

  world.frame++;

  // Finish once the base drawing is done AND nobody is playing with it.
  if (world.frame >= DURATION && world.idle >= IDLE_LIMIT && !world.signed) {
    drawLabel();
    world.signed = true;
    noLoop();
  }
}

// ---------- WORLD: the rules for one drawing ----------
function newWorld(seed) {
  // Math.random() is used for the seed itself; after randomSeed(), p5's
  // random() is deterministic, so it would produce the same "new" seed sequence.
  if (seed === undefined) seed = Math.floor(Math.random() * 1000000);
  randomSeed(seed);
  noiseSeed(seed);

  const palette = random(PALETTES);

  world = {
    seed: seed,
    palette: palette,
    fieldScale: random(0.0018, 0.0045),             // zoom of the current
    colorScale: random(0.0015, 0.004),              // size of colour regions
    turns: random(1.5, 3.5),                        // how much the current twists
    mode: random() < 0.7 ? 'flow' : 'grid',         // smooth curves or 45-degree steps
    spin: random() < 0.5 ? 1 : -1,                  // whirlpool turns clockwise or not
    count: floor(random(700, 1200)),                // number of agents
    z: 0,
    frame: 0,
    idle: 0,
    vortex: 0,
    radius: VORTEX_RADIUS,
    signed: false
  };

  // Pre-build translucent ink colours so layers build up density.
  const alpha = palette.dark ? 70 : 55;
  world.inks = palette.inks.map(hex => {
    const c = color(hex);
    c.setAlpha(alpha);
    return c;
  });

  background(palette.bg);
  drawGrain();

  particles = [];
  for (let i = 0; i < world.count; i++) {
    particles.push(new Particle());
  }

  paused = false;
  loop();
}

// ---------- AGENT ----------
class Particle {
  constructor() {
    this.reset();
  }

  // Rebirth: a random place (or a given one), a random lifespan, a colour from noise.
  reset(x, y) {
    this.x = x === undefined ? random(MARGIN, W - MARGIN) : x;
    this.y = y === undefined ? random(MARGIN, H - MARGIN) : y;
    this.px = this.x;
    this.py = this.y;
    this.life = random(60, 320);
    this.speed = random(0.8, 1.8);
    this.fresh = true;

    // Colour comes from noise, so neighbours share colours and form regions.
    const n = noise(this.x * world.colorScale, this.y * world.colorScale, 50);
    const i = floor(constrain(map(n, 0.3, 0.7, 0, world.inks.length), 0, world.inks.length - 1));
    this.ink = world.inks[i];

    // Line weight also comes from noise: thick and thin areas, not random speckle.
    const w = noise(this.x * 0.006, this.y * 0.006, 200);
    this.weight = map(w, 0.25, 0.75, 0.3, 2.4, true);
  }

  update() {
    // The core rule: read the noise field and turn it into a direction.
    let angle = noise(this.x * world.fieldScale, this.y * world.fieldScale, world.z)
                * TWO_PI * world.turns;

    // Grid mode snaps the direction to 45-degree steps, which looks like a circuit board.
    if (world.mode === 'grid') {
      angle = round(angle / QUARTER_PI) * QUARTER_PI;
    }

    let vx = cos(angle);
    let vy = sin(angle);

    // The whirlpool: near the cursor, blend the current with a swirl around it.
    if (world.vortex > 0) {
      const d = dist(this.x, this.y, mouseX, mouseY);
      if (d < world.radius && d > 1) {
        const pull = pow(1 - d / world.radius, 2) * world.vortex;    // strongest at the centre
        const toMouse = atan2(mouseY - this.y, mouseX - this.x);
        const swirl = toMouse + world.spin * HALF_PI * 0.8;          // mostly around, a little inward
        vx = lerp(vx, cos(swirl), pull);
        vy = lerp(vy, sin(swirl), pull);
      }
    }

    this.px = this.x;
    this.py = this.y;
    this.x += vx * this.speed;
    this.y += vy * this.speed;
    this.life--;
    this.fresh = false;

    const outside = this.x < MARGIN || this.x > W - MARGIN ||
                    this.y < MARGIN || this.y > H - MARGIN;
    if (outside || this.life <= 0) this.reset();
  }

  show() {
    if (this.fresh) return;   // don't draw a dot on the frame an agent is reborn
    stroke(this.ink);
    strokeWeight(this.weight);
    line(this.px, this.py, this.x, this.y);
  }
}

// ---------- POUR: dragging moves agents to the cursor ----------
// Instead of adding new agents (which would slow the sketch down over time),
// pouring recycles existing ones and drops them in a small splash at the cursor.
function pourInk() {
  const x = constrain(mouseX, MARGIN, W - MARGIN);
  const y = constrain(mouseY, MARGIN, H - MARGIN);
  for (let i = 0; i < POUR_RATE; i++) {
    const p = particles[pourIndex];
    p.reset(x + random(-12, 12), y + random(-12, 12));
    pourIndex = (pourIndex + 1) % particles.length;
  }
}

// ---------- TEXTURE: paper grain ----------
// The grain uses random() on purpose: grain should be jumpy and uneven, unlike the current.
function drawGrain() {
  strokeWeight(1);
  for (let i = 0; i < (W * H) / 30; i++) {
    stroke(world.palette.dark ? 255 : 0, random(4, 14));
    point(random(W), random(H));
  }
}

// ---------- LABEL: signs the print once it is finished ----------
function drawLabel() {
  noStroke();
  fill(world.palette.dark ? 235 : 30, 200);
  textFont('Helvetica');
  textSize(11);
  textAlign(LEFT, BASELINE);
  text('UNDERCURRENT', MARGIN, H - MARGIN / 2 + 4);
  textAlign(RIGHT, BASELINE);
  text(`${world.palette.name.toUpperCase()}  \u00B7  ${world.mode.toUpperCase()}  \u00B7  SEED ${world.seed}`,
       W - MARGIN, H - MARGIN / 2 + 4);
}

// ---------- INTERACTION ----------
function mouseOnCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

// Moving the mouse wakes a finished or idle drawing back up.
function mouseMoved() {
  if (mouseOnCanvas() && !paused && !isLooping()) loop();
}

// mousePressed() remembers where the press started. If the mouse comes back up
// quickly without moving, it was a click (new drawing); otherwise it was a drag (pour).
function mousePressed() {
  if (!mouseOnCanvas()) return;
  press = { x: mouseX, y: mouseY, time: millis() };
  if (!paused && !isLooping()) loop();
}

function mouseReleased() {
  if (press && !isDragging()) newWorld();
  press = null;
}

// A press counts as a drag once the mouse moves more than 6 px or is held for 250 ms.
function isDragging() {
  if (!press) return false;
  return dist(mouseX, mouseY, press.x, press.y) > 6 || millis() - press.time > 250;
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas(`undercurrent-${world.seed}`, 'png');
  } else if (key === 'n' || key === 'N') {
    newWorld();
  } else if (key === 'r' || key === 'R') {
    newWorld(world.seed);
  } else if (key === 'g' || key === 'G') {
    world.mode = world.mode === 'flow' ? 'grid' : 'flow';
  } else if (key === ' ') {
    paused = !paused;
    paused ? noLoop() : loop();
    return false;                               // stop the page from scrolling
  }
}
