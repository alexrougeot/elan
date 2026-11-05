// Catalogue d'exercices et programmes types.
import { allOf, putDoc, uid } from './store';

export type Equipment = 'barre' | 'haltères' | 'machine' | 'poulie' | 'poids du corps';

export type ExerciseDef = {
  key: string;
  name: string;
  muscle: string;
  equipment: Equipment;
  lower: boolean;
  compound: boolean;
  /** répétitions en secondes (gainage) */
  timed?: boolean;
  /** circuit chronométré (abdos) */
  circuit?: boolean;
  /** progression de charge quand la fourchette est validée */
  increment: number;
  /** créé par l'utilisateur */
  custom?: boolean;
  alternatives: string[];
};

const ex = (
  key: string,
  name: string,
  muscle: string,
  equipment: Equipment,
  lower: boolean,
  compound: boolean,
  alternatives: string[],
  extra: Partial<ExerciseDef> = {}
): ExerciseDef => ({
  key,
  name,
  muscle,
  equipment,
  lower,
  compound,
  increment: lower ? 5 : 2.5,
  alternatives,
  ...extra,
});

export const CATALOG: Record<string, ExerciseDef> = Object.fromEntries(
  [
    // Haut du corps
    ex('bench', 'Développé couché', 'Pectoraux', 'barre', false, true, ['db_bench', 'chest_press', 'incline_bench']),
    ex('db_bench', 'Développé couché haltères', 'Pectoraux', 'haltères', false, true, ['bench', 'chest_press']),
    ex('chest_press', 'Chest press machine', 'Pectoraux', 'machine', false, true, ['bench', 'db_bench']),
    ex('incline_bench', 'Développé incliné barre', 'Pectoraux', 'barre', false, true, ['incline_db', 'incline_machine']),
    ex('incline_db', 'Développé incliné haltères', 'Pectoraux', 'haltères', false, true, ['incline_bench', 'incline_machine']),
    ex('incline_machine', 'Développé incliné machine', 'Pectoraux', 'machine', false, true, ['incline_db', 'incline_bench']),
    ex('row', 'Rowing barre', 'Dos', 'barre', false, true, ['db_row', 'cable_row', 'tbar_row']),
    ex('tbar_row', 'Rowing T-bar', 'Dos', 'barre', false, true, ['row', 'cable_row']),
    ex('db_row', 'Rowing haltère', 'Dos', 'haltères', false, true, ['cable_row', 'row', 'machine_row']),
    ex('cable_row', 'Rowing assis poulie', 'Dos', 'poulie', false, true, ['db_row', 'machine_row']),
    ex('machine_row', 'Rowing machine', 'Dos', 'machine', false, true, ['cable_row', 'db_row']),
    ex('pullup', 'Tractions', 'Dos', 'poids du corps', false, true, ['lat_pulldown', 'assisted_pullup']),
    ex('assisted_pullup', 'Tractions assistées', 'Dos', 'machine', false, true, ['pullup', 'lat_pulldown']),
    ex('lat_pulldown', 'Tirage vertical', 'Dos', 'poulie', false, true, ['pullup', 'assisted_pullup']),
    ex('ohp', 'Développé militaire', 'Épaules', 'barre', false, true, ['db_ohp', 'machine_shoulder']),
    ex('db_ohp', 'Développé épaules haltères', 'Épaules', 'haltères', false, true, ['ohp', 'machine_shoulder']),
    ex('machine_shoulder', 'Développé épaules machine', 'Épaules', 'machine', false, true, ['db_ohp', 'ohp']),
    ex('lateral', 'Élévations latérales', 'Épaules', 'haltères', false, false, ['cable_lateral', 'machine_lateral'], { increment: 1 }),
    ex('cable_lateral', 'Élévations latérales poulie', 'Épaules', 'poulie', false, false, ['lateral', 'machine_lateral'], { increment: 1.25 }),
    ex('machine_lateral', 'Élévations latérales machine', 'Épaules', 'machine', false, false, ['lateral', 'cable_lateral']),
    ex('curl', 'Curl haltères', 'Biceps', 'haltères', false, false, ['barbell_curl', 'cable_curl'], { increment: 1 }),
    ex('barbell_curl', 'Curl barre', 'Biceps', 'barre', false, false, ['curl', 'cable_curl']),
    ex('incline_curl', 'Curl incliné', 'Biceps', 'haltères', false, false, ['curl', 'cable_curl'], { increment: 1 }),
    ex('cable_curl', 'Curl poulie', 'Biceps', 'poulie', false, false, ['curl', 'incline_curl'], { increment: 1.25 }),
    ex('triceps', 'Extension triceps poulie', 'Triceps', 'poulie', false, false, ['skullcrusher', 'dips'], { increment: 2.5 }),
    ex('overhead_triceps', 'Extension triceps au-dessus de la tête', 'Triceps', 'poulie', false, false, ['triceps', 'skullcrusher']),
    ex('skullcrusher', 'Barre au front', 'Triceps', 'barre', false, false, ['triceps', 'overhead_triceps']),
    ex('dips', 'Dips', 'Triceps', 'poids du corps', false, true, ['triceps', 'skullcrusher']),
    // Bas du corps
    ex('squat', 'Squat', 'Quadriceps', 'barre', true, true, ['hack_squat', 'leg_press', 'goblet_squat']),
    ex('hack_squat', 'Hack squat', 'Quadriceps', 'machine', true, true, ['squat', 'leg_press']),
    ex('goblet_squat', 'Goblet squat', 'Quadriceps', 'haltères', true, true, ['squat', 'leg_press'], { increment: 2 }),
    ex('leg_press', 'Presse', 'Quadriceps', 'machine', true, true, ['hack_squat', 'squat']),
    ex('rdl', 'Soulevé de terre roumain', 'Ischios', 'barre', true, true, ['db_rdl', 'good_morning']),
    ex('db_rdl', 'Soulevé de terre roumain haltères', 'Ischios', 'haltères', true, true, ['rdl', 'good_morning'], { increment: 2 }),
    ex('good_morning', 'Good morning', 'Ischios', 'barre', true, true, ['rdl', 'db_rdl']),
    ex('deadlift', 'Soulevé de terre', 'Dos et jambes', 'barre', true, true, ['trap_bar', 'rdl']),
    ex('trap_bar', 'Soulevé de terre trap bar', 'Dos et jambes', 'barre', true, true, ['deadlift', 'rdl']),
    ex('leg_curl', 'Leg curl', 'Ischios', 'machine', true, false, ['seated_leg_curl', 'db_rdl']),
    ex('seated_leg_curl', 'Leg curl assis', 'Ischios', 'machine', true, false, ['leg_curl']),
    ex('leg_ext', 'Leg extension', 'Quadriceps', 'machine', true, false, ['goblet_squat', 'leg_press']),
    ex('bulgarian', 'Fentes bulgares', 'Quadriceps et fessiers', 'haltères', true, true, ['lunges', 'step_up'], { increment: 2 }),
    ex('lunges', 'Fentes marchées', 'Quadriceps et fessiers', 'haltères', true, true, ['bulgarian', 'step_up'], { increment: 2 }),
    ex('step_up', 'Step-up', 'Quadriceps et fessiers', 'haltères', true, true, ['bulgarian', 'lunges'], { increment: 2 }),
    ex('hip_thrust', 'Hip thrust', 'Fessiers', 'barre', true, true, ['glute_bridge', 'glute_machine']),
    ex('glute_bridge', 'Pont fessier', 'Fessiers', 'barre', true, true, ['hip_thrust', 'glute_machine']),
    ex('glute_machine', 'Fessiers machine', 'Fessiers', 'machine', true, false, ['hip_thrust', 'glute_bridge']),
    ex('calf', 'Mollets debout', 'Mollets', 'machine', true, false, ['seated_calf', 'press_calf']),
    ex('seated_calf', 'Mollets assis', 'Mollets', 'machine', true, false, ['calf', 'press_calf']),
    ex('press_calf', 'Mollets à la presse', 'Mollets', 'machine', true, false, ['calf', 'seated_calf']),
    ex('plank', 'Gainage', 'Abdos', 'poids du corps', false, false, ['side_plank', 'dead_bug'], { timed: true, increment: 0 }),
    ex('side_plank', 'Gainage latéral', 'Abdos', 'poids du corps', false, false, ['plank', 'dead_bug'], { timed: true, increment: 0 }),
    ex('dead_bug', 'Dead bug', 'Abdos', 'poids du corps', false, false, ['plank', 'side_plank'], { increment: 0 }),
    // Bras, pour aller plus loin
    ex('ez_curl', 'Curl barre EZ', 'Biceps', 'barre', false, false, ['barbell_curl', 'curl', 'cable_curl']),
    ex('hammer_curl', 'Curl marteau', 'Biceps', 'haltères', false, false, ['curl', 'cable_curl'], { increment: 1 }),
    ex('curl_21', 'Curl 21 (7 bas + 7 haut + 7 complets)', 'Biceps', 'barre', false, false, ['ez_curl', 'curl']),
    ex('diamond_pushup', 'Pompes diamant', 'Triceps', 'poids du corps', false, true, ['dips', 'triceps'], { increment: 0 }),
    // Abdos (en circuit, 40 s par exercice)
    ex('crunch', 'Crunch', 'Abdos', 'poids du corps', false, false, ['reverse_crunch'], { timed: true, increment: 0 }),
    ex('leg_raise', 'Relevé de jambes au sol', 'Abdos', 'poids du corps', false, false, ['hanging_leg_raise'], { timed: true, increment: 0 }),
    ex('hanging_leg_raise', 'Relevé de jambes suspendu', 'Abdos', 'poids du corps', false, false, ['leg_raise'], { timed: true, increment: 0 }),
    ex('russian_twist', 'Russian twist', 'Abdos', 'poids du corps', false, false, ['bicycle_crunch'], { timed: true, increment: 0 }),
    ex('mountain_climber', 'Mountain climbers', 'Abdos', 'poids du corps', false, false, ['plank'], { timed: true, increment: 0 }),
    ex('hollow_hold', 'Creux (hollow hold)', 'Abdos', 'poids du corps', false, false, ['dead_bug'], { timed: true, increment: 0 }),
    ex('commando_plank', 'Planche commando', 'Abdos', 'poids du corps', false, false, ['plank'], { timed: true, increment: 0 }),
    ex('bicycle_crunch', 'Crunch vélo', 'Abdos', 'poids du corps', false, false, ['crunch'], { timed: true, increment: 0 }),
    ex('ab_wheel', 'Roue abdominale', 'Abdos', 'poids du corps', false, false, ['plank'], { timed: true, increment: 0 }),
    ex('v_up', 'V-ups', 'Abdos', 'poids du corps', false, false, ['crunch'], { timed: true, increment: 0 }),
    ex('reverse_crunch', 'Crunch inversé', 'Abdos', 'poids du corps', false, false, ['leg_raise'], { timed: true, increment: 0 }),
    ex('flutter_kick', 'Battements de jambes', 'Abdos', 'poids du corps', false, false, ['scissor'], { timed: true, increment: 0 }),
    ex('scissor', 'Ciseaux', 'Abdos', 'poids du corps', false, false, ['flutter_kick'], { timed: true, increment: 0 }),
    ex('toe_touch', 'Crunch mains-pieds', 'Abdos', 'poids du corps', false, false, ['crunch'], { timed: true, increment: 0 }),
    ex('heel_touch', 'Touchers de talons', 'Abdos', 'poids du corps', false, false, ['russian_twist'], { timed: true, increment: 0 }),
    ex('plank_shoulder_tap', 'Planche, touche épaule', 'Abdos', 'poids du corps', false, false, ['plank'], { timed: true, increment: 0 }),
    ex('windshield', 'Essuie-glaces', 'Abdos', 'poids du corps', false, false, ['russian_twist'], { timed: true, increment: 0 }),
    ex('bear_hold', 'Position de l’ours', 'Abdos', 'poids du corps', false, false, ['plank'], { timed: true, increment: 0 }),
    ex('abs_circuit', 'Abdos · 10 min', 'Abdos', 'poids du corps', false, false, [], { timed: true, increment: 0, circuit: true }),
    // Pour compléter : les classiques de salle
    ex('pec_deck', 'Pec deck (butterfly)', 'Pectoraux', 'machine', false, false, ['cable_fly', 'db_fly']),
    ex('cable_fly', 'Écarté à la poulie', 'Pectoraux', 'poulie', false, false, ['pec_deck', 'db_fly'], { increment: 1.25 }),
    ex('db_fly', 'Écarté couché haltères', 'Pectoraux', 'haltères', false, false, ['pec_deck', 'cable_fly'], { increment: 1 }),
    ex('decline_bench', 'Développé décliné', 'Pectoraux', 'barre', false, true, ['dips', 'bench']),
    ex('pushup', 'Pompes', 'Pectoraux', 'poids du corps', false, true, ['bench', 'db_bench'], { increment: 0 }),
    ex('pullover', 'Pull-over', 'Dos', 'haltères', false, false, ['lat_pulldown', 'straight_arm'], { increment: 2 }),
    ex('straight_arm', 'Tirage bras tendus poulie', 'Dos', 'poulie', false, false, ['pullover', 'lat_pulldown']),
    ex('close_pulldown', 'Tirage vertical prise serrée', 'Dos', 'poulie', false, true, ['lat_pulldown', 'pullup']),
    ex('chest_row', 'Rowing poitrine appuyée', 'Dos', 'haltères', false, true, ['db_row', 'machine_row'], { increment: 2 }),
    ex('hyperext', 'Extensions lombaires', 'Dos', 'poids du corps', false, false, ['good_morning', 'rdl'], { increment: 0 }),
    ex('shrug', 'Shrugs (trapèzes)', 'Dos', 'haltères', false, false, ['row'], { increment: 2 }),
    ex('face_pull', 'Face pull', 'Épaules', 'poulie', false, false, ['reverse_fly', 'rear_delt_machine'], { increment: 1.25 }),
    ex('reverse_fly', 'Oiseau haltères', 'Épaules', 'haltères', false, false, ['face_pull', 'rear_delt_machine'], { increment: 1 }),
    ex('rear_delt_machine', 'Arrière d’épaule machine', 'Épaules', 'machine', false, false, ['reverse_fly', 'face_pull']),
    ex('front_raise', 'Élévations frontales', 'Épaules', 'haltères', false, false, ['lateral'], { increment: 1 }),
    ex('upright_row', 'Rowing menton', 'Épaules', 'barre', false, false, ['lateral', 'cable_lateral']),
    ex('arnold', 'Développé Arnold', 'Épaules', 'haltères', false, true, ['db_ohp', 'machine_shoulder'], { increment: 2 }),
    ex('preacher_curl', 'Curl pupitre', 'Biceps', 'barre', false, false, ['ez_curl', 'cable_curl']),
    ex('concentration_curl', 'Curl concentré', 'Biceps', 'haltères', false, false, ['curl', 'hammer_curl'], { increment: 1 }),
    ex('spider_curl', 'Curl spider', 'Biceps', 'haltères', false, false, ['incline_curl', 'preacher_curl'], { increment: 1 }),
    ex('rope_pushdown', 'Extension triceps corde', 'Triceps', 'poulie', false, false, ['triceps', 'overhead_triceps']),
    ex('db_triceps', 'Extension triceps haltère', 'Triceps', 'haltères', false, false, ['overhead_triceps', 'skullcrusher'], { increment: 1 }),
    ex('kickback', 'Kickback triceps', 'Triceps', 'haltères', false, false, ['triceps', 'db_triceps'], { increment: 1 }),
    ex('close_bench', 'Développé couché prise serrée', 'Triceps', 'barre', false, true, ['dips', 'skullcrusher']),
    ex('machine_dips', 'Dips machine', 'Triceps', 'machine', false, true, ['dips', 'triceps']),
    ex('front_squat', 'Squat avant', 'Quadriceps', 'barre', true, true, ['squat', 'hack_squat']),
    ex('smith_squat', 'Squat à la Smith machine', 'Quadriceps', 'machine', true, true, ['squat', 'hack_squat']),
    ex('lunge_front', 'Fentes avant', 'Quadriceps et fessiers', 'haltères', true, true, ['lunges', 'bulgarian'], { increment: 2 }),
    ex('sumo_deadlift', 'Soulevé de terre sumo', 'Dos et jambes', 'barre', true, true, ['deadlift', 'trap_bar']),
    ex('abductor', 'Abducteurs machine', 'Fessiers', 'machine', true, false, ['glute_machine', 'hip_thrust']),
    ex('adductor', 'Adducteurs machine', 'Quadriceps', 'machine', true, false, ['goblet_squat']),
    ex('cable_kickback', 'Kickback fessier poulie', 'Fessiers', 'poulie', true, false, ['glute_machine', 'hip_thrust'], { increment: 1.25 }),
    ex('crunch_machine', 'Crunch machine', 'Abdos', 'machine', false, false, ['crunch', 'cable_crunch']),
    ex('cable_crunch', 'Crunch à la poulie', 'Abdos', 'poulie', false, false, ['crunch_machine', 'crunch']),
  ].map((e) => [e.key, e])
);

