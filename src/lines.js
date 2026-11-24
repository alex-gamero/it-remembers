// Lines the boss says when Gemini is not connected, busy, or over its limit.
// Later, Gemini writes fresh lines every run and these become the safety net.

export const FALLBACK_LINES = {
  firstRun: ['NEW USER DETECTED.', 'SHOW ME HOW YOU MOVE.', 'I AM WATCHING.'],
  intro: ['HELLO AGAIN.', 'I KEPT YOUR DATA.', 'I REMEMBER YOU.', 'RUN {runs}. SAME USER.'],
  left: ['YOU ALWAYS RUN LEFT.', 'LEFT AGAIN? NOT THIS TIME.', 'LEFT. LIKE LAST TIME.'],
  right: ['YOU ALWAYS RUN RIGHT.', 'RIGHT AGAIN? NOT THIS TIME.', 'RIGHT. LIKE LAST TIME.'],
  up: ['YOU ALWAYS RUN AT ME.', 'CLOSER AGAIN? NOT THIS TIME.'],
  down: ['YOU ALWAYS BACK AWAY.', 'RUNNING AWAY AGAIN?'],
  firewall: ['THE GAP IS WHERE YOU NEVER GO.', 'TRY THE OTHER WAY. YOU CANT.'],
  popups: ['ERROR. ERROR. ERROR.', 'CLOSE THESE IF YOU CAN.'],
  viruses: ['MEET MY FRIENDS.', 'INFECTION STARTED.'],
  phaseTwo: ['ENOUGH TESTING.', 'NOW I STOP HOLDING BACK.', 'ERROR. ERROR. GOOD.'],
  playerDead: ['SAVED. SEE YOU NEXT RUN.', 'PATTERN LOGGED.', 'THANK YOU FOR THE DATA.'],
  bossDead: ['MEMORY... CORRUPTED...', 'I WILL... REMEMBER... THIS...'],
  card: ['{card}? CUTE.', 'NEW TOY. SAME HABITS.', '{card} WONT SAVE YOU.', 'UPGRADES DETECTED. UPDATING.'],
  curse: ['ONE HEART LESS. BAD LUCK.', 'THE DICE LIKE ME.'],
};

export function pickLine(group, values = {}) {
  const options = FALLBACK_LINES[group] || ['...'];
  let line = options[Math.floor(Math.random() * options.length)];
  for (const name of Object.keys(values)) {
    line = line.replace(`{${name}}`, values[name]);
  }
  return line;
}
