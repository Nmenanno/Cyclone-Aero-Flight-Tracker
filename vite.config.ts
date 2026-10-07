import { defineConfig, loadEnv } from "vite";
import { validateBackend } from "./src/lib/config.mjs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  validateBackend(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return {
    base: "/Cyclone-Aero-Flight-Tracker/",
    plugins: [react(), tailwindcss()],
  };
});
