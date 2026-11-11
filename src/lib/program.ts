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
  /** un côté puis l'autre (reps ou temps par côté) */
  perSide?: boolean;
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
    ex('db_row', 'Rowing haltère', 'Dos', 'haltères', false, true, ['cable_row', 'row', 'machine_row'], { perSide: true }),
    ex('cable_row', 'Rowing assis poulie', 'Dos', 'poulie', false, true, ['db_row', 'machine_row']),
    ex('machine_row', 'Rowing machine', 'Dos', 'machine', false, true, ['cable_row', 'db_row']),
    ex('pullup', 'Tractions', 'Dos', 'poids du corps', false, true, ['lat_pulldown', 'assisted_pullup'], { increment: 0 }),
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
    ex('dips', 'Dips', 'Triceps', 'poids du corps', false, true, ['triceps', 'skullcrusher'], { increment: 0 }),
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
    ex('bulgarian', 'Fentes bulgares', 'Quadriceps et fessiers', 'haltères', true, true, ['lunges', 'step_up'], { increment: 2, perSide: true }),
    ex('lunges', 'Fentes marchées', 'Quadriceps et fessiers', 'haltères', true, true, ['bulgarian', 'step_up'], { increment: 2 }),
    ex('step_up', 'Step-up', 'Quadriceps et fessiers', 'haltères', true, true, ['bulgarian', 'lunges'], { increment: 2, perSide: true }),
    ex('hip_thrust', 'Hip thrust', 'Fessiers', 'barre', true, true, ['glute_bridge', 'glute_machine']),
    ex('glute_bridge', 'Pont fessier', 'Fessiers', 'barre', true, true, ['hip_thrust', 'glute_machine']),
    ex('glute_machine', 'Fessiers machine', 'Fessiers', 'machine', true, false, ['hip_thrust', 'glute_bridge']),
    ex('calf', 'Mollets debout', 'Mollets', 'machine', true, false, ['seated_calf', 'press_calf']),
    ex('seated_calf', 'Mollets assis', 'Mollets', 'machine', true, false, ['calf', 'press_calf']),
    ex('press_calf', 'Mollets à la presse', 'Mollets', 'machine', true, false, ['calf', 'seated_calf']),
    ex('plank', 'Gainage', 'Abdos', 'poids du corps', false, false, ['side_plank', 'dead_bug'], { timed: true, increment: 0 }),
    ex('side_plank', 'Gainage latéral', 'Abdos', 'poids du corps', false, false, ['plank', 'dead_bug'], { timed: true, increment: 0, perSide: true }),
    ex('side_plank_l', 'Gainage latéral, côté gauche', 'Abdos', 'poids du corps', false, false, ['plank'], { timed: true, increment: 0 }),
    ex('side_plank_r', 'Gainage latéral, côté droit', 'Abdos', 'poids du corps', false, false, ['plank'], { timed: true, increment: 0 }),
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
    // échauffement de début de séance (cachés dans la liste des exercices)
    ex('warmup', 'Échauffement', 'Échauffement', 'poids du corps', false, false, [], { timed: true, increment: 0, circuit: true }),
    ...([
      ['wu_jacks', 'Jumping jacks'],
      ['wu_knees', 'Montées de genoux'],
      ['wu_arm_circles', 'Cercles de bras'],
      ['wu_thoracic', 'Rotations du dos à 4 pattes'],
      ['wu_ytw', 'Y-T-W allongé'],
      ['wu_scap_pushup', 'Pompes scapulaires'],
      ['wu_pushup', 'Pompes lentes'],
      ['wu_inchworm', 'Marche des mains'],
      ['wu_leg_swings', 'Balancés de jambes'],
      ['wu_hip_circles', 'Cercles de hanches'],
      ['wu_good_morning', 'Good mornings à vide'],
      ['wu_squat', 'Squats au poids du corps'],
      ['wu_bridge', 'Ponts fessiers'],
      ['wu_lunge_rot', 'Fentes avec rotation'],
      ['wu_ankle', 'Mobilité des chevilles'],
    ] as const).map(([k, n]) => ex(k, n, 'Échauffement', 'poids du corps', false, false, [], { timed: true, increment: 0, circuit: true })),
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
    ex('concentration_curl', 'Curl concentré', 'Biceps', 'haltères', false, false, ['curl', 'hammer_curl'], { increment: 1, perSide: true }),
    ex('spider_curl', 'Curl spider', 'Biceps', 'haltères', false, false, ['incline_curl', 'preacher_curl'], { increment: 1 }),
    ex('rope_pushdown', 'Extension triceps corde', 'Triceps', 'poulie', false, false, ['triceps', 'overhead_triceps']),
    ex('db_triceps', 'Extension triceps haltère', 'Triceps', 'haltères', false, false, ['overhead_triceps', 'skullcrusher'], { increment: 1 }),
    ex('kickback', 'Kickback triceps', 'Triceps', 'haltères', false, false, ['triceps', 'db_triceps'], { increment: 1, perSide: true }),
    ex('close_bench', 'Développé couché prise serrée', 'Triceps', 'barre', false, true, ['dips', 'skullcrusher']),
    ex('machine_dips', 'Dips machine', 'Triceps', 'machine', false, true, ['dips', 'triceps']),
    ex('front_squat', 'Squat avant', 'Quadriceps', 'barre', true, true, ['squat', 'hack_squat']),
    ex('smith_squat', 'Squat à la Smith machine', 'Quadriceps', 'machine', true, true, ['squat', 'hack_squat']),
    ex('lunge_front', 'Fentes avant', 'Quadriceps et fessiers', 'haltères', true, true, ['lunges', 'bulgarian'], { increment: 2 }),
    ex('sumo_deadlift', 'Soulevé de terre sumo', 'Dos et jambes', 'barre', true, true, ['deadlift', 'trap_bar']),
    ex('abductor', 'Abducteurs machine', 'Fessiers', 'machine', true, false, ['glute_machine', 'hip_thrust']),
    ex('adductor', 'Adducteurs machine', 'Quadriceps', 'machine', true, false, ['goblet_squat']),
    ex('cable_kickback', 'Kickback fessier poulie', 'Fessiers', 'poulie', true, false, ['glute_machine', 'hip_thrust'], { increment: 1.25, perSide: true }),
    ex('crunch_machine', 'Crunch machine', 'Abdos', 'machine', false, false, ['crunch', 'cable_crunch']),
    ex('cable_crunch', 'Crunch à la poulie', 'Abdos', 'poulie', false, false, ['crunch_machine', 'crunch']),
  ].map((e) => [e.key, e])
);

