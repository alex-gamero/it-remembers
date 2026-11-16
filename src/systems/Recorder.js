// Saves how the player plays, so the boss can remember it next run.
// Everything stays in this browser (localStorage). Nothing is sent anywhere.

const STORAGE_KEY = 'it-remembers:memory:v1';
const MAX_SAVED_DASHES = 400;

function emptyMemory() {
  return {
    runs: 0,
    wins: 0,
    dashCounts: { left: 0, right: 0, up: 0, down: 0 },
    dashes: [],      // every dash: { direction, distanceToBoss, bossSide, health, phase, run }
    runHistory: [],  // one entry per finished run
  };
}

function loadMemory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.dashCounts) {
      return { ...emptyMemory(), ...saved };
    }
  } catch (error) {
    // Storage can be blocked (private windows). The game still works without it.
  }
  return emptyMemory();
}

export class Recorder {
  constructor() {
    this.memory = loadMemory();
    this.currentRun = null;
  }

  startRun() {
    this.currentRun = { dashes: 0, shots: 0, hitsTaken: 0, startedAt: Date.now() };
  }

  // direction is 'left', 'right', 'up' or 'down'
  recordDash(direction, details) {
    this.memory.dashCounts[direction] += 1;
    this.memory.dashes.push({ direction, run: this.memory.runs + 1, ...details });
    if (this.memory.dashes.length > MAX_SAVED_DASHES) {
      this.memory.dashes.shift();
    }
    if (this.currentRun) this.currentRun.dashes += 1;
  }

  recordShot() {
    if (this.currentRun) this.currentRun.shots += 1;
  }

  recordHit() {
    if (this.currentRun) this.currentRun.hitsTaken += 1;
  }

  endRun(playerWon, bossHealthLeft) {
    if (!this.currentRun) return;
    this.memory.runs += 1;
    if (playerWon) this.memory.wins += 1;
    this.memory.runHistory.push({
      run: this.memory.runs,
      won: playerWon,
      bossHealthLeft,
      seconds: Math.round((Date.now() - this.currentRun.startedAt) / 1000),
      dashes: this.currentRun.dashes,
      shots: this.currentRun.shots,
      hitsTaken: this.currentRun.hitsTaken,
    });
    this.currentRun = null;
    this.save();
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memory));
    } catch (error) {
      // Ignore. See loadMemory.
    }
  }

  get runs() {
    return this.memory.runs;
  }

  totalDashes() {
    const counts = this.memory.dashCounts;
    return counts.left + counts.right + counts.up + counts.down;
  }
}

// Handy while testing: type forgetEverything() in the browser console.
if (typeof window !== 'undefined') {
  window.forgetEverything = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore.
    }
    console.log('Memory wiped. Reload the page.');
  };
}
