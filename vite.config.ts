import { defineConfig } from "vite";
import { developmentSeo } from "./scripts/lib/dev-seo";
import { informationRoutes } from "./scripts/lib/info-routes";
export default defineConfig({
  plugins: [informationRoutes(), developmentSeo()],
  base: "./",
  server: {
    headers: { "X-Robots-Tag": "noindex, nofollow" },
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/private/**",
        "**/lingosaic-daily-*/**",
        "**/.lingosaic-run/**",
        "**/scripts/**",
        "**/data/**",
        "**/tests/**",
      ],
    },
  },
});
