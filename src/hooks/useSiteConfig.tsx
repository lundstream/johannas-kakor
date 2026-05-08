import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type SiteConfig } from '../api';

const FALLBACK: SiteConfig = {
  site_name: 'Bakery Labels',
  header_tagline: '',
  footer_text: '',
  favicon_data_url: '',
  primary_color: '#b08654',
  instagram_url: '',
  default_locale: 'en',
  free_mode_enabled: '0',
  free_mode_path: 'free',
};

const Ctx = createContext<SiteConfig>(FALLBACK);

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<SiteConfig>(FALLBACK);
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get<SiteConfig>('/api/public/site');
        setCfg(r);
        if (r.site_name) document.title = r.site_name;
        if (r.favicon_data_url) {
          let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = r.favicon_data_url;
        }
        if (r.primary_color) {
          document.documentElement.style.setProperty('--primary', r.primary_color);
        }
      } catch (e) {
        console.error('site config load failed', e);
      }
    })();
  }, []);
  return <Ctx.Provider value={cfg}>{children}</Ctx.Provider>;
}

export function useSiteConfig(): SiteConfig {
  return useContext(Ctx);
}