export type Circuit = { keys: string[]; work: number; rest: number; rounds: number; number?: number };

/** Comment faire chaque mouvement d'échauffement (affiché pendant le minuteur) */
export const WARMUP_CUES: Record<string, string> = {
  wu_jacks: 'Léger et régulier : on fait monter le cœur.',
  wu_knees: 'Sur place, genoux à hauteur de hanches, bras qui suivent.',
  wu_arm_circles: 'Petits puis grands cercles, en avant puis en arrière.',
  wu_thoracic: 'À 4 pattes, une main derrière la tête : ouvre le coude vers le plafond. 20 s par côté.',
  wu_ytw: 'À plat ventre, bras en Y, en T puis en W : serre les omoplates à chaque fois.',
  wu_scap_pushup: 'En planche, bras tendus : rapproche puis écarte les omoplates, sans plier les coudes.',
  wu_pushup: 'Lentes et contrôlées, sur les genoux si besoin. Pas jusqu’à la fatigue.',
  wu_inchworm: 'Debout, mains au sol, marche avec les mains jusqu’à la planche, puis reviens.',
  wu_leg_swings: 'Une main au mur : avant-arrière puis de côté. 20 s par jambe.',
  wu_hip_circles: 'Mains sur les hanches, grands cercles dans les deux sens.',
  wu_good_morning: 'Mains derrière la tête, dos plat : penche-toi en poussant les fesses en arrière.',
  wu_squat: 'Lents, en descendant le plus bas possible, talons au sol.',
  wu_bridge: 'Sur le dos, pousse dans les talons et serre les fessiers en haut.',
  wu_lunge_rot: 'Grande fente avant, puis tourne le buste du côté de la jambe avant. En alternant.',
  wu_ankle: 'Genou vers l’avant au-dessus des orteils, talon au sol. 20 s par cheville.',
};

