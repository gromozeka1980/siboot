// Characters and their personalities (TitleZ.InitChar), initial relationship matrices and
// story parameters (Init.InitGame). Values verified identical in the DOS build.
// Edit here to rebalance or add content.

// [name, species, male, loyalty, integrity, temper, revenge, duty, pride, secret, desLiked, gullble, fiance]
export const CHARACTERS = [
  null,
  ['Vetvel', 'Jomkar', false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Asparuch'],
  ['Kendra', 'Klast', false, 0, 0, 16, 8, 0, 0, 0, 16, 4, 'Tervel'],
  ['Gardbore', 'Frem', true, 12, 4, 8, 16, 4, 12, 16, 4, 0, 'Sevar'],
  ['Wiki', 'Ripi', true, 8, 12, 12, 0, 16, 4, 8, 8, 4, 'Kormisos'],
  ['Locksher', 'Lokweel', true, 12, 16, 0, 8, 4, 8, 16, 4, 12, 'Bashee'],
  ['Zubi', 'Srol', false, 4, 8, 8, 0, 16, 4, 12, 16, 16, 'Teletz'],
  ['Skordokott', 'Tayran', true, 16, 10, 4, 8, 16, 16, 0, 0, 8, 'Flofftsikott'],
];
export const CHRIS_NAME = 'Chris Crawford'; // character 8: dossier only

// LOVE[a][b] = how much a loves b (1-based rows/cols)
export const LOVE = [null,
  [null, 127, 0, -50, 40, -10, -80, 60],
  [null, 0, 127, -20, -20, -10, -20, 70],
  [null, -10, 30, 127, -70, -30, 30, 50],
  [null, 20, -40, -40, 127, 40, 40, -20],
  [null, -30, -20, 10, 30, 127, 70, -60],
  [null, -40, -30, 60, 50, 60, 127, -90],
  [null, 60, 60, 40, -30, -50, -80, 127],
];
export const TRUST = [null,
  [null, 127, 40, -30, 0, -60, 10, 40],
  [null, -20, 127, 80, 70, 40, -90, -80],
  [null, -40, -50, 127, -20, 60, 30, 20],
  [null, 50, 60, 40, 127, -50, -50, -50],
  [null, 20, -20, -50, 0, 127, 0, 50],
  [null, -30, 10, -50, -30, 30, 127, 20],
  [null, 0, 20, 10, -20, -20, 40, 127],
];
export const FEAR = [null,
  [null, 127, 80, -20, 30, -50, -20, -20],
  [null, -40, 127, 20, 30, 20, -20, -10],
  [null, -40, -20, 127, -10, 60, 30, -20],
  [null, 20, -40, 40, 127, -40, 40, -20],
  [null, 30, -60, -30, -50, 127, 40, 60],
  [null, 50, 30, 30, 40, 40, 127, -40],
  [null, -20, 10, -40, -40, -30, 0, 127],
];

// Story selection parameters 1..44 (others -1). Encoding (see engine/events.js):
// value mod 8 = character (0 any), (div 8) mod 8 = context (0 any), (div 64) mod 4 = mood test,
// ((div 256) mod 4)-1 = mood value, div 1024 must be 0 to be eligible; negative = disabled.
export const STORY_PARM = [null,
  8, 31, 40, 8, 8, 14, 15, 46, 8, 13, 16, 51, 44, 18, 8, 24, 24, 24, 8, -8,
  -1032, -1032, -24, 40, 8, 26, -27, -28, -30, 8, -748, -683, -110, -237, -169, -106,
  1024, 1024, 1024, 1024, 1024, 48, 111, -8,
];

export const WORD_POS = [null, [0, 0], [40, 0], [80, 0], [40, 40], [80, 40], [120, 40], [160, 40], [120, 80]];
export const DEAL_POS = [null, [0, 0], [40, 0], [80, 0], [40, 40], [40, 80], [120, 0], [160, 0], [200, 0], [240, 0], [200, 40], [200, 80]];

export const BAR_GRAPH_LABELS = [null, 'Previous fear', 'Current fear', 'Previous trust', 'Current trust', 'Previous love', 'Current love'];

// emotion face descriptions shown when clicking the face (index = face number 1..34)
export const FACE_LOOKS = [null, 'suspicious.', 'doubtful.', 'angry.', 'worried.', 'indignant.', 'inquisitive.',
  'hurt.', 'flattered.', 'surprised.', 'smirky.', 'self-satisfactied.', 'light-hearted.', 'sneering.',
  'apologetic.', 'fearful.', 'smug.', 'sympathetic.', 'disappointed.', 'accusatory.', 'conspiratorial.',
  'fearful.', 'trusting.', 'hate-filled.', 'distrustful.', 'chatty.', 'loving.', 'forgiving.', 'thankful.',
  'flattering.', 'giggly.', 'irritated.', 'supplicatory.', 'uncooperative.', 'threatening.'];
