// Convertit les fiches HTML de fiches/<matiere>/<dossier>.html en PDF
// dans contenu/<matiere>/<dossier>/fiche.pdf, avec Chrome (ou Edge) en mode headless.
// Les corrigés de TD (fiches/<matiere>/<dossier>.corrige.html) donnent corrige.pdf.
// Usage : node scripts/build-fiches.js [motif]   (ex. node scripts/build-fiches.js cours03)
// Variable d'environnement CHROME_PATH pour forcer le navigateur.

import { readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const dossierFiches = join(racine, "fiches");
const motif = process.argv[2] || "";

const candidats = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chrome = candidats.find((c) => existsSync(c));
if (!chrome) {
  console.error("Chrome ou Edge introuvable : définis CHROME_PATH.");
  process.exit(1);
}

const fiches = readdirSync(dossierFiches)
  .filter((m) => statSync(join(dossierFiches, m)).isDirectory())
  .flatMap((matiere) =>
    readdirSync(join(dossierFiches, matiere))
      .filter((f) => f.endsWith(".html") && f.includes(motif))
      .map((f) => {
        const nom = basename(f, ".html");
        const corrige = nom.endsWith(".corrige");
        return {
          matiere,
          dossier: corrige ? nom.slice(0, -".corrige".length) : nom,
          sortie: corrige ? "corrige.pdf" : "fiche.pdf",
          source: join(dossierFiches, matiere, f),
        };
      })
  );

for (const { matiere, dossier, sortie, source } of fiches) {
  const destination = join(racine, "contenu", matiere, dossier);
  if (!existsSync(destination)) {
    console.warn(`ignorée : contenu/${matiere}/${dossier}/ n'existe pas`);
    continue;
  }
  mkdirSync(destination, { recursive: true });
  const pdf = join(destination, sortie);
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--user-data-dir=${join(tmpdir(), "revisator-fiches")}`,
    `--print-to-pdf=${pdf}`,
    pathToFileURL(source).href,
  ], { stdio: "ignore" });
  console.log(`contenu/${matiere}/${dossier}/${sortie}`);
}