/**
 * Échauffement de 5 minutes adapté à la séance : 6 mouvements de 40 s.
 * Jambes → hanches, fessiers, chevilles ; haut du corps → épaules, omoplates, dos ; mélange → un peu des deux.
 */
export function warmupFor(exercises: PlannedExercise[]): Circuit {
  const defs = exercises.filter((e) => !e.circuit).map((e) => CATALOG[e.key]).filter(Boolean);
  const lower = defs.filter((d) => d.lower).length;
  const upper = defs.length - lower;
  const has = (re: RegExp) => defs.some((d) => re.test(d.muscle));
  const hinge = defs.some((d) => /deadlift|rdl|good_morning|hip_thrust|glute/.test(d.key));
  const squat = defs.some((d) => /squat|leg_press|lunge|bulgarian|step_up/.test(d.key));
  let keys: string[];
  if (lower >= upper * 2) keys = ['wu_jacks', 'wu_leg_swings', hinge ? 'wu_good_morning' : 'wu_hip_circles', squat ? 'wu_ankle' : 'wu_hip_circles', 'wu_bridge', squat ? 'wu_squat' : 'wu_lunge_rot'];
  else if (upper >= lower * 2) keys = ['wu_jacks', 'wu_arm_circles', 'wu_thoracic', has(/Dos|Biceps/) ? 'wu_ytw' : 'wu_inchworm', 'wu_scap_pushup', has(/Pectoraux|Triceps|Épaules/) ? 'wu_pushup' : 'wu_ytw'];
  else keys = ['wu_jacks', 'wu_arm_circles', 'wu_leg_swings', 'wu_ytw', 'wu_squat', 'wu_lunge_rot'];
  const uniq = [...new Set(keys)];
  for (const k of ['wu_knees', 'wu_inchworm', 'wu_lunge_rot', 'wu_hip_circles']) if (uniq.length < 6 && !uniq.includes(k)) uniq.push(k);
  return { keys: uniq, work: 40, rest: 8, rounds: 1 };
}
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
  /** programme type femme */
  audience?: 'f';
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
  b: ['side_plank_l', 'side_plank_r', 'dead_bug', 'hollow_hold', 'commando_plank'],
  c: ['hanging_leg_raise', 'bicycle_crunch', 'ab_wheel', 'v_up', 'plank'],
  d: ['mountain_climber', 'side_plank_l', 'side_plank_r', 'russian_twist', 'reverse_crunch'],
};

/** 12 circuits qui tournent : un différent à chaque séance, et la semaine suivante change tout */
export const ABS_POOL: string[][] = [
  ['crunch', 'leg_raise', 'plank', 'russian_twist', 'mountain_climber'],
  ['side_plank_l', 'side_plank_r', 'dead_bug', 'hollow_hold', 'commando_plank'],
  ['hanging_leg_raise', 'bicycle_crunch', 'ab_wheel', 'v_up', 'plank'],
  ['mountain_climber', 'side_plank_l', 'side_plank_r', 'russian_twist', 'reverse_crunch'],
  ['flutter_kick', 'toe_touch', 'plank_shoulder_tap', 'heel_touch', 'hollow_hold'],
  ['windshield', 'crunch', 'side_plank_l', 'side_plank_r', 'scissor'],
  ['v_up', 'mountain_climber', 'bicycle_crunch', 'side_plank_l', 'side_plank_r'],
  ['reverse_crunch', 'heel_touch', 'ab_wheel', 'flutter_kick', 'commando_plank'],
  ['hollow_hold', 'russian_twist', 'leg_raise', 'side_plank_l', 'side_plank_r'],
  ['toe_touch', 'windshield', 'bear_hold', 'scissor', 'plank'],
  ['hanging_leg_raise', 'side_plank_l', 'side_plank_r', 'mountain_climber', 'hollow_hold'],
  ['bicycle_crunch', 'dead_bug', 'reverse_crunch', 'side_plank_l', 'side_plank_r'],
];

