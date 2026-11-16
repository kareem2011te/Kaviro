import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const INCLUDED_ROOT_FILES = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'index.html',
  'metadata.json',
  '.env.example',
  'server.ts',
];

const INCLUDED_DIRS = ['src', 'server', 'public'];

function addDirectoryToZip(zip: JSZip, rootDir: string, relDir: string): void {
  const fullPath = path.join(rootDir, relDir);
  if (!fs.existsSync(fullPath)) return;
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const entryRel = path.join(relDir, entry.name);
    const entryAbs = path.join(rootDir, entryRel);
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, rootDir, entryRel);
    } else if (entry.isFile()) {
      const content = fs.readFileSync(entryAbs);
      zip.file(entryRel.replace(/\\/g, '/'), content);
    }
  }
}

export async function buildProjectZipBuffer(): Promise<Buffer> {
  const rootDir = process.cwd();
  const zip = new JSZip();

  for (const file of INCLUDED_ROOT_FILES) {
    const abs = path.join(rootDir, file);
    if (fs.existsSync(abs)) {
      zip.file(file, fs.readFileSync(abs));
    }
  }

  for (const dir of INCLUDED_DIRS) {
    addDirectoryToZip(zip, rootDir, dir);
  }

  const readme = `# KAVIRO — AI-Powered Team Management Platform

## Quick Start
1. Install dependencies:
   npm install

2. Configure environment variables:
   cp .env.example .env
   Set GEMINI_API_KEY in .env for server-side Gemini AI CV analysis & KAVIRO AI Assistant.

3. Start development server (Express + WebSockets + Vite on port 3000):
   npm run dev

4. Build & run production:
   npm run build
   npm start
`;
  zip.file('README.md', readme);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
