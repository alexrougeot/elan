import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { isIOS, isStandalone } from '../lib/device';
import { Icon, LogoMark } from '../components/ui';

function frenchError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.';
  if (m.includes('password should be at least') || m.includes('weak')) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (m.includes('email not confirmed')) return 'Ton email n’est pas encore confirmé. Ouvre le lien reçu par email, puis reviens ici.';
  if (m.includes('fetch') || m.includes('network')) return 'Pas de réseau. La première connexion a besoin d’internet.';
  if (m.includes('rate limit')) return 'Trop d’essais d’affilée. Attends une minute et réessaie.';
  return 'Ça n’a pas marché : ' + msg;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL },
        });
        if (error) throw error;
        if (!data.session) setInfo('Compte créé. Ouvre le lien de confirmation reçu par email, puis connecte-toi ici.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      setError(frenchError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const showInstall = isIOS() && !isStandalone();

  return (
    <main className="app" style={{ padding: 'calc(var(--safe-t) + 48px) 24px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div className="col" style={{ alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <LogoMark size={76} />
        <div className="col" style={{ gap: 6, alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 44, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>élan</h1>
          <p className="muted" style={{ margin: 0, fontSize: 16 }}>
            Sport, nutrition et bien-être
          </p>
        </div>
      </div>

      {showInstall && (
        <div className="card row" style={{ alignItems: 'flex-start' }}>
          <Icon name="share" style={{ color: 'var(--brand-ink)', marginTop: 2 }} />
          <p className="small" style={{ margin: 0, lineHeight: 1.45 }}>
            Pour l’installer comme une vraie app : touche <b>Partager</b> en bas de Safari, puis <b>Sur l’écran d’accueil</b>. Elle marchera aussi sans réseau.
          </p>
        </div>
      )}

      <form className="card col" style={{ gap: 14, padding: 20 }} onSubmit={submit}>
        <div className="segmented" role="group" aria-label="Choix">
          <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>
            Créer un compte
          </button>
          <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>
            Se connecter
          </button>
        </div>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="small" style={{ margin: 0, color: 'var(--red)' }}>
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="small" style={{ margin: 0, color: 'var(--brand-ink)' }}>
            {info}
          </p>
        )}
        <button className="btn brand press" disabled={busy}>
          {busy ? 'Un instant…' : mode === 'signup' ? 'Créer mon compte' : 'Me connecter'}
        </button>
        <p className="tiny muted" style={{ margin: 0, textAlign: 'center' }}>
          Chacun son compte : tes séances et tes repas ne sont visibles que par toi.
        </p>
      </form>
    </main>
  );
}
