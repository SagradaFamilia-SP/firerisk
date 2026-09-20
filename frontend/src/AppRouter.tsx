import { useEffect, useState } from 'react';

import App from './App';
import { LandingPage } from './features/landing/LandingPage';

type Route = 'landing' | 'app';

// Hash-based on purpose: it needs zero server configuration on any static
// host (the hash never reaches the server), unlike a real `/app` path, which
// would 404 on refresh unless the host rewrites unknown paths to index.html.
function routeFromHash(): Route {
  return window.location.hash === '#/app' ? 'app' : 'landing';
}

export function AppRouter() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const enterApp = () => {
    // Set state directly instead of relying solely on the 'hashchange'
    // listener above — real browsers fire it on this assignment too, but
    // that's not guaranteed everywhere (e.g. in tests), so this keeps the
    // click itself authoritative while the listener still covers back/forward
    // navigation and someone editing the URL by hand.
    window.location.hash = '#/app';
    setRoute('app');
  };

  if (route === 'app') return <App />;
  return <LandingPage onEnter={enterApp} />;
}
