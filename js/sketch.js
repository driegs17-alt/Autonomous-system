/*
  UNDERCURRENT
  An autonomous drawing system in p5.js.

  Each run, random() rolls a "world": a seed, a palette, how zoomed-in,
  twisted and turbulent the current is, a drawing mode and a population.
  Then about a thousand agents ride a Perlin-noise current and leave ink
  behind them. Nobody draws the picture; the rules do.

  You can put your hand in the water: the cursor is a whirlpool, and dragging
  pours fresh ink. Leave it alone and the piece finishes and signs itself.

    random()  ->  jumpy, one-time DECISIONS
                  (the world's rules, where agents are born, how long they live,
                   who carries the accent ink, the paper grain)
    noise()   ->  smooth, continuous BEHAVIOUR
                  (the current's direction, colour regions, stroke weight,
                   the domain warp, the whirlpool's breathing size)

  Controls
    move mouse        whirlpool: the current swirls around the cursor
    click             new world (new seed)
    click + drag      pour ink from the cursor
    N                 new world
    G                 switch flow / grid mode, live
    R                 replay this seed from the start
    S                 save the artwork as a PNG (saveCanvas)
    SPACE             pause / resume

  Files: config.js (rules and palettes), agent.js (one agent), sketch.js (this).
*/

let world;          // the current world's rules and state
let agents = [];    // the population: an array of Agent objects
let art;            // the artwork layer; the main canvas shows it plus a cursor overlay
let paused = false;
let pourIndex = 0;  // next agent to recycle when pouring
let press = null;   // where/when the mouse went down, to tell a click from a drag

// ------------------------------------------------------------------ setup / draw

function setup() {
  createCanvas(CONFIG.width, CONFIG.height).parent('stage');
  pixelDensity(CONFIG.density);

  // Ink goes on its own layer, so the cursor overlay never ends up in the artwork.
  art = createGraphics(CONFIG.width, CONFIG.height);
  art.pixelDensity(CONFIG.density);

  newWorld();
}

function draw() {
  world.z += CONFIG.drift;            // the current slowly evolves
  readMouse();

  if (mouseIsPressed && isDragging()) pourInk();

  for (const agent of agents) {
    agent.step(art);
  }
  world.frame++;

  image(art, 0, 0);
  drawCursor();

  // The piece is finished once it has drawn long enough AND nobody is touching it.
  if (!world.signed && world.frame >= CONFIG.minFrames && world.idle >= CONFIG.idleToFinish) {
    finish();
  }
}

// ------------------------------------------------------------------ the world

function newWorld(seed) {
  // The seed itself comes from Math.random(): once randomSeed() is set, p5's
  // random() is deterministic and would hand out the same "new" seeds every session.
  if (seed === undefined) seed = Math.floor(Math.random() * 1000000);
  randomSeed(seed);
  noiseSeed(seed);

  const palette = random(PALETTES);

  world = {
    seed: seed,
    palette: palette,
    fieldScale: random(CONFIG.fieldScale[0], CONFIG.fieldScale[1]),
    colorScale: random(CONFIG.colorScale[0], CONFIG.colorScale[1]),
    turns: random(CONFIG.turns[0], CONFIG.turns[1]),
    warp: random(CONFIG.warp[0], CONFIG.warp[1]),
    mode: random() < CONFIG.gridChance ? 'grid' : 'flow',
    spin: random() < 0.5 ? 1 : -1,
    z: 0,
    frame: 0,
    idle: 0,
    vortex: 0,
    radius: CONFIG.vortexRadius,
    signed: false
  };

  world.inks = palette.inks.map(hex => inkColor(hex, palette.dark));
  world.accent = inkColor(palette.accent, palette.dark);

  paintPaper();

  agents = [];
  const count = floor(random(CONFIG.agents[0], CONFIG.agents[1]));
  for (let i = 0; i < count; i++) {
    agents.push(new Agent());
  }

  updateCaption();
  paused = false;
  loop();
}

// The current: a noise field, read through a second "warping" noise field.
// Domain warping pushes the lookup point around, which folds the flow into
// richer eddies than plain noise can make on its own.
function fieldAngle(x, y) {
  const wx = x + world.warp * (noise(x * 0.002, y * 0.002, 10) - 0.5) * 2;
  const wy = y + world.warp * (noise(x * 0.002, y * 0.002, 20) - 0.5) * 2;
  let angle = noise(wx * world.fieldScale, wy * world.fieldScale, world.z) * TWO_PI * world.turns;

  // Grid mode: snap to 45-degree headings. Agents' inertia rounds the corners.
  if (world.mode === 'grid') angle = round(angle / QUARTER_PI) * QUARTER_PI;
  return angle;
}

// The whirlpool: returns a swirl direction and how strongly it applies here, or null.
function swirlAt(x, y) {
  if (world.vortex < 0.01) return null;
  const d = dist(x, y, mouseX, mouseY);
  if (d >= world.radius || d < 1) return null;

  const pull = pow(1 - d / world.radius, 2) * world.vortex;           // strongest at the centre
  const a = atan2(mouseY - y, mouseX - x) + world.spin * HALF_PI * 0.8; // around, slightly inward
  return { x: cos(a), y: sin(a), pull: pull };
}

// ------------------------------------------------------------------ rendering

