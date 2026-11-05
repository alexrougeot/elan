// Portions de la vie courante : « 1 œuf », « 2 tranches », « 1 pot »…
// Poids moyens de la partie mangée, pour passer des unités aux grammes.
import { norm } from './foods';

export type Portion = { one: string; many: string; grams: number };
export type PortionChoice = Portion & { count: number };

const P = (one: string, many: string, grams: number): Portion => ({ one, many, grams });
const SPOON = P('cuillère à soupe', 'cuillères à soupe', 15);

type Rule = { test: (n: string) => boolean; portions: Portion[] };
const starts = (...prefixes: string[]) => (n: string) => prefixes.some((p) => n.startsWith(p));
const has = (re: RegExp) => (n: string) => re.test(n);

const RULES: Rule[] = [
  { test: starts('oeuf de caille', 'oeufs de caille'), portions: [P('œuf de caille', 'œufs de caille', 10)] },
  { test: starts('omelette'), portions: [P('omelette de 2 œufs', 'omelettes de 2 œufs', 120)] },
  { test: starts('blanc d oeuf', 'blanc doeuf', 'oeuf blanc'), portions: [P('blanc d’œuf', 'blancs d’œuf', 33)] },
  { test: starts('jaune d oeuf', 'jaune doeuf', 'oeuf jaune'), portions: [P('jaune d’œuf', 'jaunes d’œuf', 17)] },
  { test: starts('oeuf'), portions: [P('œuf', 'œufs', 50)] },

  { test: starts('pain de mie'), portions: [P('tranche', 'tranches', 25)] },
  { test: starts('pain au chocolat', 'chocolatine'), portions: [P('pain au chocolat', 'pains au chocolat', 65)] },
  { test: starts('pain au lait'), portions: [P('pain au lait', 'pains au lait', 35)] },
  { test: starts('biscotte', 'pain grille', 'pain suedois'), portions: [P('biscotte', 'biscottes', 8)] },
  { test: starts('baguette'), portions: [P('quart de baguette', 'quarts de baguette', 60), P('tranche', 'tranches', 35)] },
  { test: starts('pain'), portions: [P('tranche', 'tranches', 35), P('quart de baguette', 'quarts de baguette', 60)] },
  { test: starts('croissant'), portions: [P('croissant', 'croissants', 45)] },
  { test: starts('brioche'), portions: [P('tranche', 'tranches', 30)] },
  { test: starts('tortilla', 'wrap', 'galette de ble'), portions: [P('galette', 'galettes', 60)] },
  { test: starts('galette de riz', 'galette de mais', 'galette de sarrasin souffle'), portions: [P('galette', 'galettes', 9)] },

  { test: starts('banane'), portions: [P('banane', 'bananes', 120)] },
  { test: starts('pomme de terre'), portions: [P('pomme de terre', 'pommes de terre', 150)] },
  { test: (n) => n === 'pomme' || n.startsWith('pomme '), portions: [P('pomme', 'pommes', 150)] },
  { test: starts('poire'), portions: [P('poire', 'poires', 150)] },
  { test: starts('orange'), portions: [P('orange', 'oranges', 150)] },
  { test: starts('clementine', 'mandarine'), portions: [P('clémentine', 'clémentines', 60)] },
  { test: starts('kiwi'), portions: [P('kiwi', 'kiwis', 75)] },
  { test: starts('peche', 'nectarine', 'brugnon'), portions: [P('pêche', 'pêches', 130)] },
  { test: starts('abricot'), portions: [P('abricot', 'abricots', 40)] },
  { test: starts('prune'), portions: [P('prune', 'prunes', 35)] },
  { test: starts('fraise', 'framboise', 'myrtille', 'cerise'), portions: [P('bol', 'bols', 150), P('poignée', 'poignées', 60)] },
  { test: starts('datte'), portions: [P('datte', 'dattes', 8)] },
  { test: starts('avocat'), portions: [P('avocat', 'avocats', 130)] },
  { test: (n) => n.startsWith('tomate') && !n.includes('sauce') && !n.includes('concentre'), portions: [P('tomate', 'tomates', 120)] },
  { test: starts('carotte'), portions: [P('carotte', 'carottes', 100)] },

  { test: starts('skyr'), portions: [P('pot', 'pots', 150)] },
  { test: starts('yaourt', 'yoghourt', 'yogourt', 'specialite laitiere'), portions: [P('pot', 'pots', 125)] },
  { test: starts('fromage blanc', 'faisselle'), portions: [P('pot de 100 g', 'pots de 100 g', 100), SPOON] },
  { test: starts('petit suisse'), portions: [P('petit-suisse', 'petits-suisses', 60)] },
  { test: starts('compote'), portions: [P('pot', 'pots', 100)] },
  { test: (n) => n.startsWith('lait') && !n.startsWith('laitue'), portions: [P('verre', 'verres', 200), P('bol', 'bols', 250)] },
  { test: starts('jus', 'nectar', 'boisson'), portions: [P('verre', 'verres', 200)] },

  { test: starts('jambon de dinde', 'jambon de poulet', 'blanc de dinde', 'blanc de poulet en tranche'), portions: [P('tranche', 'tranches', 30)] },
  { test: starts('jambon'), portions: [P('tranche', 'tranches', 40)] },
  { test: has(/steak hache/), portions: [P('steak haché', 'steaks hachés', 100)] },
  { test: (n) => n.startsWith('poulet') && /(filet|blanc|escalope)/.test(n), portions: [P('filet', 'filets', 130)] },
  { test: (n) => n.startsWith('dinde') && /(filet|escalope)/.test(n), portions: [P('escalope', 'escalopes', 120)] },
  { test: starts('saumon'), portions: [P('pavé', 'pavés', 125)] },
  { test: starts('thon'), portions: [P('petite boîte égouttée', 'petites boîtes égouttées', 100)] },
  { test: starts('sardine'), portions: [P('sardine', 'sardines', 25)] },

  {
    test: (n) => /^(riz|pates|spaghetti|macaroni|coquillette|tagliatelle|penne|quinoa|boulgour|semoule|lentille|pois chiche|haricot rouge|haricot blanc)/.test(n) && n.includes('cuit'),
    portions: [P('assiette', 'assiettes', 200), P('cuillère à soupe', 'cuillères à soupe', 25)],
  },
  {
    test: (n) => /^(riz|pates|spaghetti|macaroni|coquillette|tagliatelle|penne|quinoa|boulgour|semoule|lentille)/.test(n),
    portions: [P('portion crue', 'portions crues', 70)],
  },
  { test: starts('flocons d avoine', 'flocon d avoine', 'muesli', 'cereales', 'granola'), portions: [P('bol', 'bols', 50)] },

  { test: starts('huile'), portions: [P('cuillère à soupe', 'cuillères à soupe', 10), P('cuillère à café', 'cuillères à café', 4)] },
  { test: starts('beurre de cacahuete', 'beurre d arachide', 'beurre d amande', 'pate a tartiner', 'puree d amande', 'puree de cacahuete'), portions: [SPOON] },
  { test: starts('beurre', 'margarine', 'matiere grasse'), portions: [P('noisette', 'noisettes', 5), P('cuillère à soupe', 'cuillères à soupe', 10)] },
  { test: starts('miel'), portions: [P('cuillère à café', 'cuillères à café', 7)] },
  { test: starts('confiture', 'gelee'), portions: [SPOON] },
  { test: starts('sucre'), portions: [P('morceau', 'morceaux', 5), P('cuillère à café', 'cuillères à café', 5)] },
  { test: starts('amande', 'noix', 'noisette', 'cajou', 'pistache', 'cacahuete', 'melange de fruits secs'), portions: [P('poignée', 'poignées', 30)] },
  { test: starts('chocolat'), portions: [P('carré', 'carrés', 5)] },

  { test: starts('camembert', 'brie', 'coulommiers', 'chevre'), portions: [P('portion', 'portions', 30)] },
  { test: starts('mozzarella'), portions: [P('boule', 'boules', 125)] },
  { test: starts('emmental', 'comte', 'cheddar', 'gruyere', 'beaufort', 'parmesan', 'mimolette', 'gouda', 'tomme', 'raclette', 'feta', 'fromage', 'reblochon', 'roquefort', 'saint nectaire', 'cantal'), portions: [P('portion', 'portions', 30)] },
  { test: starts('creme fraiche', 'creme liquide'), portions: [SPOON] },
  { test: starts('mayonnaise', 'ketchup', 'moutarde', 'sauce', 'vinaigrette', 'pesto'), portions: [SPOON] },
  { test: starts('proteine', 'whey', 'poudre de proteine'), portions: [P('dose', 'doses', 30)] },
  { test: starts('biscuit', 'cookie', 'gateau sec', 'sable'), portions: [P('biscuit', 'biscuits', 10)] },
  { test: starts('barre'), portions: [P('barre', 'barres', 35)] },
  { test: starts('pizza'), portions: [P('part', 'parts', 125)] },
  { test: starts('soupe', 'potage', 'veloute'), portions: [P('bol', 'bols', 250)] },
];