/**
 * Circuit de la séance : il change chaque semaine, et le temps d'effort monte par paliers
 * (40/20 → 45/15 → 50/10), toujours 10 minutes. Semaine légère : 30/30.
 */
export function weeklyCircuit(base: Circuit, week: number, dayIndex: number, daysPerWeek: number, deload: boolean, shortRest = false): Circuit & { number: number } {
  const n = ((week * Math.max(1, daysPerWeek) + dayIndex) % ABS_POOL.length + ABS_POOL.length) % ABS_POOL.length;
  const step = Math.floor((((week % 6) + 6) % 6) / 2);
  // repos court (10 s) : l'effort monte toutes les 2 semaines, le repos reste à 10 s
  const [work, rest] = shortRest
    ? deload
      ? [30, 10]
      : ([[40, 10], [45, 10], [50, 10]] as const)[step]
    : deload
      ? [30, 30]
      : ([[40, 20], [45, 15], [50, 10]] as const)[step];
  return { ...base, keys: ABS_POOL[n], work, rest, number: n + 1 };
}

export const abs = (keys: string[]): PlannedExercise => ({
  key: 'abs_circuit',
  sets: 2,
  min: 2,
  max: 2,
  rest: 0,
  circuit: { keys, work: 40, rest: 10, rounds: 2 },
});

/** Exercice au poids du corps (tractions, dips, pompes…) : charge 0 = sans lest */
export const isBodyweight = (key: string) => CATALOG[key]?.equipment === 'poids du corps' && !CATALOG[key]?.timed && !CATALOG[key]?.circuit;

export const PROGRAM_VERSION = 4;

/** v4 : épaules (côté et arrière) à la place d'une partie des bras ; abdos et curl 21 + pompes diamant gardés */
const SHOULDERS_A = ss('C', 75, p('lateral', 3, 12, 15), p('face_pull', 3, 12, 15));
const SHOULDERS_B = p('face_pull', 3, 12, 15, { rest: 75 });
const FINISHER_B = ss('C', 60, p('curl_21', 2, 21, 21), p('diamond_pushup', 2, 8, 20, { note: 'Au maximum de reps, en gardant les coudes serrés.' }));

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
          abs(ABS.a),
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
          SHOULDERS_B,
          ...ss('B', 75, p('incline_curl', 3, 10, 12), p('overhead_triceps', 3, 10, 12)),
          ...FINISHER_B,
          abs(ABS.c),
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
 * v2 ou v3 → v4, séance par séance (on garde les exercices changés à la main) :
 * Haut A : curl marteau + extension poulie remplacés par latérales + face pull, bras à 3 séries.
 * Haut B : face pull en plus, bras à 3 séries, curl 21 + pompes diamant gardés.
 * Abdos à chaque séance (la v3 les avait retirés des séances du haut : on les remet).
 */
function toV4(prog: Program): Program {
  const fromV2 = prog.version === 2;
  const days = prog.days.map((d) => {
    if (d.id !== 'haut-a' && d.id !== 'haut-b') return d;
    const a = d.id === 'haut-a';
    const trim = a ? ['ez_curl', 'skullcrusher'] : ['incline_curl', 'overhead_triceps'];
    let list = d.exercises
      .filter((e) => !(fromV2 && a && e.group === 'C' && ['hammer_curl', 'triceps'].includes(e.key)))
      .map((e) => (fromV2 && trim.includes(e.key) && e.sets === 4 ? { ...e, sets: 3 } : e));
    const circuit = list.filter((e) => e.circuit);
    list = list.filter((e) => !e.circuit);
    const has = (k: string) => list.some((e) => e.key === k);
    const free = () => ['C', 'D', 'E', 'F', 'G'].find((g) => !list.some((e) => e.group === g)) ?? 'Z';
    if (a && !has('face_pull')) {
      const g = free();
      list = has('lateral') ? [...list, { ...SHOULDERS_B }] : [...list, ...SHOULDERS_A.map((e) => ({ ...e, group: g }))];
    }
    if (!a) {
      if (!has('face_pull')) {
        const at = list.findIndex((e) => e.key === 'incline_curl' || e.group === 'B');
        list = at < 0 ? [...list, { ...SHOULDERS_B }] : [...list.slice(0, at), { ...SHOULDERS_B }, ...list.slice(at)];
      }
      if (!has('curl_21') && !has('diamond_pushup')) {
        const g = free();
        list = [...list, ...FINISHER_B.map((e) => ({ ...e, group: g }))];
      }
    }
    return { ...d, exercises: [...list, ...(circuit.length ? circuit : [abs(a ? ABS.a : ABS.c)])] };
  });
  return { ...prog, days, version: PROGRAM_VERSION };
}