function inkColor(hex, dark) {
  const c = color(hex);
  c.setAlpha(dark ? 72 : 56);   // translucent, so density builds up like layered ink
  return c;
}

// Paper: base tone, jumpy random() grain, and a soft vignette.
function paintPaper() {
  const p = world.palette;
  art.background(p.paper);

  art.strokeWeight(1);
  for (let i = 0; i < (CONFIG.width * CONFIG.height) / 30; i++) {
    art.stroke(p.dark ? 255 : 0, random(4, 14));
    art.point(random(CONFIG.width), random(CONFIG.height));
  }

  const ctx = art.drawingContext;
  const cx = CONFIG.width / 2;
  const cy = CONFIG.height / 2;
  const g = ctx.createRadialGradient(cx, cy, CONFIG.height * 0.25, cx, cy, CONFIG.height * 0.75);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, p.dark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(70, 50, 30, 0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
}

// A quiet overlay that shows the whirlpool's reach. Drawn on the main canvas only.
function drawCursor() {
  if (!mouseOnCanvas()) return;
  const tone = world.palette.dark ? 255 : 0;

  noFill();
  strokeWeight(1.6);
  stroke(tone, 70 + world.vortex * 90);
  circle(mouseX, mouseY, world.radius * 2);          // the whirlpool's reach
  stroke(tone, 35 + world.vortex * 45);
  circle(mouseX, mouseY, world.radius);              // the strong inner zone

  noStroke();
  fill(tone, isDragging() && mouseIsPressed ? 200 : 110);
  circle(mouseX, mouseY, isDragging() && mouseIsPressed ? 10 : 5);
}

// Signing: a colophon in the bottom margin, like an edition label on a print.
function finish() {
  const p = world.palette;
  const y = CONFIG.height - CONFIG.margin / 2 + 4;

  art.noStroke();
  art.fill(p.dark ? 235 : 30, 200);
  art.textFont('Helvetica');
  art.textSize(11);
  art.textAlign(LEFT, BASELINE);
  art.text('UNDERCURRENT', CONFIG.margin, y);
  art.textAlign(RIGHT, BASELINE);
  art.text(`${p.name.toUpperCase()}  \u00B7  ${world.mode.toUpperCase()}  \u00B7  SEED ${world.seed}`,
           CONFIG.width - CONFIG.margin, y);

  image(art, 0, 0);   // show the clean, signed piece without the cursor overlay
  world.signed = true;
  noLoop();
}

function updateCaption() {
  const el = document.getElementById('meta');
  if (el) el.textContent = `${world.palette.name} \u00B7 ${world.mode} \u00B7 seed ${world.seed}`;
}

// ------------------------------------------------------------------ interaction

function mouseOnCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

// Each frame: is someone playing, and how hard is the whirlpool spinning?
function readMouse() {
  const onCanvas = mouseOnCanvas();
  const moved = mouseX !== pmouseX || mouseY !== pmouseY;
  world.idle = onCanvas && (moved || mouseIsPressed) ? 0 : world.idle + 1;

  // Faster mouse = stronger pull. Eased with lerp() so it never jerks.
  const target = onCanvas ? constrain(0.35 + dist(mouseX, mouseY, pmouseX, pmouseY) / 25, 0.35, 1) : 0;
  world.vortex = lerp(world.vortex, target, 0.15);

  // The whirlpool's size breathes smoothly over time (noise, not random).
  world.radius = CONFIG.vortexRadius * map(noise(frameCount * 0.01, 300), 0.25, 0.75, 0.6, 1.3, true);
}

// Pouring recycles existing agents into a small splash at the cursor,
// so the population (and the frame rate) never grows.
function pourInk() {
  const m = CONFIG.margin;
  const x = constrain(mouseX, m, CONFIG.width - m);
  const y = constrain(mouseY, m, CONFIG.height - m);
  for (let i = 0; i < CONFIG.pourRate; i++) {
    agents[pourIndex].respawn(x + random(-12, 12), y + random(-12, 12));
    pourIndex = (pourIndex + 1) % agents.length;
  }
}

// A press is a drag once the mouse travels or is held long enough; otherwise it's a click.
function isDragging() {
  if (!press) return false;
  return dist(mouseX, mouseY, press.x, press.y) > CONFIG.clickTolerance ||
         millis() - press.time > CONFIG.clickTime;
}

function mousePressed() {
  if (!mouseOnCanvas()) return;
  press = { x: mouseX, y: mouseY, time: millis() };
  if (!paused && !isLooping()) loop();
}

function mouseReleased() {
  if (press && !isDragging()) newWorld();   // a clean click starts a new drawing
  press = null;
}

// Moving over a finished piece wakes it back up.
function mouseMoved() {
  if (mouseOnCanvas() && !paused && !isLooping()) loop();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas(art, `undercurrent-${world.seed}`, 'png');   // the artwork only, no cursor
  } else if (key === 'n' || key === 'N') {
    newWorld();
  } else if (key === 'r' || key === 'R') {
    newWorld(world.seed);
  } else if (key === 'g' || key === 'G') {
    world.mode = world.mode === 'flow' ? 'grid' : 'flow';
    updateCaption();
  } else if (key === ' ') {
    paused = !paused;
    if (paused) {
      noLoop();
    } else {
      loop();
    }
    return false;   // keep the page from scrolling
  }
}
