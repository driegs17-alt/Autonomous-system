/*
  UNDERCURRENT
  An autonomous generative drawing system in p5.js.

  Every run, the sketch rolls a new "world": a seed, a palette, a field scale,
  a twist amount and a drawing mode. Then about 1,000 agents drift across the
  page, following an invisible current made with Perlin noise. Nobody steers them.
  The drawing builds up on its own and stops when it is finished.

  random() -> makes the jumpy, one-time DECISIONS (which palette, which mode,
              where an agent is born, how long it lives, paper grain).
  noise()  -> makes the smooth, continuous BEHAVIOUR (which way agents flow,
              which colour region they belong to, how thick their line is).

  Controls
    click / N   new drawing (new seed)
    R           replay the same seed (the same rules give the same drawing)
    S           save the canvas as a PNG
    SPACE       pause / resume
*/

// ---------- CONFIG ----------
const W = 800;              // canvas width
const H = 1000;             // canvas height (portrait, like a print)
const MARGIN = 70;          // white border around the drawing
const DURATION = 900;       // frames until the drawing is finished (~15 s)

// Each palette: a background, a flag for dark backgrounds, then the inks.
const PALETTES = [
  { name: 'Tide',        bg: '#F2EDE4', inks: ['#0B3954', '#087E8B', '#9CC5D8', '#FF5A5F'] },
  { name: 'Ember',       bg: '#17161A', dark: true, inks: ['#F4A261', '#E76F51', '#E9C46A', '#FAF3E0'] },
  { name: 'Moss',        bg: '#EDEFE4', inks: ['#2D4739', '#6B8F71', '#C9A227', '#1E1E1E'] },
  { name: 'Ink',         bg: '#F5F3EE', inks: ['#111111', '#3A3A3A', '#8C8C8C', '#D7263D'] },
  { name: 'Night Bloom', bg: '#0E1428', dark: true, inks: ['#7B9E89', '#F95738', '#EE964B', '#F4D35E'] }
];

// ---------- STATE ----------
let world;                  // the rules for the current drawing
let particles = [];         // array of agent objects
let paused = false;

// ---------- SETUP ----------
function setup() {
  createCanvas(W, H).parent('stage');
  pixelDensity(2);          // sharper lines and higher-resolution saved PNGs
  newWorld();
}

// ---------- DRAW ----------
function draw() {
  // Let the current slowly change over time, so early and late strokes differ.
  world.z += 0.0015;

  for (const p of particles) {
    p.update();
    p.show();
  }

  world.frame++;
  if (world.frame >= DURATION) {
    drawLabel();            // sign the finished piece
    noLoop();
  }
}

// ---------- WORLD: the rules for one drawing ----------
// Every call makes a different world. random() makes each decision once.
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
    count: floor(random(700, 1200)),                // number of agents
    z: 0,
    frame: 0
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

  // Rebirth: a random place, a random lifespan, and a colour taken from noise.
  reset() {
    this.x = random(MARGIN, W - MARGIN);
    this.y = random(MARGIN, H - MARGIN);
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

    this.px = this.x;
    this.py = this.y;
    this.x += cos(angle) * this.speed;
    this.y += sin(angle) * this.speed;
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

// ---------- TEXTURE: paper grain ----------
// The grain uses random() on purpose: grain should be jumpy and uneven, unlike the current.
function drawGrain() {
  const dark = world.palette.dark;
  strokeWeight(1);
  for (let i = 0; i < (W * H) / 30; i++) {
    stroke(dark ? 255 : 0, random(4, 14));
    point(random(W), random(H));
  }
}

// ---------- LABEL: signs the print once it is finished ----------
function drawLabel() {
  const dark = world.palette.dark;
  noStroke();
  fill(dark ? 235 : 30, 200);
  textFont('Helvetica');
  textSize(11);
  textAlign(LEFT, BASELINE);
  text('UNDERCURRENT', MARGIN, H - MARGIN / 2 + 4);
  textAlign(RIGHT, BASELINE);
  text(`${world.palette.name.toUpperCase()}  \u00B7  ${world.mode.toUpperCase()}  \u00B7  SEED ${world.seed}`,
       W - MARGIN, H - MARGIN / 2 + 4);
}

// ---------- INTERACTION ----------
function mousePressed() {
  // Only react to clicks on the canvas, not elsewhere on the page.
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    newWorld();
  }
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas(`undercurrent-${world.seed}`, 'png');
  } else if (key === 'n' || key === 'N') {
    newWorld();
  } else if (key === 'r' || key === 'R') {
    newWorld(world.seed);
  } else if (key === ' ') {
    if (world.frame >= DURATION) return false;  // already finished
    paused = !paused;
    paused ? noLoop() : loop();
    return false;                               // stop the page from scrolling
  }
}
