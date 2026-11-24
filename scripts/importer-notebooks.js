// Importe des notebooks Jupyter (.ipynb) dans un dossier de contenu, pour les afficher sur le site
// (route #/nb/…) : texte, code et résultats déjà calculés. Rien n'est exécuté, ni ici ni chez le visiteur.
//
// Usage :
//   node scripts/importer-notebooks.js <dossier-du-document> "<Titre>" a.ipynb ["<Titre>" b.ipynb …]
//   Préfixer un titre par « ! » marque le notebook comme correction (onglet masqué tant qu'on ne clique pas).
// Exemple :
//   node scripts/importer-notebooks.js contenu/traitement-donnees/td01-descente-de-gradient \
//     "Énoncé" TD1.ipynb "!Correction" TD1_correction.ipynb
//
// Produit dans <dossier>/notebooks/ : notebooks.json (la liste), un .json par notebook,
// et les images (graphiques, illustrations) en fichiers séparés, chargés à la demande.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";

const [dossier, ...reste] = process.argv.slice(2);
if (!dossier || reste.length < 2 || reste.length % 2 !== 0) {
  console.error('Usage : node scripts/importer-notebooks.js <dossier> "<Titre>" a.ipynb ["!Correction" b.ipynb …]');
  process.exit(1);
}

const MAX_LIGNES = 60; // au-delà, une sortie texte est raccourcie (longs journaux d'entraînement…)

const texte = (v) => (Array.isArray(v) ? v.join("") : v || "");
const sansAnsi = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
// barres de progression : seule la dernière version de chaque ligne réécrite par \r compte
const sansRetourChariot = (s) => s.split("\n").map((l) => l.split("\r").filter(Boolean).pop() ?? "").join("\n");

function raccourcir(s) {
  const lignes = s.replace(/\n+$/, "").split("\n");
  if (lignes.length <= MAX_LIGNES) return lignes.join("\n");
  const coupe = lignes.length - MAX_LIGNES;
  return [...lignes.slice(0, MAX_LIGNES - 8), `… (${coupe} lignes masquées) …`, ...lignes.slice(-8)].join("\n");
}

const sortieTexte = (s) => raccourcir(sansRetourChariot(sansAnsi(s)));

// HTML produit par pandas : on garde le tableau, sans <style> ni <script>
const htmlPropre = (h) =>
  h
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .trim();

const sortieDir = join(dossier, "notebooks");
rmSync(sortieDir, { recursive: true, force: true });
mkdirSync(sortieDir, { recursive: true });

const liste = [];
for (let k = 0; k < reste.length; k += 2) {
  let titre = reste[k];
  const chemin = reste[k + 1];
  const correction = titre.startsWith("!");
  if (correction) titre = titre.slice(1);
  const nb = JSON.parse(readFileSync(chemin, "utf8"));
  const dossierNb = dirname(resolve(chemin));
  const id = `nb${k / 2 + 1}`;
  let nbImages = 0;

  const ecrireImage = (base64, ext) => {
    const nom = `${id}-${String(++nbImages).padStart(3, "0")}.${ext}`;
    writeFileSync(join(sortieDir, nom), Buffer.from(texte(base64).replace(/\s/g, ""), "base64"));
    return nom;
  };

  function sortie(o) {
    if (o.output_type === "stream") {
      const s = sortieTexte(texte(o.text));
      return s.trim() ? { t: o.name === "stderr" ? "err" : "txt", s } : null;
    }
    if (o.output_type === "error") return { t: "err", s: sortieTexte(`${o.ename}: ${o.evalue}`) };
    const d = o.data || {};
    if (d["image/png"]) return { t: "img", f: ecrireImage(d["image/png"], "png") };
    if (d["image/jpeg"]) return { t: "img", f: ecrireImage(d["image/jpeg"], "jpg") };
    if (d["image/svg+xml"]) {
      const nom = `${id}-${String(++nbImages).padStart(3, "0")}.svg`;
      writeFileSync(join(sortieDir, nom), texte(d["image/svg+xml"]));
      return { t: "img", f: nom };
    }
    if (d["text/html"]) {
      const h = texte(d["text/html"]);
      if (/<table/i.test(h)) return { t: "html", s: htmlPropre(h) };
    }
    if (d["text/markdown"]) return { t: "md", s: texte(d["text/markdown"]) };
    if (d["text/latex"]) return { t: "md", s: texte(d["text/latex"]) };
    if (d["text/plain"]) {
      const s = sortieTexte(texte(d["text/plain"]));
      // repr d'objets matplotlib sans intérêt (« <Figure size 640x480 with 1 Axes> »)
      if (/^<(Figure|matplotlib\.)[^>]*>$/.test(s.trim())) return null;
      return { t: "txt", s };
    }
    return null;
  }

  function markdown(c) {
    let s = texte(c.source);
    for (const [nom, contenu] of Object.entries(c.attachments || {})) {
      const [type, donnees] = Object.entries(contenu)[0];
      const f = ecrireImage(donnees, type.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg"));
      s = s.split(`attachment:${nom}`).join(f);
    }
    // images locales du dossier du notebook (ex. ./holidays.jpg) : copiées à côté
    s = s.replace(/(<img[^>]*\ssrc=["']|!\[[^\]]*\]\()([^"')\s]+)/g, (tout, debut, src) => {
      if (/^(data:|https?:|nb\d+-)/.test(src)) return tout;
      const source = join(dossierNb, decodeURIComponent(src));
      if (!existsSync(source)) return tout;
      const nom = `${id}-${String(++nbImages).padStart(3, "0")}${extname(source).toLowerCase()}`;
      copyFileSync(source, join(sortieDir, nom));
      return debut + nom;
    });
    return { t: "md", s };
  }

  const cellules = [];
  for (const c of nb.cells) {
    if (c.cell_type === "markdown") {
      const m = markdown(c);
      if (m.s.trim()) cellules.push(m);
    } else if (c.cell_type === "code") {
      const s = texte(c.source).replace(/\s+$/, "");
      if (!s) continue;
      const o = (c.outputs || []).map(sortie).filter(Boolean);
      cellules.push({ t: "code", s, ...(c.execution_count ? { n: c.execution_count } : {}), ...(o.length ? { o } : {}) });
    }
  }

  writeFileSync(join(sortieDir, `${id}.json`), JSON.stringify({ titre, cellules }));
  liste.push({ fichier: `${id}.json`, titre, ...(correction ? { correction: true } : {}) });
  const nbCode = cellules.filter((c) => c.t === "code").length;
  const nbSorties = cellules.filter((c) => c.o).length;
  console.log(`${id} « ${titre} »${correction ? " (correction)" : ""} : ${nbCode} blocs de code, ${nbSorties} avec résultat, ${nbImages} images`);
}

writeFileSync(join(sortieDir, "notebooks.json"), JSON.stringify({ notebooks: liste }, null, 2) + "\n");
console.log(`→ ${join(sortieDir, "notebooks.json")}`);
