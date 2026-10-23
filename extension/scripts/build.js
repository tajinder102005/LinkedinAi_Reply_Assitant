import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

async function runBuild() {
  console.log('--- Step 1: Building LinkedIn Extension Popup ---');
  await build({
    plugins: [react()],
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: path.resolve('src/popup/popup.html'),
        },
      },
    },
  });

  console.log('--- Step 2: Building Content Script (IIFE for LinkedIn) ---');
  await build({
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: path.resolve('src/content/content.tsx'),
        name: 'LinkedInAiContentScript',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          extend: true,
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'content.css';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
    },
  });

  console.log('--- Step 3: Building Background Service Worker ---');
  await build({
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: path.resolve('src/background/service-worker.ts'),
        name: 'LinkedInAiBackground',
        formats: ['iife'],
        fileName: () => 'background.js',
      },
    },
  });

  // Ensure manifest.json in dist points correctly to popup
  const distManifestPath = path.resolve('dist/manifest.json');
  if (fs.existsSync(distManifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));
    manifest.action.default_popup = 'src/popup/popup.html';
    fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2));
    console.log('Manifest validated in dist/manifest.json');
  }

  console.log('LinkedIn Extension build completed successfully! Output in extension/dist/');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
