import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthenticationResult } from '@azure/msal-browser';
import { Loader2 } from 'lucide-react';
import { api, ApiError, clearToken, getToken, setToken, type Agent, type Status, type User } from './lib/api';
import { loginRequest } from './config/authConfig';
import { msal } from './lib/msal';
import { Landing } from './components/Landing';
import { Workspace } from './components/Workspace';
import { applyPrefs, loadPrefs, PrefsContext, type Lang, type Theme } from './lib/i18n';

interface Session { user: User; agents: Agent[]; status: Status }
type Busy = 'm365' | 'employee' | 'demo' | null;

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

export default function App(props: { redirect: AuthenticationResult | null; redirectError: string | null }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  useEffect(() => { applyPrefs(prefs); }, [prefs]);
  const value = {
    ...prefs,
    setLang: (lang: Lang) => setPrefs((p) => ({ ...p, lang })),
    setTheme: (theme: Theme) => setPrefs((p) => ({ ...p, theme })),
  };
  return <PrefsContext.Provider value={value}><Shell {...props} /></PrefsContext.Provider>;
}

function Shell({ redirect, redirectError }: { redirect: AuthenticationResult | null; redirectError: string | null }) {
  const [session, setSession] = useState<Session | null>(null);
  const [catalog, setCatalog] = useState<{ agents: Agent[]; status: Status | null }>({ agents: [], status: null });
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(redirectError);
  const started = useRef(false);

  const openSession = useCallback(async () => {
    const me = await api.me();
    setSession({ user: me.user, agents: me.agents, status: me.status });
  }, []);

  // First load: finish a Microsoft redirect, or resume a session from this tab.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.catalog().then((c) => setCatalog(c)).catch(() => setError('The HR agents API is not running. Start it with "npm run dev".'));
    (async () => {
      try {
        if (redirect?.idToken) {
          setBusy('m365');
          setToken((await api.m365(redirect.idToken)).token);
        }
        if (getToken()) await openSession();
      } catch (e) {
        clearToken();
        if (!(e instanceof ApiError && e.status === 401 && !redirect)) setError(message(e));
      } finally {
        setBusy(null);
        setBooting(false);
      }
    })();
  }, [redirect, openSession]);

  const signIn = async (kind: Busy, get: () => Promise<{ token: string }>) => {
    setError(null);
    setBusy(kind);
    try {
      setToken((await get()).token);
      await openSession();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  const signInM365 = async () => {
    setError(null);
    setBusy('m365');
    try {
      await msal.loginRedirect(loginRequest); // navigates away; the result is handled on return
    } catch (e) {
      setError(message(e));
      setBusy(null);
    }
  };

  const signOut = async () => {
    const viaMicrosoft = session?.user.authMethod === 'Microsoft 365';
    await api.logout().catch(() => undefined);
    clearToken();
    if (viaMicrosoft) await msal.clearCache().catch(() => undefined); // signs out of this app only
    setSession(null);
  };

  if (booting) {
    return (
      <div className="grid h-screen place-items-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-3 text-sm"><Loader2 className="h-5 w-5 animate-spin" /> {busy === 'm365' ? 'Verifying your Microsoft 365 sign-in…' : 'Loading…'}</div>
      </div>
    );
  }

  if (session) return <Workspace key={session.user.email} user={session.user} agents={session.agents} status={session.status} onSignOut={signOut} />;

  return (
    <Landing
      agents={catalog.agents}
      status={catalog.status}
      busy={busy}
      error={error}
      onM365={signInM365}
      onDemoHr={() => signIn('demo', api.demoHr)}
      onEmployeeLogin={(email, password) => signIn('employee', () => api.login(email, password))}
    />
  );
}
