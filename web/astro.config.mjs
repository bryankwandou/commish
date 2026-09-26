// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: process.env.VERCEL ? vercel({ maxDuration: 60 }) : node({ mode: "standalone" }),
  // pinocchio/client.ts sits outside web/; resolve its imports from web/node_modules.
  vite: { plugins: [tailwindcss()], resolve: { dedupe: ["@solana/web3.js", "@solana/spl-token"] } },
});
