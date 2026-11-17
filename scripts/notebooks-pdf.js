// Convertit un ou plusieurs notebooks Jupyter (.ipynb) en un seul PDF lisible sur le site :
// texte (Markdown + formules KaTeX), code, et sorties déjà calculées (texte, tableaux, graphiques).
// Les notebooks ne sont pas exécutés : on affiche les sorties enregistrées dans le fichier.
// Usage : node scripts/notebooks-pdf.js <sortie.pdf> "<Titre du document>" <a.ipynb> [b.ipynb …]
// Variable d'environnement CHROME_PATH pour forcer le navigateur.

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const [sortie, titre, ...notebooks] = process.argv.slice(2);
if (!sortie || !titre || notebooks.length === 0) {
  console.error('Usage : node scripts/notebooks-pdf.js <sortie.pdf> "<Titre>" <a.ipynb> [b.ipynb …]');
  process.exit(1);
}

const chrome = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean).find((c) => existsSync(c));
if (!chrome) {
  console.error("Chrome ou Edge introuvable : définis CHROME_PATH.");
  process.exit(1);
}

const MAX_LIGNES = 40; // au-delà, une sortie texte est tronquée (longs journaux d'entraînement…)

const echapper = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const texte = (v) => (Array.isArray(v) ? v.join("") : v || "");
// retire les codes couleur ANSI des sorties (tracebacks, barres de progression)
const sansAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

function tronquer(s) {
  const lignes = s.replace(/\n$/, "").split("\n");
  if (lignes.length <= MAX_LIGNES) return lignes.join("\n");
  const coupe = lignes.length - MAX_LIGNES;
  return [...lignes.slice(0, MAX_LIGNES - 5), `… (${coupe} lignes masquées) …`, ...lignes.slice(-5)].join("\n");
}

function sortieHtml(o) {
  if (o.output_type === "stream") return `<pre class="sortie">${echapper(tronquer(sansAnsi(texte(o.text))))}</pre>`;
  if (o.output_type === "error") return `<pre class="sortie erreur">${echapper(`${o.ename}: ${o.evalue}`)}</pre>`;
  const d = o.data || {};
  if (d["image/png"]) return `<img class="figure" src="data:image/png;base64,${texte(d["image/png"]).trim()}">`;
  if (d["image/jpeg"]) return `<img class="figure" src="data:image/jpeg;base64,${texte(d["image/jpeg"]).trim()}">`;
  if (d["image/svg+xml"]) return `<div class="figure">${texte(d["image/svg+xml"])}</div>`;
  if (d["text/html"]) {
    const h = texte(d["text/html"]);
    // les tableaux pandas sont gardés ; le reste du HTML (widgets, scripts) est ignoré
    if (/<table/i.test(h) && !/<script/i.test(h)) return `<div class="tableau">${h}</div>`;
  }
  if (d["text/latex"]) return `<div class="md">${texte(d["text/latex"])}</div>`;
  if (d["text/plain"]) return `<pre class="sortie">${echapper(tronquer(sansAnsi(texte(d["text/plain"]))))}</pre>`;
  return "";
}

// Le Markdown est converti dans le navigateur (marked) ; les formules sont protégées avant,
// sinon marked transforme les _ et * des formules en italique.
function celluleMarkdown(cellule) {
  let source = texte(cellule.source);
  for (const [nom, contenu] of Object.entries(cellule.attachments || {})) {
    const [type, donnees] = Object.entries(contenu)[0];
    source = source.split(`attachment:${nom}`).join(`data:${type};base64,${texte(donnees).trim()}`);
  }
  return `<div class="md" data-md="${echapper(source).replace(/"/g, "&quot;")}"></div>`;
}

