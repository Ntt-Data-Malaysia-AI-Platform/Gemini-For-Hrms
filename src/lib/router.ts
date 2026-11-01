// Minimal path router for the public pages (/, /how-it-works, /user-flow, /architecture, /agents).
// Uses the History API so pages have real URLs and back/forward work; the server falls back to index.html.
import { useEffect, useState, type MouseEvent } from 'react';

const EVENT = 'hrms:navigate';

export function navigate(path: string) {
  if (path !== window.location.pathname) window.history.pushState({}, '', path);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo({ top: 0 });
}

export function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener(EVENT, update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener(EVENT, update); };
  }, []);
  return path;
}

// For <a href> links: normal clicks navigate in-app; modified clicks (new tab) keep browser behaviour.
export const onLink = (path: string) => (e: MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  navigate(path);
};
