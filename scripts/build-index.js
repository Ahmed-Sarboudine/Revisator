// Parcourt contenu/, valide chaque qcm.json et écrit contenu/index.json.
// Usage : node scripts/build-index.js  (code de sortie 1 si un fichier est invalide)

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validerQcm, validerExamens } from "../js/validate.js";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const contenu = join(racine, "contenu");
const PREFIXE_DOSSIER = /^(cours|td)\d+-/;

const sousDossiers = (dir) =>
  readdirSync(dir)
    .filter((nom) => statSync(join(dir, nom)).isDirectory())
    .sort();

const erreurs = [];
const matieres = [];

for (const idMatiere of sousDossiers(contenu)) {
  const dirMatiere = join(contenu, idMatiere);
  let nom = idMatiere;
  const fichierMatiere = join(dirMatiere, "matiere.json");
  if (existsSync(fichierMatiere)) {
    try {
      nom = JSON.parse(readFileSync(fichierMatiere, "utf8")).nom || idMatiere;
    } catch (e) {
      erreurs.push(`${idMatiere}/matiere.json : JSON invalide (${e.message})`);
    }
  }

  const documents = [];
  for (const idDoc of sousDossiers(dirMatiere)) {
    const chemin = `${idMatiere}/${idDoc}`;
    const fichierQcm = join(dirMatiere, idDoc, "qcm.json");
    if (!PREFIXE_DOSSIER.test(idDoc)) {
      erreurs.push(`${chemin} : le dossier doit commencer par "cours01-", "td01-"…`);
      continue;
    }
    if (!existsSync(fichierQcm)) {
      erreurs.push(`${chemin} : qcm.json manquant`);
      continue;
    }

    let qcm;
    try {
      qcm = JSON.parse(readFileSync(fichierQcm, "utf8"));
    } catch (e) {
      erreurs.push(`${chemin}/qcm.json : JSON invalide (${e.message})`);
      continue;
    }
    const erreursQcm = validerQcm(qcm);
    if (erreursQcm.length > 0) {
      erreurs.push(...erreursQcm.map((err) => `${chemin}/qcm.json : ${err}`));
      continue;
    }
    for (const q of qcm.questions) {
      if (q.image && !existsSync(join(dirMatiere, idDoc, q.image))) {
        erreurs.push(`${chemin}/qcm.json : question ${q.id} : image "${q.image}" introuvable dans le dossier`);
      }
    }
    if (!idDoc.startsWith(qcm.document)) {
      erreurs.push(`${chemin}/qcm.json : « document » vaut "${qcm.document}" mais le dossier ne commence pas par "${qcm.document}"`);
    }

    documents.push({
      id: idDoc,
      document: qcm.document,
      titre: qcm.titre,
      ...(qcm.cours ? { cours: qcm.cours } : {}),
      pdf: existsSync(join(dirMatiere, idDoc, "document.pdf")),
      fiche: existsSync(join(dirMatiere, idDoc, "fiche.pdf")),
      corrige: existsSync(join(dirMatiere, idDoc, "corrige.pdf")),
      nbQuestions: qcm.questions.length,
    });
  }

  for (const doc of documents) {
    if (doc.cours && !documents.some((d) => d.id === doc.cours && d.document === "cours")) {
      erreurs.push(`${idMatiere}/${doc.id}/qcm.json : le cours "${doc.cours}" n'existe pas dans ${idMatiere}/`);
    }
  }

  matieres.push({ id: idMatiere, nom, documents });
}

const fichierExamens = join(contenu, "examens.json");
if (existsSync(fichierExamens)) {
  try {
    const examens = JSON.parse(readFileSync(fichierExamens, "utf8"));
    erreurs.push(...validerExamens(examens).map((err) => `examens.json : ${err}`));
    for (const ex of examens.examens || []) {
      if (ex.revision && !matieres.some((m) => m.id === ex.revision)) {
        erreurs.push(`examens.json : « revision » de ${ex.matiere} pointe vers contenu/${ex.revision}/ qui n'existe pas`);
      }
    }
  } catch (e) {
    erreurs.push(`examens.json : JSON invalide (${e.message})`);
  }
}

if (erreurs.length > 0) {
  console.error(`${erreurs.length} erreur(s) :\n` + erreurs.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

writeFileSync(join(contenu, "index.json"), JSON.stringify({ matieres }, null, 2) + "\n");
const total = matieres.reduce((n, m) => n + m.documents.length, 0);
console.log(`index.json généré : ${matieres.length} matière(s), ${total} document(s).`);
