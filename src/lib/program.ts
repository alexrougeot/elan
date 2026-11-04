// Catalogue d'exercices et programmes types.

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
  /** progression de charge quand la fourchette est validée */
  increment: number;
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
  ].map((e) => [e.key, e])
);

export type PlannedExercise = { key: string; sets: number; min: number; max: number; rest: number };
export type ProgramDay = { id: string; weekday: number; title: string; subtitle: string; exercises: PlannedExercise[] };
export type Program = {
  name: string;
  startDate: string;
  /** une semaine plus légère toutes les N semaines */
  deloadEvery: number;
  days: ProgramDay[];
  /** activités qui ne comptent pas comme séance (cours collectif…) */
  extras: { weekday: number; title: string }[];
};

export function defaultRest(key: string) {
  const e = CATALOG[key];
  if (!e) return 90;
  if (['squat', 'bench', 'deadlift', 'rdl', 'ohp', 'row', 'trap_bar', 'incline_bench', 'hip_thrust'].includes(key)) return 150;
  if (e.compound) return 120;
  return 75;
}

const p = (key: string, sets: number, min: number, max: number): PlannedExercise => ({
  key,
  sets,
  min,
  max,
  rest: defaultRest(key),
});

export function upperLowerProgram(startDate: string): Program {
  return {
    name: 'Haut / bas · 4 séances',
    startDate,
    deloadEvery: 7,
    days: [
      {
        id: 'haut-a',
        weekday: 1,
        title: 'Haut A',
        subtitle: 'lourd',
        exercises: [p('bench', 4, 6, 8), p('row', 4, 6, 8), p('ohp', 3, 8, 10), p('pullup', 3, 8, 10), p('curl', 2, 10, 12), p('triceps', 2, 10, 12)],
      },
      {
        id: 'bas-a',
        weekday: 3,
        title: 'Bas A',
        subtitle: 'lourd',
        exercises: [p('squat', 4, 6, 8), p('rdl', 3, 8, 10), p('leg_press', 3, 10, 12), p('leg_curl', 3, 10, 12), p('calf', 3, 12, 15)],
      },
      {
        id: 'haut-b',
        weekday: 4,
        title: 'Haut B',
        subtitle: 'volume',
        exercises: [
          p('incline_db', 3, 8, 12),
          p('lat_pulldown', 3, 10, 12),
          p('db_row', 3, 10, 12),
          p('lateral', 3, 12, 15),
          p('incline_curl', 3, 10, 12),
          p('overhead_triceps', 3, 10, 12),
        ],
      },
      {
        id: 'bas-b',
        weekday: 5,
        title: 'Bas B',
        subtitle: 'volume',
        exercises: [p('deadlift', 3, 5, 5), p('bulgarian', 3, 8, 10), p('leg_ext', 3, 12, 15), p('leg_curl', 3, 12, 15), p('plank', 3, 30, 60)],
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
    days: [
      {
        id: 'fb-a',
        weekday: 1,
        title: 'Full body A',
        subtitle: '',
        exercises: [p('squat', 3, 8, 10), p('db_bench', 3, 8, 12), p('lat_pulldown', 3, 10, 12), p('hip_thrust', 3, 10, 12), p('plank', 3, 30, 45)],
      },
      {
        id: 'fb-b',
        weekday: 3,
        title: 'Full body B',
        subtitle: '',
        exercises: [p('rdl', 3, 8, 10), p('db_ohp', 3, 8, 12), p('db_row', 3, 10, 12), p('bulgarian', 3, 8, 10), p('lateral', 3, 12, 15)],
      },
      {
        id: 'fb-c',
        weekday: 5,
        title: 'Full body C',
        subtitle: '',
        exercises: [p('leg_press', 3, 10, 12), p('incline_db', 3, 8, 12), p('cable_row', 3, 10, 12), p('leg_curl', 3, 10, 12), p('calf', 3, 12, 15)],
      },
    ],
    extras: [],
  };
}

export function emptyProgram(startDate: string): Program {
  return { name: 'Mon programme', startDate, deloadEvery: 7, days: [], extras: [] };
}

export function exName(key: string) {
  return CATALOG[key]?.name ?? key;
}

/** Durée estimée d'une séance, en minutes */
export function estimateMinutes(day: ProgramDay) {
  let s = 0;
  for (const e of day.exercises) {
    const work = CATALOG[e.key]?.timed ? e.max : 40;
    s += e.sets * (work + e.rest) + 60;
  }
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