export type Circuit = { keys: string[]; work: number; rest: number; rounds: number; number?: number };
export type PlannedExercise = {
  key: string;
  sets: number;
  min: number;
  max: number;
  rest: number;
  /** même lettre = superset : on enchaîne, repos après le dernier */
  group?: string;
  /** consigne en plus (dégressive…) */
  note?: string;
  circuit?: Circuit;
};
export type ProgramDay = { id: string; weekday: number; title: string; subtitle: string; exercises: PlannedExercise[] };
export type Program = {
  name: string;
  startDate: string;
  /** une semaine plus légère toutes les N semaines */
  deloadEvery: number;
  days: ProgramDay[];
  /** activités qui ne comptent pas comme séance (cours collectif…) */
  extras: { weekday: number; title: string }[];
  version?: number;
};

export function defaultRest(key: string) {
  const e = CATALOG[key];
  if (!e) return 90;
  if (['deadlift', 'trap_bar'].includes(key)) return 180;
  if (['squat', 'bench', 'rdl', 'ohp', 'row', 'incline_bench', 'hip_thrust'].includes(key)) return 150;
  if (e.compound) return 120;
  return 75;
}

const p = (key: string, sets: number, min: number, max: number, extra: Partial<PlannedExercise> = {}): PlannedExercise => ({
  key,
  sets,
  min,
  max,
  rest: defaultRest(key),
  ...extra,
});