/**
 * Unités proposées pour un aliment.
 * `unit` : l'unité définie par l'utilisateur (aliment perso), toujours en premier.
 * `custom` : les poids d'unité modifiés par l'utilisateur (« chez moi, 1 banane = 130 g »).
 */
export function portionsFor(name: string, serving?: number, unit?: Portion, custom?: Record<string, number>): Portion[] {
  const n = norm(name).replace(/,/g, ' ');
  const out: Portion[] = [];
  if (unit && unit.grams > 0) out.push(unit);
  if (serving && serving > 0 && !(unit && Math.round(unit.grams) === Math.round(serving))) out.push(P('portion', 'portions', Math.round(serving)));
  const rule = RULES.find((r) => r.test(n));
  if (rule) for (const p of rule.portions) if (!out.some((o) => o.one === p.one)) out.push(p);
  return out.map((p) => (custom?.[p.one] ? { ...p, grams: custom[p.one] } : p));
}

/** Pluriel simple pour une unité tapée par l'utilisateur */
export function plural(one: string) {
  const w = one.trim();
  if (!w || /[sxz]$/i.test(w)) return w;
  const [first, ...rest] = w.split(' ');
  return [first + (/(au|eu)$/i.test(first) ? 'x' : 's'), ...rest].join(' ');
}

/** Unité devinée d'après le nom (« Œuf plat » → œuf) */
export function guessUnit(name: string) {
  return portionsFor(name)[0]?.one ?? 'portion';
}

export function countText(count: number, p: Portion) {
  const c = count.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  if (count === 0.5) return `½ ${p.one}`;
  return `${c} ${count >= 2 ? p.many : p.one}`;
}
