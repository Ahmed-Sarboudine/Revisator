// Fabrique un sujet d'examen imprimable (document.pdf) et son corrigé (corrige.pdf) à partir
// d'un qcm.json et d'un fichier de mise en page fiches/<matiere>/<dossier>.sujet.json
// (consignes, page de ressources, questions ouvertes et leur corrigé).
// Usage : node scripts/qcm-sujet.js contenu/<matiere>/<dossier>
// Variable d'environnement CHROME_PATH pour forcer le navigateur.

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const dossier = process.argv[2];
if (!dossier) {
  console.error("Usage : node scripts/qcm-sujet.js contenu/<matiere>/<dossier>");
  process.exit(1);
}
const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const matiere = basename(dirname(resolve(dossier)));
const nomDossier = basename(resolve(dossier));
const qcm = JSON.parse(readFileSync(join(dossier, "qcm.json"), "utf8"));
const sujet = JSON.parse(readFileSync(join(racine, "fiches", matiere, `${nomDossier}.sujet.json`), "utf8"));

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

const echapper = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// bloc Markdown converti dans la page (formules protégées, comme dans notebooks-pdf.js)
const md = (texte, classe = "md") => `<div class="${classe}" data-md="${echapper(texte)}"></div>`;
const LETTRES = "ABCDEF";

function questions(avecCorrection) {
  let exercicePrecedent = null;
  return qcm.questions
    .map((q, i) => {
      // le contexte d'un exercice n'est imprimé qu'une fois pour une suite de questions qui le partagent
      const contexte = q.exercice && q.exercice !== exercicePrecedent && !q.exercice.startsWith("**Ressource")
        ? md(q.exercice, "md contexte") : "";
      exercicePrecedent = q.exercice || null;
      const renvoi = q.exercice && q.exercice.startsWith("**Ressource")
        ? `<span class="renvoi">(${q.exercice.match(/\*\*(Ressource [A-Z])/)[1]})</span> ` : "";
      const choix = q.choix
        .map((c, j) => {
          const bonne = avecCorrection && q.reponses.includes(j);
          return `<li class="${bonne ? "bonne" : ""}"><span class="lettre">${LETTRES[j]}</span>${md(c, "md choix")}</li>`;
        })
        .join("");
      return `<section class="question">
        ${contexte}
        <div class="q-tete"><span class="num">${i + 1}</span>${renvoi}${md(q.enonce, "md enonce")}</div>
        <ol class="choix">${choix}</ol>
        ${avecCorrection ? `<div class="correction"><strong>Réponse : ${q.reponses.map((r) => LETTRES[r]).join(", ")}.</strong> ${md(q.explication, "md")}</div>` : ""}
      </section>`;
    })
    .join("");
}

function feuilleReponses() {
  const lignes = qcm.questions
    .map((q, i) => `<div class="ligne-rep"><span class="num-rep">${i + 1}${q.type === "multiple" ? " ♣" : ""}</span>${q.choix
      .map((_, j) => `<span class="case">${LETTRES[j]}</span>`)
      .join("")}</div>`)
    .join("");
  return `<section class="saut"><h2>Feuille de réponses</h2>
    <p class="petit">Nom, prénom : ………………………………………………… &nbsp; Coloriez entièrement chaque case choisie.</p>
    <div class="grille-rep">${lignes}</div></section>`;
}