/** Superset : deux exercices enchaînés, repos après le second */
const ss = (group: string, rest: number, a: PlannedExercise, b: PlannedExercise): PlannedExercise[] => [
  { ...a, group, rest },
  { ...b, group, rest },
];

export const ABS: Record<string, string[]> = {
  a: ['crunch', 'leg_raise', 'plank', 'russian_twist', 'mountain_climber'],
  b: ['side_plank', 'dead_bug', 'hollow_hold', 'commando_plank', 'side_plank'],
  c: ['hanging_leg_raise', 'bicycle_crunch', 'ab_wheel', 'v_up', 'plank'],
  d: ['mountain_climber', 'side_plank', 'russian_twist', 'reverse_crunch', 'plank'],
};

/** 12 circuits qui tournent : un différent à chaque séance, et la semaine suivante change tout */
export const ABS_POOL: string[][] = [
  ['crunch', 'leg_raise', 'plank', 'russian_twist', 'mountain_climber'],
  ['side_plank', 'dead_bug', 'hollow_hold', 'commando_plank', 'side_plank'],
  ['hanging_leg_raise', 'bicycle_crunch', 'ab_wheel', 'v_up', 'plank'],
  ['mountain_climber', 'side_plank', 'russian_twist', 'reverse_crunch', 'plank'],
  ['flutter_kick', 'toe_touch', 'plank_shoulder_tap', 'heel_touch', 'hollow_hold'],
  ['windshield', 'crunch', 'side_plank', 'scissor', 'bear_hold'],
  ['v_up', 'mountain_climber', 'dead_bug', 'bicycle_crunch', 'side_plank'],
  ['reverse_crunch', 'heel_touch', 'ab_wheel', 'flutter_kick', 'commando_plank'],
  ['hollow_hold', 'russian_twist', 'plank_shoulder_tap', 'leg_raise', 'side_plank'],
  ['toe_touch', 'windshield', 'bear_hold', 'scissor', 'plank'],
  ['hanging_leg_raise', 'side_plank', 'mountain_climber', 'heel_touch', 'hollow_hold'],
  ['bicycle_crunch', 'dead_bug', 'commando_plank', 'reverse_crunch', 'side_plank'],
];

