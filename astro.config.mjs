// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://jamaicasolar.com.jm',
  trailingSlash: 'always',
  redirects: { '/tools/calculator/': '/tools/system-sizer/' },
});