export function upgradedProgram(prog: Program): Program | null {
  if ((prog.version ?? 1) >= PROGRAM_VERSION) return null;
  if (prog.version === 2 || prog.version === 3) {
    const next = toV4(prog);
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

// ---------------- Programme femme ----------------
// Fessiers et jambes en priorité, haut du corps tonique sans gros volume de bras,
// machines et haltères plutôt que barre lourde, 10 à 15 reps, supersets pour garder des séances courtes,
// gainage à chaque séance. Jamais de bras les jours jambes.
const w = (key: string, sets: number, min: number, max: number, rest: number, extra: Partial<PlannedExercise> = {}): PlannedExercise => ({ key, sets, min, max, rest, ...extra });

const W_DAYS: Record<string, ProgramDay> = {
  'f-bas-a': {
    id: 'f-bas-a',
    weekday: 1,
    title: 'Bas A',
    subtitle: 'fessiers et cuisses',
    exercises: [
      w('hip_thrust', 4, 8, 12, 120),
      w('leg_press', 3, 10, 12, 105),
      w('lunges', 3, 10, 12, 90, { note: 'Haltères en main, en alternant : 10 à 12 pas par jambe.' }),
      ...ss('A', 60, w('leg_ext', 3, 12, 15, 60), w('abductor', 3, 15, 20, 60)),
      abs(ABS.a),
    ],
  },
  'f-haut-a': {
    id: 'f-haut-a',
    weekday: 3,
    title: 'Haut A',
    subtitle: 'dos et épaules',
    exercises: [
      w('lat_pulldown', 3, 10, 12, 90),
      w('db_bench', 3, 10, 12, 90),
      ...ss('A', 75, w('cable_row', 3, 10, 12, 75), w('db_ohp', 3, 10, 12, 75)),
      ...ss('B', 60, w('lateral', 3, 12, 15, 60), w('face_pull', 3, 12, 15, 60)),
      abs(ABS.b),
    ],
  },
  'f-bas-b': {
    id: 'f-bas-b',
    weekday: 4,
    title: 'Bas B',
    subtitle: 'ischios et fessiers',
    exercises: [
      w('db_rdl', 3, 10, 12, 105),
      w('goblet_squat', 3, 12, 15, 90),
      ...ss('A', 60, w('seated_leg_curl', 3, 12, 15, 60), w('cable_kickback', 3, 12, 15, 60)),
      w('glute_bridge', 2, 15, 20, 60, { note: 'Barre ou haltère sur les hanches, serre les fessiers 1 s en haut.' }),
      abs(ABS.c),
    ],
  },
  'f-haut-b': {
    id: 'f-haut-b',
    weekday: 5,
    title: 'Haut B',
    subtitle: 'dos, poitrine et gainage',
    exercises: [
      w('assisted_pullup', 3, 8, 12, 90),
      ...ss('A', 75, w('chest_press', 3, 10, 12, 75), w('db_row', 3, 10, 12, 75)),
      ...ss('B', 60, w('cable_lateral', 3, 12, 15, 60), w('reverse_fly', 3, 12, 15, 60)),
      ...ss('C', 60, w('curl', 2, 12, 15, 60), w('rope_pushdown', 2, 12, 15, 60)),
      abs(ABS.d),
    ],
  },
  'f-fb-a': {
    id: 'f-fb-a',
    weekday: 1,
    title: 'Full body A',
    subtitle: 'fessiers et dos',
    exercises: [
      w('hip_thrust', 3, 10, 12, 120),
      w('leg_press', 3, 10, 12, 105),
      ...ss('A', 75, w('lat_pulldown', 3, 10, 12, 75), w('db_bench', 3, 10, 12, 75)),
      abs(ABS.a),
    ],
  },
  'f-fb-b': {
    id: 'f-fb-b',
    weekday: 3,
    title: 'Full body B',
    subtitle: 'ischios et épaules',
    exercises: [
      w('db_rdl', 3, 10, 12, 105),
      w('lunges', 3, 10, 12, 90, { note: 'Haltères en main, en alternant : 10 à 12 pas par jambe.' }),
      ...ss('A', 75, w('cable_row', 3, 10, 12, 75), w('db_ohp', 3, 10, 12, 75)),
      abs(ABS.b),
    ],
  },
  'f-fb-c': {
    id: 'f-fb-c',
    weekday: 5,
    title: 'Full body C',
    subtitle: 'cuisses et haut du corps',
    exercises: [
      w('goblet_squat', 3, 12, 15, 90),
      ...ss('A', 60, w('seated_leg_curl', 3, 12, 15, 60), w('abductor', 3, 15, 20, 60)),
      ...ss('B', 60, w('chest_press', 3, 10, 12, 60), w('face_pull', 3, 12, 15, 60)),
      abs(ABS.c),
    ],
  },
};

export function womenProgramFor(count: number, weekdays: number[], startDate: string, keepExtras: Program['extras'] = []): Program {
  const days = [...weekdays].sort((a, b) => a - b);
  const ids =
    count <= 3
      ? ['f-fb-a', 'f-fb-b', 'f-fb-c'].slice(0, Math.max(2, count))
      : count === 4
        ? ['f-bas-a', 'f-haut-a', 'f-bas-b', 'f-haut-b']
        : ['f-bas-a', 'f-haut-a', 'f-bas-b', 'f-haut-b', 'f-fb-c'];
  const name = count <= 3 ? `Full body · ${ids.length} séances` : count === 4 ? 'Bas / haut · 4 séances' : 'Bas / haut + full body · 5 séances';
  return {
    name,
    startDate,
    deloadEvery: 7,
    version: PROGRAM_VERSION,
    audience: 'f',
    days: ids.map((id, i) => ({ ...structuredClone(W_DAYS[id]), id: i === 4 ? 'f-bonus' : id, subtitle: i === 4 ? 'bonus' : W_DAYS[id].subtitle, weekday: days[i] ?? W_DAYS[id].weekday })),
    extras: keepExtras.filter((x) => !days.includes(x.weekday)),
  };
}

const MEN_STOCK_IDS = new Set(['haut-a', 'bas-a', 'haut-b', 'bas-b', 'fb-a', 'fb-b', 'fb-c', 'fb-bonus']);

/** Une femme avec le programme type homme : on le remplace par le sien (mêmes jours) */
export function womenSwap(prog: Program, sex?: string): Program | null {
  if (sex !== 'f' || prog.audience === 'f' || !prog.days.length || !prog.days.every((d) => MEN_STOCK_IDS.has(d.id))) return null;
  const next = womenProgramFor(Math.min(5, prog.days.length), prog.days.map((d) => d.weekday), prog.startDate, prog.extras);
  next.deloadEvery = prog.deloadEvery;
  return next;
}

/**
 * Programme selon le nombre de séances par semaine et les jours choisis :
 * 2 ou 3 séances → full body, 4 → haut / bas, 5 → haut / bas + un full body.
 * Pour une femme : programme à part (fessiers et jambes, pas de bras les jours jambes).
 */
export function programFor(count: number, weekdays: number[], startDate: string, keepExtras: Program['extras'] = [], sex?: string): Program {
  if (sex === 'f') return womenProgramFor(count, weekdays, startDate, keepExtras);
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