/**
 * Circuit de la séance : il change chaque semaine, et le temps d'effort monte par paliers
 * (40/20 → 45/15 → 50/10), toujours 10 minutes. Semaine légère : 30/30.
 */
export function weeklyCircuit(base: Circuit, week: number, dayIndex: number, daysPerWeek: number, deload: boolean): Circuit & { number: number } {
  const n = ((week * Math.max(1, daysPerWeek) + dayIndex) % ABS_POOL.length + ABS_POOL.length) % ABS_POOL.length;
  const step = Math.floor((((week % 6) + 6) % 6) / 2);
  const [work, rest] = deload ? [30, 30] : ([[40, 20], [45, 15], [50, 10]] as const)[step];
  return { ...base, keys: ABS_POOL[n], work, rest, number: n + 1 };
}

export const abs = (keys: string[]): PlannedExercise => ({
  key: 'abs_circuit',
  sets: 2,
  min: 2,
  max: 2,
  rest: 0,
  circuit: { keys, work: 40, rest: 20, rounds: 2 },
});

export const PROGRAM_VERSION = 3;

/** v3 : épaules (côté et arrière) à la place d'une partie des bras, abdos les jours jambes */
const SHOULDERS_A = ss('C', 75, p('lateral', 3, 12, 15), p('face_pull', 3, 12, 15));
const SHOULDERS_B = p('face_pull', 3, 12, 15, { rest: 75 });

