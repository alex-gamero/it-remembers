# It Remembers

**A boss fight that learns from you.**

Most game bosses follow the same pattern every time. Learn it once and the fight is over. This one is different. Every time you die and try again, the boss remembers how you played and changes how it fights you. If you always dodge left, it starts attacking the left.

## How it works

1. **You fight.** The game records what you do: which way you dodge, how close you stay, when you attack.
2. **It learns.** A small machine learning model trains on your moves, right in your browser, and tries to predict what you'll do next.
3. **It adapts.** On your next run, the boss uses those predictions to counter you.
4. **It talks.** An LLM writes the boss's lines based on your habits, so it tells you exactly what it noticed.
5. **You adapt too.** Between runs you draw a random upgrade card, so you have to change your style and the boss has to keep up.

Every player fights their own boss. The model lives in your browser, so no two fights are the same.

## Tech

| Part | Tool |
|---|---|
| Game engine | JavaScript + [Phaser 3](https://phaser.io) |
| Player prediction | [TensorFlow.js](https://www.tensorflow.org/js) |
| Boss dialogue | [Google Gemini API](https://ai.google.dev/gemini-api/docs) through a serverless function |
| Pixel art | Aseprite |
| Hosting | itch.io |

The Gemini API key never ships with the game. It stays in a small serverless function. If Gemini is busy or hits a limit, the boss falls back to lines we wrote ourselves, so the game never breaks.

## Play it locally

You need [Node.js](https://nodejs.org) (the LTS version).

```bash
npm install     # only the first time
npm run dev     # opens the game at http://localhost:5173
```

Save a file and the game reloads by itself.

To make the version that goes on itch.io, run `npm run build` and zip what's inside the `dist` folder.

## Controls

Made for laptops. No mouse needed.

| Action | Keys |
|---|---|
| Move | WASD |
| Shoot | Arrow keys (hold two for diagonals) |
| Dash | Space or Shift |
| Pick a card | Arrow keys, then Space |

You can't be hit while dashing. A mouse also works: left click shoots where you point, right click dashes.

## The boss

The Machine has 10 attacks. The ones marked (AI) use what it learned about how you dodge.

| Attack | What it does |
|---|---|
| Predict (AI) | Marks where you'll dodge, shoots at you to make you move, then fires into the mark |
| Cable slam (AI) | Cables smash the floor where you are and where you'll dodge |
| Firewall (AI) | A wall of bits with one gap, on the side you never go |
| Ram (AI) | Charges at where you'll dodge, then gets dizzy. Hit it then for extra damage |
| Laser scan (AI) | Two beams that sweep toward your favorite dodge. Phase 2 only |
| Error popups (AI) | Windows fall on you and where you'll dodge. Phase 2 only |
| Viruses | Little bugs that chase you. Shoot them. Phase 2 only |
| Ring, fan, spiral | Classic bullet patterns |

At half health it enters phase 2: the room turns red and it gets faster and meaner.

## Upgrade cards

Every time you die you pick 1 of 3 random cards. Cards stack until you beat the boss.

Extra Life, Overclock, Big Shot, Split Shot, Long Dash, Quick Dash, Firewall, Shockwave, and `???`: 50% you get two random cards, 50% you start the next run with one heart less.

## Where things are

| File | What it does |
|---|---|
| `src/config.js` | Every number you might want to tweak: speeds, health, timings |
| `src/scenes/Game.js` | The fight: room, bullets, hits, camera |
| `src/scenes/Hud.js` | Hearts, cards, boss bar, messages |
| `src/scenes/Cards.js` | The pick-a-card screen after you die |
| `src/entities/Player.js` | Moving, dashing, shooting |
| `src/entities/Boss.js` | Boss movement, all attacks, both phases |
| `src/systems/Deck.js` | The upgrade cards and what each one does |
| `src/systems/Recorder.js` | Saves how you play in the browser |
| `src/systems/Predictor.js` | Guesses your next dash. The TensorFlow.js model goes here |
| `src/lines.js` | Boss lines for when Gemini isn't available |
| `tools/make_sprites.py` | Draws every sprite. Run it again after changing a color or shape |

To wipe what the boss remembers and your cards, open the browser console and type `forgetEverything()`.

## Status

- [x] Art direction and boss design
- [x] Player movement and boss fight
- [x] Recording player moves
- [ ] Prediction model (right now the boss just counts your dashes)
- [ ] Boss dialogue with Gemini (right now it uses the fallback lines)
- [x] Upgrade cards
- [ ] Publish on itch.io

## Team

- **Alex Gamero** ([@alex-gamero](https://github.com/alex-gamero))
- **Helena Porras** ([@helenaporras940-crypto](https://github.com/helenaporras940-crypto))

Built as the final project for CST8400, Analysis and Design using Emerging Technologies, at Algonquin College.
