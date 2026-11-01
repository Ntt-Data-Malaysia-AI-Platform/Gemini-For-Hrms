import { Configuration, RedirectRequest } from '@azure/msal-browser';

// Microsoft 365 sign-in for the HR operations journey (Microsoft Entra ID).
// The app registration needs this origin (e.g. http://localhost:5173) as a Single-page application redirect URI.
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID || 'organizations'}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

// Only identity is needed: the server verifies the ID token and grants the HR role.
export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'User.Read'],
  prompt: 'select_account',
};

export const m365Configured = Boolean(import.meta.env.VITE_CLIENT_ID);