export function upperLowerProgram(startDate: string): Program {
  return {
    name: 'Haut / bas · 4 séances',
    startDate,
    deloadEvery: 7,
    version: PROGRAM_VERSION,
    days: [
      {
        id: 'haut-a',
        weekday: 1,
        title: 'Haut A',
        subtitle: 'force et bras',
        exercises: [
          p('bench', 4, 6, 8),
          p('row', 4, 6, 8),
          ...ss('A', 90, p('db_ohp', 3, 8, 10), p('pullup', 3, 8, 10)),
          ...ss('B', 75, p('ez_curl', 3, 8, 10), p('skullcrusher', 3, 8, 10)),
          ...SHOULDERS_A,
        ],
      },
      {
        id: 'bas-a',
        weekday: 3,
        title: 'Bas A',
        subtitle: 'force',
        exercises: [p('squat', 4, 6, 8), p('rdl', 3, 8, 10), p('leg_press', 3, 10, 12), ...ss('A', 75, p('leg_curl', 3, 10, 12), p('calf', 4, 12, 15)), abs(ABS.b)],
      },
      {
        id: 'haut-b',
        weekday: 4,
        title: 'Haut B',
        subtitle: 'volume et congestion',
        exercises: [
          p('incline_db', 4, 8, 12),
          p('lat_pulldown', 4, 10, 12),
          ...ss('A', 75, p('db_row', 3, 10, 12), p('lateral', 4, 12, 15)),
          ...ss('B', 75, p('incline_curl', 3, 10, 12), p('overhead_triceps', 3, 10, 12)),
          SHOULDERS_B,
        ],
      },
      {
        id: 'bas-b',
        weekday: 5,
        title: 'Bas B',
        subtitle: 'volume et bonus bras',
        exercises: [
          p('deadlift', 3, 5, 5),
          p('bulgarian', 3, 8, 10, { note: 'Charge par haltère, toutes les reps d’une jambe puis l’autre.' }),
          ...ss('A', 75, p('leg_ext', 3, 12, 15), p('leg_curl', 3, 12, 15)),
          p('seated_calf', 3, 15, 15),
          ...ss('B', 75, p('hammer_curl', 3, 12, 12), p('dips', 3, 8, 12)),
          abs(ABS.d),
        ],
      },
    ],
    extras: [{ weekday: 2, title: 'Cours cardio collectif, le soir' }],
  };
}

