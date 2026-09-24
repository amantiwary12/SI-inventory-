import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import { useLiveUpdates } from './SocketContext.jsx';

const MetaContext = createContext(null);

const EMPTY_MASTERS = {
  category: [], subCategory: [], location: [], rack: [], department: [],
  vendor: [], unit: [], project: [], condition: [], source: [],
};

/**
 * Holds everything that shapes the UI but rarely changes: the field
 * definitions, the master dropdown lists, and the sidebar modules.
 */
export function MetaProvider({ children }) {
  const { user } = useAuth();
  // Keyed on the id so a profile edit does not reload every dropdown.
  const userId = user?.id;
  const [fields, setFields] = useState([]);
  const [masters, setMasters] = useState(EMPTY_MASTERS);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts) => {
    if (!userId) return;
    if (opts?.silent !== true) setLoading(true);
    try {
      const [f, m, mod] = await Promise.all([
        api.get('/fields'),
        api.get('/masters'),
        api.get('/modules'),
      ]);
      setFields(f.data.fields || []);
      setMasters({ ...EMPTY_MASTERS, ...(m.data.masters || {}) });
      setModules(mod.data.modules || []);
    } catch (err) {
      console.error('[meta] load failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) refresh();
    else {
      setFields([]);
      setMasters(EMPTY_MASTERS);
      setModules([]);
      setLoading(false);
    }
  }, [userId, refresh]);

  // Someone else added a field, a dropdown value or a module — pick it up quietly.
  useLiveUpdates(['fields', 'masters', 'modules'], () => refresh({ silent: true }));

  const value = useMemo(() => {
    /** Options for a system field whose choices come from a master list. */
    const optionsFor = (key) => {
      const map = {
        category: 'category', subCategory: 'subCategory', location: 'location', rack: 'rack',
        vendor: 'vendor', unit: 'unit', project: 'project', source: 'source',
        ownerDepartment: 'department', department: 'department',
      };
      const list = masters[map[key]] || [];
      return list.map((r) => r.name);
    };

    return {
      fields,
      masters,
      modules,
      loading,
      refresh,
      optionsFor,
      itemFields: fields.filter((f) => f.scope === 'item'),
      txnFields: fields.filter((f) => f.scope === 'transaction'),
      /** Is this built-in attribute switched on? Unknown keys default to visible. */
      isVisible: (key, scope = 'item') => {
        const def = fields.find((f) => f.scope === scope && f.key === key);
        return def ? def.visible : true;
      },
      labelFor: (key, fallback, scope = 'item') =>
        fields.find((f) => f.scope === scope && f.key === key)?.label || fallback,
      isRequired: (key, scope = 'item') =>
        Boolean(fields.find((f) => f.scope === scope && f.key === key)?.required),
    };
  }, [fields, masters, modules, loading, refresh]);

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export const useMeta = () => {
  const ctx = useContext(MetaContext);
  if (!ctx) throw new Error('useMeta must be used inside MetaProvider');
  return ctx;
};
