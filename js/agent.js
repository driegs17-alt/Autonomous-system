/*
  AGENT
  One drifting ink-carrier. It has no idea what the picture looks like;
  it only reads the current where it stands and follows it until it dies.
  Everything interesting comes from a thousand of them obeying the same rules.
*/

class Agent {
  constructor() {
    this.respawn();
  }

  // Birth: random() decides where, how long and how fast. noise() decides the ink and weight.
  respawn(x, y) {
    const m = CONFIG.margin;
    this.x = x === undefined ? random(m, CONFIG.width - m) : x;
    this.y = y === undefined ? random(m, CONFIG.height - m) : y;

    // Start already facing along the current, so new strokes don't begin with a hook.
    const a = fieldAngle(this.x, this.y);
    this.vx = cos(a);
    this.vy = sin(a);

    this.age = 0;
    this.life = random(CONFIG.life[0], CONFIG.life[1]);
    this.speed = random(CONFIG.speed[0], CONFIG.speed[1]);
    this.steer = random(CONFIG.steer[0], CONFIG.steer[1]);

    // Ink: a few agents (random) carry the accent; the rest take the ink of
    // the colour region they were born in (noise), so colour forms bodies, not confetti.
    if (random() < CONFIG.accentChance) {
      this.ink = world.accent;
    } else {
      const n = noise(this.x * world.colorScale, this.y * world.colorScale, 50);
      const i = floor(constrain(map(n, 0.3, 0.7, 0, world.inks.length), 0, world.inks.length - 1));
      this.ink = world.inks[i];
    }

    // Weight: thick and thin neighbourhoods across the page, shaped by noise.
    const w = noise(this.x * 0.006, this.y * 0.006, 200);
    this.maxWeight = map(w, 0.25, 0.75, CONFIG.maxWeight[0], CONFIG.maxWeight[1], true);
  }

  // One frame: steer toward the current, move, draw, and maybe die.
  step(layer) {
    // Where does the water want to go here?
    const a = fieldAngle(this.x, this.y);
    let dx = cos(a);
    let dy = sin(a);

    // Near the cursor, the whirlpool bends that direction into a swirl.
    const swirl = swirlAt(this.x, this.y);
    if (swirl) {
      dx = lerp(dx, swirl.x, swirl.pull);
      dy = lerp(dy, swirl.y, swirl.pull);
    }

    // Inertia: turn gradually toward the desired direction instead of snapping.
    // This is what gives the strokes their smooth, brush-like curves.
    this.vx = lerp(this.vx, dx, this.steer);
    this.vy = lerp(this.vy, dy, this.steer);
    const len = sqrt(this.vx * this.vx + this.vy * this.vy) || 1;

    const px = this.x;
    const py = this.y;
    this.x += (this.vx / len) * this.speed;
    this.y += (this.vy / len) * this.speed;
    this.age++;

    const m = CONFIG.margin;
    const outside = this.x < m || this.x > CONFIG.width - m ||
                    this.y < m || this.y > CONFIG.height - m;
    if (outside || this.age > this.life) {
      this.respawn();
      return;
    }

    // Taper: the stroke swells in the middle of the agent's life and thins at
    // both ends, like a brush touching down and lifting off.
    const t = this.age / this.life;
    const weight = this.maxWeight * pow(sin(PI * t), 0.6);

    layer.stroke(this.ink);
    layer.strokeWeight(max(weight, 0.15));
    layer.line(px, py, this.x, this.y);
  }
}