export function fullBodyProgram(startDate: string): Program {
  return {
    name: 'Full body · 3 séances',
    startDate,
    deloadEvery: 7,
    version: PROGRAM_VERSION,
    days: [
      {
        id: 'fb-a',
        weekday: 1,
        title: 'Full body A',
        subtitle: '',
        exercises: [p('squat', 3, 8, 10), ...ss('A', 90, p('db_bench', 3, 8, 12), p('lat_pulldown', 3, 10, 12)), p('hip_thrust', 3, 10, 12), abs(ABS.a)],
      },
      {
        id: 'fb-b',
        weekday: 3,
        title: 'Full body B',
        subtitle: '',
        exercises: [p('rdl', 3, 8, 10), ...ss('A', 90, p('db_ohp', 3, 8, 12), p('db_row', 3, 10, 12)), p('bulgarian', 3, 8, 10), p('lateral', 3, 12, 15), abs(ABS.b)],
      },
      {
        id: 'fb-c',
        weekday: 5,
        title: 'Full body C',
        subtitle: '',
        exercises: [p('leg_press', 3, 10, 12), ...ss('A', 90, p('incline_db', 3, 8, 12), p('cable_row', 3, 10, 12)), ...ss('B', 60, p('leg_curl', 3, 10, 12), p('calf', 3, 12, 15)), abs(ABS.d)],
      },
    ],
    extras: [],
  };
}