function page(avecCorrection) {
  const ouvertes = sujet.ouvertes
    .map((o) => `<section class="ouverte"><h3>${echapper(o.titre)}</h3>${md(o.enonce)}${
      avecCorrection ? `<div class="correction"><strong>Éléments de réponse</strong>${md(o.corrige)}</div>` : `<div class="lignes"></div>`
    }</section>`)
    .join("");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(sujet.titre)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<style>
  @page { size: A4; margin: 13mm 14mm 15mm; @bottom-center { content: counter(page) " / " counter(pages); font: 8pt "Segoe UI", sans-serif; color: #8a877e; } }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #1b1a17; font: 9.6pt/1.45 "Segoe UI", system-ui, sans-serif; }
  .entete { border-bottom: 3px solid #2a4bd7; padding-bottom: 6px; margin-bottom: 10px; }
  .surtitre { margin: 0; color: #2a4bd7; font-size: 8.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  h1 { margin: 2px 0 2px; font-size: 18pt; } h2 { font-size: 13pt; color: #2a4bd7; margin: 12px 0 6px; } h3 { font-size: 10.5pt; margin: 10px 0 4px; }
  .meta { color: #6b6860; margin: 0; }
  .consignes { background: #eef1fd; border-left: 4px solid #2a4bd7; border-radius: 4px; padding: 6px 10px 6px 26px; margin: 8px 0; }
  .consignes li { margin: 2px 0; }
  .ressources { border: 1px solid #d6d2c8; border-radius: 6px; padding: 8px 12px; }
  table { border-collapse: collapse; margin: 4px 0 8px; } th, td { border: 1px solid #d6d2c8; padding: 2px 9px; text-align: center; } th { background: #f3f1ec; }
  .md p { margin: 3px 0; } .md ul, .md ol { margin: 3px 0; padding-left: 20px; }
  .md code { font: 8.5pt Consolas, monospace; background: #f3f1ec; padding: 0 3px; border-radius: 3px; }
  .question { break-inside: avoid; margin: 0 0 8px; }
  .contexte { margin: 10px 0 4px; padding: 5px 9px; background: #f6f4ef; border-radius: 4px; }
  .q-tete { display: flex; gap: 6px; align-items: baseline; font-weight: 600; }
  .q-tete .md p { margin: 0; }
  .num { flex: none; min-width: 22px; color: #2a4bd7; }
  .renvoi { flex: none; color: #6b6860; font-weight: 400; }
  ol.choix { list-style: none; margin: 2px 0 0 28px; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px 14px; }
  ol.choix li { display: flex; gap: 6px; align-items: baseline; }
  ol.choix li .md p { margin: 0; }
  .lettre { flex: none; font-weight: 700; color: #6b6860; }
  li.bonne { color: #18763f; font-weight: 600; } li.bonne .lettre { color: #18763f; }
  .correction { margin: 3px 0 0 28px; padding: 4px 8px; background: #e2f3e8; border-radius: 4px; font-size: 9pt; }
  .correction .md p { margin: 2px 0; }
  .ouverte { break-inside: avoid; }
  .lignes { height: 62mm; background: repeating-linear-gradient(#fff 0 6.6mm, #cfccc4 6.6mm 6.9mm); margin: 4px 0 8px; }
  .saut { break-before: page; }
  .grille-rep { columns: 2; column-gap: 20mm; }
  .ligne-rep { display: flex; align-items: center; gap: 4mm; margin: 0 0 2.2mm; break-inside: avoid; }
  .num-rep { width: 12mm; font-weight: 700; }
  .case { display: inline-grid; place-items: center; width: 6mm; height: 5mm; border: 1.2px solid #1b1a17; border-radius: 2px; font-size: 7pt; color: #8a877e; }
  .petit { font-size: 8.5pt; color: #6b6860; }
  .katex { font-size: 1.04em; }
</style></head><body>
<header class="entete"><p class="surtitre">${echapper(sujet.surtitre)}</p>
  <h1>${echapper(sujet.titre)}${avecCorrection ? " — corrigé" : ""}</h1>
  <p class="meta">Durée : ${echapper(sujet.duree)} · ${qcm.questions.length} questions de QCM et ${sujet.ouvertes.length} questions ouvertes</p></header>
${avecCorrection ? "" : `<ul class="consignes">${sujet.consignes.map((c) => `<li>${echapper(c)}</li>`).join("")}</ul>`}
<h2>Page de ressources</h2>
<div class="ressources">${md(sujet.ressources)}</div>
<h2>Partie 1 — QCM</h2>
${questions(avecCorrection)}
<h2 class="${avecCorrection ? "" : "saut"}">Partie 2 — Questions ouvertes</h2>
${ouvertes}
${avecCorrection ? "" : feuilleReponses()}
<script>
  const formules = [];
  const proteger = (src) => src
    .replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, (_, f) => (formules.push([f, true]), "@@F" + (formules.length - 1) + "@@"))
    .replace(/\\$([^$\\n]+?)\\$/g, (_, f) => (formules.push([f, false]), "@@F" + (formules.length - 1) + "@@"));
  for (const el of document.querySelectorAll("[data-md]")) el.innerHTML = marked.parse(proteger(el.dataset.md));
  document.body.innerHTML = document.body.innerHTML.replace(/@@F(\\d+)@@/g, (_, i) => {
    const [f, bloc] = formules[+i];
    const t = document.createElement("textarea");
    t.innerHTML = f;
    try { return katex.renderToString(t.value, { displayMode: bloc, throwOnError: false }); } catch { return f; }
  });
</script></body></html>`;
}

const tmp = mkdtempSync(join(tmpdir(), "revisator-sujet-"));
for (const [nom, avecCorrection] of [["document.pdf", false], ["corrige.pdf", true]]) {
  const html = join(tmp, `${nom}.html`);
  writeFileSync(html, page(avecCorrection));
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=15000",
    `--user-data-dir=${join(tmpdir(), "revisator-fiches")}`, `--print-to-pdf=${resolve(join(dossier, nom))}`,
    pathToFileURL(html).href], { stdio: "ignore" });
  console.log(join(dossier, nom));
}
rmSync(tmp, { recursive: true, force: true });
