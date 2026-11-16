// Guesses which way the player will dash next.
//
// RIGHT NOW: it just counts. If 74% of your dashes went left, it says "left, 74%".
// NEXT STEP: swap the inside of predictDash() for the TensorFlow.js model.
// Keep the same return shape and the rest of the game does not need to change.

const MINIMUM_DASHES = 4;

export const DIRECTION_VECTORS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

export class Predictor {
  constructor(recorder) {
    this.recorder = recorder;
  }

  // Returns { direction, confidence } or null when it has not seen enough yet.
  predictDash() {
    const counts = this.recorder.memory.dashCounts;
    const total = this.recorder.totalDashes();
    if (total < MINIMUM_DASHES) return null;

    let bestDirection = 'left';
    for (const direction of Object.keys(counts)) {
      if (counts[direction] > counts[bestDirection]) bestDirection = direction;
    }
    return { direction: bestDirection, confidence: counts[bestDirection] / total };
  }
}