/** L'ancien programme type, jamais modifié : on peut le remplacer par la nouvelle version */
const OLD_SIGNATURES = [
  'haut-a:bench,row,ohp,pullup,curl,triceps|bas-a:squat,rdl,leg_press,leg_curl,calf|haut-b:incline_db,lat_pulldown,db_row,lateral,incline_curl,overhead_triceps|bas-b:deadlift,bulgarian,leg_ext,leg_curl,plank',
  'fb-a:squat,db_bench,lat_pulldown,hip_thrust,plank|fb-b:rdl,db_ohp,db_row,bulgarian,lateral|fb-c:leg_press,incline_db,cable_row,leg_curl,calf',
];

/**
 * v2 → v3, séance par séance (on garde les exercices changés à la main) :
 * Haut A perd curl marteau + extension poulie et gagne latérales + face pull,
 * Haut B perd curl 21 + pompes diamant et gagne face pull, les supersets de bras passent à 3 séries,
 * les abdos restent seulement les jours jambes.
 */
function toV3(prog: Program): Program {
  const days = prog.days.map((d) => {
    if (d.id !== 'haut-a' && d.id !== 'haut-b') return d;
    const drop = d.id === 'haut-a' ? ['hammer_curl', 'triceps'] : ['curl_21', 'diamond_pushup'];
    const trim = d.id === 'haut-a' ? ['ez_curl', 'skullcrusher'] : ['incline_curl', 'overhead_triceps'];
    let exercises = d.exercises
      .filter((e) => !e.circuit && !(e.group === 'C' && drop.includes(e.key)))
      .map((e) => (trim.includes(e.key) && e.sets === 4 ? { ...e, sets: 3 } : e));
    const has = (k: string) => exercises.some((e) => e.key === k);
    if (d.id === 'haut-a' && !has('face_pull')) {
      const letter = ['C', 'D', 'E', 'F', 'G'].find((g) => !exercises.some((e) => e.group === g)) ?? 'Z';
      exercises = has('lateral') ? [...exercises, { ...SHOULDERS_B }] : [...exercises, ...SHOULDERS_A.map((e) => ({ ...e, group: letter }))];
    }
    if (d.id === 'haut-b' && !has('face_pull')) exercises = [...exercises, { ...SHOULDERS_B }];
    return { ...d, exercises };
  });
  return { ...prog, days, version: PROGRAM_VERSION };
}

export function upgradedProgram(prog: Program): Program | null {
  if ((prog.version ?? 1) >= PROGRAM_VERSION) return null;
  if (prog.version === 2) {
    const next = toV3(prog);
    return JSON.stringify(next.days) === JSON.stringify(prog.days) ? null : next;
  }
  const sig = prog.days.map((d) => d.id + ':' + d.exercises.map((e) => e.key).join(',')).join('|');
  const i = OLD_SIGNATURES.indexOf(sig);
  if (i < 0) return null;
  const next = i === 0 ? upperLowerProgram(prog.startDate) : fullBodyProgram(prog.startDate);
  // garder les jours choisis par l'utilisateur
  next.days = next.days.map((d) => ({ ...d, weekday: prog.days.find((o) => o.id === d.id)?.weekday ?? d.weekday }));
  next.deloadEvery = prog.deloadEvery;
  next.extras = prog.extras;
  return next;
}

/** Jours conseillés selon le nombre de séances (1 = lundi) */
export const DEFAULT_DAYS: Record<number, number[]> = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 3, 4, 5], 5: [1, 2, 3, 4, 5] };

