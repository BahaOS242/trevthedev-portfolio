// @ts-check
import { defineConfig } from 'astro/config';
import wix from "@wix/astro";
import wixPages from "@wix/astro-pages";
import sitemap from "@astrojs/sitemap";

import react from "@astrojs/react";
import wixHostingAdapter from "@wix/astro-wix-hosting-adapter";

// https://astro.build/config
export default defineConfig({
  site: "https://www.trevthewebdev.com",
  integrations: [
    wix({ robots: false }), // serve public/robots.txt (declares the sitemap)
    wixPages(),
    react(),
    sitemap({
      filter: (page) => !page.includes("/audit/"),
      // Match the canonical URLs emitted by src/layouts/FM.astro (no trailing slash).
      serialize: (item) => ({
        ...item,
        url: new URL(item.url).pathname === "/" ? item.url : item.url.replace(/\/$/, ""),
      }),
    }),
  ],
  security: { checkOrigin: false },
  adapter: wixHostingAdapter(),

  image: {
    domains: ["static.wixstatic.com"],
  },

  output: "server",
});
