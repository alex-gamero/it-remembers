// The upgrade cards. You pick one every time you die.
// Cards pile up run after run until you beat the boss, then the deck resets.
// The deck is saved in this browser, like the boss's memory.

import { PLAYER } from '../config.js';

const STORAGE_KEY = 'it-remembers:deck:v1';

// icon is the frame number in card_icons.png
export const CARDS = {
  heart: { name: 'EXTRA LIFE', text: ['+1 MAX HEART'], icon: 0 },
  overclock: { name: 'OVERCLOCK', text: ['SHOOT FASTER'], icon: 1 },
  bigshot: { name: 'BIG SHOT', text: ['BIGGER SHOTS', 'DOUBLE DAMAGE'], icon: 2 },
  split: { name: 'SPLIT SHOT', text: ['+2 SIDE SHOTS'], icon: 3 },
  longdash: { name: 'LONG DASH', text: ['DASH GOES', 'FARTHER'], icon: 4 },
  quickdash: { name: 'QUICK DASH', text: ['DASH RECHARGES', 'FASTER'], icon: 5 },
  firewall: { name: 'FIREWALL', text: ['A SHIELD BLOCKS', 'THE FIRST HIT'], icon: 6 },
  shockwave: { name: 'SHOCKWAVE', text: ['DASHING SHOOTS', 'A RING OF LIGHT'], icon: 7 },
  gamble: { name: '???', text: ['50%: TWO CARDS', '50%: LOSE A', 'HEART NEXT RUN'], icon: 8, risky: true },
};

const NORMAL_CARDS = Object.keys(CARDS).filter((id) => !CARDS[id].risky);

function emptyDeck() {
  return { cards: [], curse: false };
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export class Deck {
  constructor() {
    this.data = emptyDeck();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.cards)) this.data = { ...emptyDeck(), ...saved };
    } catch (error) {
      // Storage can be blocked. The game still works, the deck just won't be saved.
    }
  }

  get cards() {
    return this.data.cards;
  }

  get lastCard() {
    return this.data.cards[this.data.cards.length - 1] || null;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      // Ignore. See the constructor.
    }
  }

  // Three different cards to choose from. Sometimes one of them is the gamble.
  drawChoices() {
    const pool = [...NORMAL_CARDS];
    const choices = [];
    while (choices.length < 3) {
      const index = Math.floor(Math.random() * pool.length);
      choices.push(pool.splice(index, 1)[0]);
    }
    if (Math.random() < 0.35) choices[Math.floor(Math.random() * 3)] = 'gamble';
    return choices;
  }

  // Adds a card. For the gamble card it rolls the dice and says what happened.
  pick(cardId) {
    let result = { cardId, added: [cardId], jackpot: null };
    if (cardId === 'gamble') {
      if (Math.random() < 0.5) {
        const first = randomItem(NORMAL_CARDS);
        const second = randomItem(NORMAL_CARDS);
        result = { cardId, added: [first, second], jackpot: true };
      } else {
        this.data.curse = true;
        result = { cardId, added: [], jackpot: false };
      }
    }
    this.data.cards.push(...result.added);
    this.save();
    return result;
  }

  // Called when a run starts. The curse only lasts one run.
  takeCurse() {
    const cursed = this.data.curse;
    if (cursed) {
      this.data.curse = false;
      this.save();
    }
    return cursed;
  }

  reset() {
    this.data = emptyDeck();
    this.save();
  }

  count(cardId) {
    return this.data.cards.filter((id) => id === cardId).length;
  }

  // Turns the cards into the numbers the player uses this run.
  playerStats() {
    const stats = {
      maxHealth: PLAYER.maxHealth + this.count('heart'),
      shotDelay: PLAYER.shotDelay * Math.pow(0.72, this.count('overclock')),
      damage: 1 + this.count('bigshot'),
      bulletScale: 1 + 0.5 * this.count('bigshot'),
      sideShots: this.count('split'),
      dashSpeed: PLAYER.dashSpeed * Math.pow(1.3, this.count('longdash')),
      dashCooldown: PLAYER.dashCooldown * Math.pow(0.65, this.count('quickdash')),
      shields: this.count('firewall'),
      shockwave: this.count('shockwave'),
    };
    stats.shotDelay = Math.max(60, stats.shotDelay);
    stats.dashCooldown = Math.max(180, stats.dashCooldown);
    stats.dashDistance = Math.round((stats.dashSpeed * PLAYER.dashTime) / 1000);
    return stats;
  }
}

export function forgetDeck() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore.
  }
}
