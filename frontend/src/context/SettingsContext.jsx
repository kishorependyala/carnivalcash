import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/index';

const SettingsContext = createContext({ pollIntervalSec: 15, tokenRate: 2 });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ pollIntervalSec: 15, tokenRate: 2 });

  useEffect(() => {
    api.get('/api/settings')
      .then((res) => setSettings(res.data))
      .catch(() => {}); // fall back to default silently
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
