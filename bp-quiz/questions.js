// Quiz questions. Category mapping per answer is set in the admin.
// DUPR ranges and budget brackets live in the Apps Script (FILTER_ANSWERS).

export const BP_QUESTIONS = [
  {
    id: 'q1',
    type: 'search',
    title: 'What paddle do you currently play with most?',
    helper: 'This helps us understand your preferences and find paddles that are the perfect upgrade.',
    answers: [
      { id: 'q1_search', label: 'Search for my paddle', helper: "I'll type in the name", openSearch: true },
      { id: 'q1_none', label: "I don't currently have a paddle", helper: "I'm looking for my first one" },
      { id: 'q1_unsure', label: "I'm not sure", helper: "I can't remember the name" },
      { id: 'q1_notlisted', label: 'My paddle is not listed', helper: "I'll describe it later" }
    ]
  },
  {
    id: 'q2',
    type: 'single',
    title: 'What do you like most about your current paddle?',
    answers: [
      { id: 'q2_power', label: 'Power' },
      { id: 'q2_control', label: 'Control' },
      { id: 'q2_spin', label: 'Spin' },
      { id: 'q2_stability', label: 'Stability' },
      { id: 'q2_softfeel', label: 'Soft feel' },
      { id: 'q2_fasthands', label: 'Fast hands' },
      { id: 'q2_sweetspot', label: 'Sweet spot' },
      { id: 'q2_unsure', label: "I'm not sure" }
    ]
  },
  {
    id: 'q3',
    type: 'single',
    title: 'What would you most want to improve about your current paddle?',
    answers: [
      { id: 'q3_long', label: 'Balls fly long' },
      { id: 'q3_power', label: 'I lack put-away power' },
      { id: 'q3_spin', label: "I can't generate enough spin" },
      { id: 'q3_mishits', label: 'Mishits hurt me too much' },
      { id: 'q3_slowhands', label: 'My hands feel slow at the kitchen' },
      { id: 'q3_stiff', label: 'Paddle feels too stiff' },
      { id: 'q3_mushy', label: 'Paddle feels too soft/mushy' },
      { id: 'q3_unsure', label: "I'm not sure" }
    ]
  },
  {
    id: 'q4',
    type: 'single',
    title: 'How often do you play pickleball?',
    answers: [
      { id: 'q4_daily', label: 'Daily' },
      { id: 'q4_3to5', label: '3 to 5 times per week' },
      { id: 'q4_weekly', label: 'Weekly' },
      { id: 'q4_monthly', label: 'Monthly or less' }
    ]
  },
  {
    id: 'q5',
    type: 'single',
    filter: 'dupr',
    title: 'What is your current skill level?',
    answers: [
      { id: 'q5_beginner', label: 'Beginner / newer player' },
      { id: 'q5_30', label: 'Around 3.0' },
      { id: 'q5_35', label: 'Around 3.5' },
      { id: 'q5_40', label: 'Around 4.0' },
      { id: 'q5_45', label: '4.5+' },
      { id: 'q5_unsure', label: "I'm not sure" }
    ]
  },
  {
    id: 'q6',
    type: 'single',
    title: 'Do you play more singles or doubles?',
    answers: [
      { id: 'q6_singles', label: 'Mostly singles' },
      { id: 'q6_doubles', label: 'Mostly doubles' },
      { id: 'q6_both', label: 'Both about equally' },
      { id: 'q6_unsure', label: "I'm not sure / just starting" }
    ]
  },
  {
    id: 'q7',
    type: 'slider',
    title: 'How aggressive is your play style?',
    helper: 'Slide between very patient (1) and very aggressive (10).',
    min: 1,
    max: 10,
    minLabel: 'Patient / control-first',
    maxLabel: 'Aggressive / attack-first'
  },
  {
    id: 'q8',
    type: 'single',
    title: 'What wins you the most points?',
    answers: [
      { id: 'q8_drives', label: 'Drives' },
      { id: 'q8_drops', label: 'Drops' },
      { id: 'q8_dinks', label: 'Dinks' },
      { id: 'q8_counters', label: 'Counters' },
      { id: 'q8_speedups', label: 'Speedups' },
      { id: 'q8_spin', label: 'Spin serves / spin returns' },
      { id: 'q8_everything', label: 'A little bit of everything' }
    ]
  },
  {
    id: 'q9',
    type: 'single',
    title: 'Which shot do you struggle with most?',
    answers: [
      { id: 'q9_driveslong', label: 'Drives go long' },
      { id: 'q9_dropshigh', label: 'Drops sit too high' },
      { id: 'q9_dinks', label: 'Dinks are inconsistent' },
      { id: 'q9_blocks', label: 'Blocks/counters feel unstable' },
      { id: 'q9_putaway', label: "I can't put balls away" },
      { id: 'q9_mishits', label: 'I miss off-center too often' },
      { id: 'q9_spin', label: 'I struggle generating spin' },
      { id: 'q9_slowhands', label: 'My hands feel slow at the kitchen' }
    ]
  },
  {
    id: 'q10',
    type: 'single',
    title: 'Which shot do you hit most often during games?',
    answers: [
      { id: 'q10_drives', label: 'Drives' },
      { id: 'q10_drops', label: 'Drops' },
      { id: 'q10_dinks', label: 'Dinks' },
      { id: 'q10_counters', label: 'Counters' },
      { id: 'q10_resets', label: 'Resets / blocks' },
      { id: 'q10_speedups', label: 'Speedups' },
      { id: 'q10_spin', label: 'Serves / returns with spin' },
      { id: 'q10_everything', label: 'I play a little of everything' }
    ]
  },
  {
    id: 'q11',
    type: 'single',
    title: 'How often do you attack or speed up the ball at the kitchen?',
    answers: [
      { id: 'q11_rarely', label: 'Rarely, I mostly dink and reset' },
      { id: 'q11_sometimes', label: 'Sometimes, but only on obvious balls' },
      { id: 'q11_often', label: 'Often, I look to speed up' },
      { id: 'q11_constantly', label: 'Constantly, I want to pressure people' }
    ]
  },
  {
    id: 'q12',
    type: 'single',
    title: 'When someone attacks you, what do you usually prefer to do?',
    answers: [
      { id: 'q12_block', label: 'Mostly block/reset the ball' },
      { id: 'q12_counter', label: 'Mostly counter/punch back' },
      { id: 'q12_mix', label: 'A mix of both' },
      { id: 'q12_unsure', label: "I'm not sure" }
    ]
  },
  {
    id: 'q13',
    type: 'slider',
    title: 'How important is spin to your game?',
    min: 1,
    max: 10,
    minLabel: 'Not important',
    maxLabel: 'Very important'
  },
  {
    id: 'q14',
    type: 'slider',
    title: 'How important is power to your game?',
    min: 1,
    max: 10,
    minLabel: 'Not important',
    maxLabel: 'Very important'
  },
  {
    id: 'q15',
    type: 'slider',
    title: 'How important is control, touch, and placement?',
    min: 1,
    max: 10,
    minLabel: 'Not important',
    maxLabel: 'Very important'
  },
  {
    id: 'q16',
    type: 'slider',
    title: 'How important is a large sweet spot and forgiveness?',
    min: 1,
    max: 10,
    minLabel: 'Not important',
    maxLabel: 'Very important'
  },
  {
    id: 'q17',
    type: 'slider',
    title: 'How important is hand speed at the kitchen?',
    min: 1,
    max: 10,
    minLabel: 'Not important',
    maxLabel: 'Very important'
  },
  {
    id: 'q18',
    type: 'single',
    title: 'How often do you hit topspin drives, rolls, or serves?',
    answers: [
      { id: 'q18_never', label: 'Never' },
      { id: 'q18_sometimes', label: 'Sometimes' },
      { id: 'q18_often', label: 'Often' },
      { id: 'q18_constantly', label: 'Constantly' }
    ]
  },
  {
    id: 'q19',
    type: 'single',
    title: 'How often do you slice, chop, or use backspin?',
    answers: [
      { id: 'q19_never', label: 'Never' },
      { id: 'q19_sometimes', label: 'Sometimes' },
      { id: 'q19_often', label: 'Often' },
      { id: 'q19_constantly', label: 'Constantly' }
    ]
  },
  {
    id: 'q20',
    type: 'single',
    title: 'Which sounds more like your game?',
    answers: [
      { id: 'q20_long', label: 'I like winning long rallies' },
      { id: 'q20_quick', label: 'I like ending points quickly' },
      { id: 'q20_balance', label: 'I want a balance of both' },
      { id: 'q20_unsure', label: "I'm not sure" }
    ]
  },
  {
    id: 'q21',
    type: 'single',
    title: 'Which best describes your play style?',
    answers: [
      { id: 'q21_defensive', label: 'Defensive player' },
      { id: 'q21_counter', label: 'Counter puncher' },
      { id: 'q21_allcourt', label: 'All-court player' },
      { id: 'q21_aggressive', label: 'Aggressive attacker' }
    ]
  },
  {
    id: 'q22',
    type: 'single',
    title: 'Which type of player do you most resemble?',
    answers: [
      { id: 'q22_grinder', label: 'Grinder, I keep balls in and make people miss' },
      { id: 'q22_strategist', label: 'Strategist, I win with placement and patience' },
      { id: 'q22_power', label: 'Power hitter, I win with drives and put-aways' },
      { id: 'q22_shotmaker', label: 'Shot maker, I like spin, angles, and variety' },
      { id: 'q22_counter', label: 'Counter attacker, I like hands battles and counters' },
      { id: 'q22_unsure', label: "I'm not sure" }
    ]
  },
  {
    id: 'q23',
    type: 'single',
    title: 'Do you hit a two-handed backhand?',
    answers: [
      { id: 'q23_yes', label: 'Yes, most of the time' },
      { id: 'q23_sometimes', label: 'Sometimes' },
      { id: 'q23_no', label: 'No, one-handed only' },
      { id: 'q23_learning', label: "I'm learning / not sure" }
    ]
  },
  {
    id: 'q24',
    type: 'single',
    title: 'What type of paddle feel do you usually prefer?',
    answers: [
      { id: 'q24_verysoft', label: 'Very soft / plush' },
      { id: 'q24_soft', label: 'Soft' },
      { id: 'q24_balanced', label: 'Balanced' },
      { id: 'q24_crisp', label: 'Crisp' },
      { id: 'q24_verycrisp', label: 'Very crisp / explosive' },
      { id: 'q24_unsure', label: "I'm not sure" }
    ]
  },
  {
    id: 'q25',
    type: 'single',
    title: 'How much feedback do you like to feel when the ball hits the paddle?',
    answers: [
      { id: 'q25_muted', label: 'Very muted / soft' },
      { id: 'q25_slight', label: 'Slight feedback, but still comfortable' },
      { id: 'q25_balanced', label: 'Balanced feedback' },
      { id: 'q25_lot', label: 'A lot of feedback / connected feel' },
      { id: 'q25_direct', label: 'Very direct / explosive' }
    ]
  },
  {
    id: 'q26',
    type: 'single',
    title: 'Would you give up some power if it helped you play more consistently?',
    answers: [
      { id: 'q26_absolutely', label: 'Yes, absolutely' },
      { id: 'q26_somewhat', label: 'Yes, somewhat' },
      { id: 'q26_balanced', label: 'I want a balanced paddle' },
      { id: 'q26_no', label: 'No, I still want power/pop' },
      { id: 'q26_unsure', label: "I'm not sure" }
    ]
  },
  {
    id: 'q27',
    type: 'single',
    title: 'Which paddle feel sounds best to you?',
    answers: [
      { id: 'q27_plush', label: 'Plush, soft, comfortable, controlled' },
      { id: 'q27_connected', label: 'Connected, I want to feel the ball, but still have control' },
      { id: 'q27_explosive', label: 'Explosive, I want the ball to jump off the paddle' },
      { id: 'q27_unsure', label: "I'm not sure" }
    ]
  },
  {
    id: 'q28',
    type: 'single',
    title: 'How tall are you?',
    answers: [
      { id: 'q28_under54', label: 'Under 5 feet 4 inches' },
      { id: 'q28_54to58', label: '5 feet 4 inches to 5 feet 8 inches' },
      { id: 'q28_59to60', label: '5 feet 9 inches to 6 feet' },
      { id: 'q28_61plus', label: '6 feet 1 inch or taller' },
      { id: 'q28_pns', label: 'Prefer not to say' }
    ]
  },
  {
    id: 'q29',
    type: 'single',
    title: 'How would you describe your natural power and strength?',
    answers: [
      { id: 'q29_below', label: 'Below average, I need help creating power' },
      { id: 'q29_average', label: 'Average' },
      { id: 'q29_above', label: 'Athletic / above average' },
      { id: 'q29_strong', label: 'Very strong, I create plenty of power myself' }
    ]
  },
  {
    id: 'q30',
    type: 'multi',
    title: 'Which racquet/paddle sport background do you have?',
    helper: 'Select all that apply.',
    answers: [
      { id: 'q30_tennis', label: 'Tennis' },
      { id: 'q30_pingpong', label: 'Ping pong / table tennis' },
      { id: 'q30_racquetball', label: 'Racquetball' },
      { id: 'q30_squash', label: 'Squash' },
      { id: 'q30_other', label: 'Other racquet sport' },
      { id: 'q30_none', label: 'No racquet sports background' }
    ]
  },
  {
    id: 'q31',
    type: 'single',
    filter: 'budget',
    title: "What is your preferred paddle budget?",
    answers: [
      { id: 'q31_under25', label: 'Under $25' },
      { id: 'q31_51to100', label: '$51 to $100' },
      { id: 'q31_101to200', label: '$101 to $200' },
      { id: 'q31_201to300', label: '$201 to $300' },
      { id: 'q31_301plus', label: '$301+' },
      { id: 'q31_flexible', label: "I'm flexible for the right paddle" }
    ]
  }
];