/**
 * Programme selon le nombre de séances par semaine et les jours choisis :
 * 2 ou 3 séances → full body, 4 → haut / bas, 5 → haut / bas + un full body.
 */
export function programFor(count: number, weekdays: number[], startDate: string, keepExtras: Program['extras'] = []): Program {
  const days = [...weekdays].sort((a, b) => a - b);
  const fb = fullBodyProgram(startDate);
  const ul = upperLowerProgram(startDate);
  let list: ProgramDay[];
  let name: string;
  if (count <= 3) {
    list = fb.days.slice(0, Math.max(2, count));
    name = `Full body · ${list.length} séances`;
  } else if (count === 4) {
    list = ul.days;
    name = 'Haut / bas · 4 séances';
  } else {
    list = [...ul.days, { ...fb.days[0], id: 'fb-bonus', title: 'Full body', subtitle: 'bonus' }];
    name = 'Haut / bas + full body · 5 séances';
  }
  return {
    name,
    startDate,
    deloadEvery: 7,
    version: PROGRAM_VERSION,
    days: list.map((d, i) => ({ ...structuredClone(d), weekday: days[i] ?? d.weekday })),
    extras: keepExtras.filter((x) => !days.includes(x.weekday)),
  };
}

export function emptyProgram(startDate: string): Program {
  return { name: 'Mon programme', startDate, deloadEvery: 7, days: [], extras: [] };
}

export function exName(key: string) {
  return CATALOG[key]?.name ?? key;
}

// ---------------- Exercices perso ----------------
export const MUSCLES = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Abdos'] as const;
export const EQUIPMENTS: Equipment[] = ['barre', 'haltères', 'machine', 'poulie', 'poids du corps'];
export type CustomExercise = { name: string; muscle: string; equipment: Equipment; timed?: boolean };

/** Ajoute au catalogue les exercices créés par l'utilisateur */
export function loadCustomExercises() {
  for (const d of allOf<CustomExercise>('customex')) {
    const c = d.data;
    const key = d.id.replace('customex:', 'perso_');
    if (CATALOG[key]?.name === c.name && CATALOG[key]?.muscle === c.muscle && CATALOG[key]?.equipment === c.equipment) continue;
    const lower = ['Quadriceps', 'Ischios', 'Fessiers', 'Mollets'].includes(c.muscle);
    CATALOG[key] = ex(key, c.name, c.muscle, c.equipment, lower, c.equipment === 'barre', [], {
      timed: c.timed || undefined,
      increment: c.timed || c.equipment === 'poids du corps' ? 0 : c.equipment === 'haltères' ? (lower ? 2 : 1) : lower ? 5 : 2.5,
      custom: true,
    });
  }
}

export async function createCustomExercise(c: CustomExercise) {
  const id = uid();
  await putDoc('customex:' + id, 'customex', c);
  loadCustomExercises();
  return 'perso_' + id;
}

/** Durée estimée d'une séance, en minutes (échauffement compris) */
export function estimateMinutes(day: ProgramDay) {
  let s = 300;
  const done = new Set<number>();
  day.exercises.forEach((e, i) => {
    if (done.has(i)) return;
    if (e.circuit) {
      s += e.circuit.rounds * e.circuit.keys.length * (e.circuit.work + e.circuit.rest);
      done.add(i);
      return;
    }
    const members = e.group ? day.exercises.map((x, k) => [x, k] as const).filter(([x]) => x.group === e.group) : ([[e, i]] as const);
    let perRound = 0;
    let rounds = 0;
    for (const [m, k] of members) {
      done.add(k);
      perRound += CATALOG[m.key]?.timed ? m.max : 40;
      rounds = Math.max(rounds, m.sets);
    }
    s += rounds * (perRound + e.rest) + 60;
  });
  return Math.round(s / 60 / 5) * 5;
}

/** Calcul des disques à mettre de chaque côté de la barre */
export function platesFor(total: number, bar = 20, available = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  let side = (total - bar) / 2;
  if (side < 0) return { plates: [] as number[], rest: 0, ok: false };
  const plates: number[] = [];
  for (const p of available) {
    while (side >= p - 1e-9) {
      plates.push(p);
      side -= p;
    }
  }
  return { plates, rest: Math.round(side * 100) / 100, ok: side < 0.01 };
}