const parties = notebooks.map((chemin, i) => {
  const nb = JSON.parse(readFileSync(chemin, "utf8"));
  const dossier = dirname(resolve(chemin));
  const cellules = nb.cells
    .map((c) => {
      if (c.cell_type === "markdown") return celluleMarkdown(c);
      if (c.cell_type !== "code") return "";
      const code = texte(c.source).trim();
      if (!code) return "";
      const sorties = (c.outputs || []).map(sortieHtml).join("");
      return `<div class="code"><pre><code class="language-python">${echapper(code)}</code></pre>${sorties ? `<div class="sorties">${sorties}</div>` : ""}</div>`;
    })
    .join("\n");
  const nom = basename(chemin, ".ipynb");
  return `<section class="notebook${i > 0 ? " saut" : ""}" data-base="${pathToFileURL(dossier + "/").href}">
    ${notebooks.length > 1 ? `<p class="nom-notebook">Notebook ${i + 1} / ${notebooks.length} · ${echapper(nom)}</p>` : ""}
    ${cellules}
  </section>`;
});

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(titre)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/core.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/languages/python.min.js"></script>
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #1b1a17; font: 10pt/1.5 "Segoe UI", system-ui, sans-serif; }
  .titre-doc { margin: 0 0 14px; padding-bottom: 6px; border-bottom: 3px solid #2a4bd7; font-size: 18pt; }
  .nom-notebook { margin: 0 0 8px; color: #2a4bd7; font-size: 8.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .saut { break-before: page; }
  .md h1 { font-size: 16pt; margin: 14px 0 6px; } .md h2 { font-size: 13pt; margin: 14px 0 5px; color: #2a4bd7; }
  .md h3 { font-size: 11pt; margin: 12px 0 4px; } .md h4 { font-size: 10pt; margin: 10px 0 4px; }
  .md h1, .md h2, .md h3, .md h4 { break-after: avoid; }
  .md p { margin: 4px 0; } .md ul, .md ol { margin: 4px 0; padding-left: 22px; }
  .md img { max-width: 100%; }
  .md table, .tableau table { border-collapse: collapse; margin: 6px 0; font-size: 8.5pt; }
  .md th, .md td, .tableau th, .tableau td { border: 1px solid #d6d2c8; padding: 2px 7px; }
  .md th, .tableau th { background: #f3f1ec; }
  .md blockquote { margin: 6px 0; padding: 4px 10px; border-left: 3px solid #2a4bd7; background: #eef1fd; }
  .md code { font: 8.5pt Consolas, "Cascadia Mono", monospace; background: #f3f1ec; padding: 0 3px; border-radius: 3px; }
  .md pre code { background: none; padding: 0; }
  .md pre { background: #f6f4ef; padding: 6px 8px; border-radius: 4px; white-space: pre-wrap; }
  .code { margin: 6px 0 8px; }
  .code > pre { margin: 0; padding: 6px 9px; border: 1px solid #e4e0d7; border-left: 3px solid #2a4bd7; border-radius: 4px;
    background: #fafaf8; font: 8.3pt/1.4 Consolas, "Cascadia Mono", monospace; white-space: pre-wrap; word-break: break-word; }
  .code > pre code { background: none !important; padding: 0 !important; }
  .sorties { padding: 4px 0 0 12px; }
  pre.sortie { margin: 2px 0; font: 8pt/1.35 Consolas, "Cascadia Mono", monospace; color: #3d3b36; white-space: pre-wrap; word-break: break-word; }
  pre.erreur { color: #b42318; }
  .figure { display: block; max-width: 100%; max-height: 120mm; margin: 4px 0; break-inside: avoid; }
  .tableau { overflow: hidden; }
  .katex { font-size: 1.05em; }
  .katex-display { margin: 6px 0; }
</style>
</head>
<body>
<h1 class="titre-doc">${echapper(titre)}</h1>
${parties.join("\n")}
<script>
  // protège les formules ($$…$$, \\[…\\], $…$), convertit le Markdown, puis rend les formules
  const formules = [];
  const proteger = (src) =>
    src
      .replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, (_, f) => (formules.push([f, true]), "@@F" + (formules.length - 1) + "@@"))
      .replace(/\\\\\\[([\\s\\S]+?)\\\\\\]/g, (_, f) => (formules.push([f, true]), "@@F" + (formules.length - 1) + "@@"))
      .replace(/\\$([^$\\n]+?)\\$/g, (_, f) => (formules.push([f, false]), "@@F" + (formules.length - 1) + "@@"));
  for (const section of document.querySelectorAll(".notebook")) {
    const base = section.dataset.base;
    for (const el of section.querySelectorAll(".md[data-md]")) {
      el.innerHTML = marked.parse(proteger(el.dataset.md));
      for (const img of el.querySelectorAll("img")) {
        const src = img.getAttribute("src") || "";
        if (!/^(data:|https?:|file:)/.test(src)) img.src = new URL(src, base).href;
      }
    }
  }
  document.body.innerHTML = document.body.innerHTML.replace(/@@F(\\d+)@@/g, (_, i) => {
    const [f, bloc] = formules[+i];
    const t = document.createElement("textarea");
    t.innerHTML = f; // les formules ont pu être échappées en entités HTML
    try {
      return katex.renderToString(t.value, { displayMode: bloc, throwOnError: false });
    } catch {
      return f;
    }
  });
  document.querySelectorAll(".code > pre code").forEach((b) => hljs.highlightElement(b));
</script>
</body>
</html>`;

const tmp = mkdtempSync(join(tmpdir(), "revisator-nb-"));
const fichierHtml = join(tmp, "notebook.html");
writeFileSync(fichierHtml, html);
execFileSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  "--allow-file-access-from-files",
  "--virtual-time-budget=20000",
  `--user-data-dir=${join(tmpdir(), "revisator-fiches")}`,
  `--print-to-pdf=${resolve(sortie)}`,
  pathToFileURL(fichierHtml).href,
], { stdio: "ignore" });
rmSync(tmp, { recursive: true, force: true });
console.log(`${sortie} (${notebooks.length} notebook${notebooks.length > 1 ? "s" : ""})`);
