import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { AuthenticationResult } from '@azure/msal-browser';
import App from './App.tsx';
import { m365Configured } from './config/authConfig';
import { msal } from './lib/msal';
import './index.css';

// Finish a Microsoft 365 redirect sign-in (if one is in progress) before the first render.
async function boot() {
  let redirect: AuthenticationResult | null = null;
  let redirectError: string | null = null;
  if (m365Configured) {
    try {
      await msal.initialize();
      redirect = await msal.handleRedirectPromise();
      if (redirect?.account) msal.setActiveAccount(redirect.account);
    } catch (e) {
      redirectError = e instanceof Error ? e.message : 'Microsoft sign-in failed.';
    }
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App redirect={redirect} redirectError={redirectError} />
    </StrictMode>,
  );
}
boot();
