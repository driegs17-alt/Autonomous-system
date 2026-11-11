/*
  CONFIG
  Every tunable number and every palette lives here, so the rules of the
  system can be read (and changed) in one place.
*/

const CONFIG = {
  // Print format: an 8x10 portrait at 100 px/inch, rendered at 2x density.
  width: 800,
  height: 1000,
  margin: 72,
  density: 2,

  // Lifecycle of a piece.
  minFrames: 900,           // the system draws for at least this long (~15 s)
  idleToFinish: 240,        // ...then signs itself after ~4 s without mouse input

  // Agents.
  agents: [800, 1300],      // min / max population, picked per world
  life: [70, 340],          // min / max frames an agent lives
  speed: [0.9, 1.9],        // min / max pixels per frame
  steer: [0.08, 0.22],      // how quickly an agent turns toward the current (inertia)
  maxWeight: [0.4, 2.8],    // thinnest / thickest stroke (shaped by noise)
  accentChance: 0.06,       // share of agents that carry the accent ink

  // Field.
  fieldScale: [0.0016, 0.0042],
  colorScale: [0.0015, 0.0040],
  turns: [1.4, 3.0],
  warp: [0, 140],           // domain-warp strength: calm water -> turbulent water
  drift: 0.0015,            // how fast the field changes over time
  gridChance: 0.3,          // chance a world uses 45-degree "grid" mode

  // Interaction.
  vortexRadius: 170,
  pourRate: 10,             // agents recycled into the cursor per frame while dragging
  clickTolerance: 6,        // px of movement before a press counts as a drag
  clickTime: 250            // ms held before a press counts as a drag
};

/*
  Palettes follow a 60/30/10 rule: a paper tone, three related inks that
  noise() spreads across the page in regions, and one accent ink that random()
  hands to only a few agents, so it reads as a highlight, not a fourth colour.
*/
const PALETTES = [
  { name: 'Tide',        paper: '#F2EDE4', dark: false, inks: ['#0B3954', '#087E8B', '#9CC5D8'], accent: '#FF5A5F' },
  { name: 'Ember',       paper: '#17161A', dark: true,  inks: ['#E76F51', '#F4A261', '#FAF3E0'], accent: '#E9C46A' },
  { name: 'Moss',        paper: '#EDEFE4', dark: false, inks: ['#203B2F', '#6B8F71', '#B5A78A'], accent: '#C9562A' },
  { name: 'Ink',         paper: '#F5F3EE', dark: false, inks: ['#111111', '#3A3A3A', '#8C8C8C'], accent: '#D7263D' },
  { name: 'Night Bloom', paper: '#0E1428', dark: true,  inks: ['#7B9E89', '#EE964B', '#F4D35E'], accent: '#F95738' },
  { name: 'Dune',        paper: '#EDE3D1', dark: false, inks: ['#3B2F2F', '#A0522D', '#5B7065'], accent: '#1D5C96' }
];
