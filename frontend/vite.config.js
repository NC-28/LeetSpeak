import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import manifest from "./src/manifest";

export default defineConfig({
                              plugins: [react(), crx({ manifest })],
                              build: {
                                rollupOptions: {
                                  input: {
                                    popup: "./popup.html",
                                    background: "src/background/index.js",
                                    contentScript: "src/contentScript/index.js",  // ✅ Must match file path
                                  },
                                },
                              },
                            });
