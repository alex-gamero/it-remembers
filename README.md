# It Remembers

**A boss fight that learns from you.**

Most game bosses follow the same pattern every time. Learn it once and the fight is over. This one is different. Every time you die and try again, the boss remembers how you played and changes how it fights you. If you always dodge left, it starts attacking the left.

> "You always run left. Not this time."

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

## Status

Early development. Art and core gameplay come first.

- [ ] Art direction and boss design
- [ ] Player movement and boss fight
- [ ] Recording player moves
- [ ] Prediction model
- [ ] Boss dialogue with Gemini + fallback lines
- [ ] Upgrade cards
- [ ] Publish on itch.io

## Team

- **Alex Gamero** ([@alex-gamero](https://github.com/alex-gamero))
- **Helena Porras**

Built as the final project for CST8400, Analysis and Design using Emerging Technologies, at Algonquin College.
