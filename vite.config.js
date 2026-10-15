import { defineConfig } from 'vite';

// Hostnames of common HTTPS tunnels, so a Meta Quest can reach the dev server over a trusted
// certificate (see README, "Meta Quest over HTTPS"). Add your own domain here if you use another.
const tunnelHosts = ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.app', '.ngrok.io', '.loca.lt'];

export default defineConfig({
  base: './',
  server: { host: true, allowedHosts: tunnelHosts },
  preview: { host: true, allowedHosts: tunnelHosts },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
