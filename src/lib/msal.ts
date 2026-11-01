import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from '../config/authConfig';

export const msal = new PublicClientApplication(msalConfig);

// OneDrive access is requested separately from sign-in, so a tenant that needs admin consent for
// file access still lets HR users sign in; they connect OneDrive when they open Documents.
export const GRAPH_SCOPES = ['Files.Read.All'];
const AFTER_REDIRECT = 'hrms_after_redirect';

const account = () => msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;

// Silent token for Microsoft Graph, or null when the user has not connected OneDrive yet.
export async function graphToken(): Promise<string | null> {
  const acc = account();
  if (!acc) return null;
  try {
    return (await msal.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: acc })).accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) return null;
    throw e;
  }
}

// Interactive consent for OneDrive; returns to the app and reopens the Documents view.
export async function connectOneDrive() {
  sessionStorage.setItem(AFTER_REDIRECT, 'documents');
  await msal.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account: account() ?? undefined });
}

// Outlook drafts need Mail.ReadWrite, also requested only when first used.
export const MAIL_SCOPES = ['Mail.ReadWrite'];
export async function mailToken(interactive: boolean): Promise<string | null> {
  const acc = account();
  if (!acc) throw new Error('Outlook drafts need a Microsoft 365 sign-in.');
  try {
    return (await msal.acquireTokenSilent({ scopes: MAIL_SCOPES, account: acc })).accessToken;
  } catch (e) {
    if (!(e instanceof InteractionRequiredAuthError) || !interactive) throw e;
    sessionStorage.setItem(AFTER_REDIRECT, 'report');
    await msal.acquireTokenRedirect({ scopes: MAIL_SCOPES, account: acc });
    return null;
  }
}

export const takeAfterRedirect = () => {
  const v = sessionStorage.getItem(AFTER_REDIRECT);
  sessionStorage.removeItem(AFTER_REDIRECT);
  return v;
};
