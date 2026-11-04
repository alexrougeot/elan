// Hydratation : objectif d'environ 35 ml par kilo, compté en verres de 25 cl.
import { getData, putDoc } from './store';
import { dayKey } from './dates';
import type { Profile, Targets } from './nutrition';

export const GLASS = 250;

export function waterGoal(profile?: Profile, targets?: Targets) {
  if (targets?.water?.goalMl) return targets.water.goalMl;
  const kg = profile?.weight ?? 70;
  return Math.max(1500, Math.round((kg * 35) / GLASS) * GLASS);
}

export function waterOn(date = dayKey()) {
  return getData<{ date: string; ml: number }>('water:' + date)?.ml ?? 0;
}

export async function addWater(ml: number, date = dayKey()) {
  const cur = waterOn(date);
  await putDoc('water:' + date, 'water', { date, ml: Math.max(0, cur + ml) });
}

export const WATER_REMINDERS = ['10:30', '15:00', '17:30', '20:00'];
