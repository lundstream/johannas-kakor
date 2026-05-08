import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

/**
 * Hook that mirrors local React state to a server endpoint.
 * - GETs initial value from `getPath` on mount.
 * - On every change (after the first load) PUTs to `putPath` with debounce.
 */
export function useServerState<T>(
  getPath: string,
  putPath: string | null,
  initial: T,
  extract: (resp: any) => T | null,
  debounceMs = 600,
): [T, (v: T | ((prev: T) => T)) => void, { loaded: boolean; saving: boolean }] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipNextSave = useRef(true); // skip save until after initial load completes

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await api.get<any>(getPath);
        if (cancelled) return;
        const v = extract(resp);
        if (v !== null && v !== undefined) setValue(v);
      } catch (e) {
        console.error('useServerState load failed', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getPath]);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (!putPath) return;
    setSaving(true);
    const handle = setTimeout(async () => {
      try {
        await api.put(putPath, value);
      } catch (e) {
        console.error('useServerState save failed', e);
      } finally {
        setSaving(false);
      }
    }, debounceMs);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, loaded]);

  return [value, setValue, { loaded, saving }];
}
