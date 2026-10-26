// Chargement de contenu/index.json et des qcm.json, tirage du mode examen.

import { validerQcm, validerExamens } from "./validate.js";

let index = null;
const qcms = new Map();

export class ErreurContenu extends Error {
  constructor(message, details = []) {
    super(message);
    this.details = details;
  }
}

async function lireJson(url) {
  const rep = await fetch(url, { cache: "no-cache" });
  if (!rep.ok) throw new ErreurContenu(`Impossible de charger ${url} (${rep.status}).`);
  try {
    return await rep.json();
  } catch (e) {
    throw new ErreurContenu(`${url} n'est pas un JSON valide.`, [e.message]);
  }
}

export async function chargerIndex() {
  if (!index) {
    try {
      index = await lireJson("contenu/index.json");
    } catch (e) {
      throw new ErreurContenu(
        "Impossible de charger la liste des matières (contenu/index.json).",
        ["En local, génère-la avec : node scripts/build-index.js"]
      );
    }
  }
  return index;
}

let examens;

// contenu/examens.json est facultatif : null s'il n'existe pas.
export async function chargerExamens() {
  if (examens === undefined) {
    const rep = await fetch("contenu/examens.json", { cache: "no-cache" });
    if (!rep.ok) {
      examens = null;
    } else {
      const donnees = await rep.json().catch(() => {
        throw new ErreurContenu("contenu/examens.json n'est pas un JSON valide.");
      });
      const erreurs = validerExamens(donnees);
      if (erreurs.length > 0) throw new ErreurContenu("contenu/examens.json contient des erreurs :", erreurs);
      examens = donnees;
    }
  }
  return examens;
}

export async function trouverMatiere(idMatiere) {
  const { matieres } = await chargerIndex();
  const matiere = matieres.find((m) => m.id === idMatiere);
  if (!matiere) throw new ErreurContenu(`Matière « ${idMatiere} » introuvable.`);
  return matiere;
}

export const urlPdf = (idMatiere, idDoc) => `contenu/${idMatiere}/${idDoc}/document.pdf`;
export const urlFiche = (idMatiere, idDoc) => `contenu/${idMatiere}/${idDoc}/fiche.pdf`;
export const urlCorrige = (idMatiere, idDoc) => `contenu/${idMatiere}/${idDoc}/corrige.pdf`;

export async function chargerQcm(idMatiere, idDoc) {
  const chemin = `contenu/${idMatiere}/${idDoc}/qcm.json`;
  if (!qcms.has(chemin)) {
    const qcm = await lireJson(chemin);
    const erreurs = validerQcm(qcm);
    if (erreurs.length > 0) throw new ErreurContenu(`${chemin} contient des erreurs :`, erreurs);
    qcms.set(chemin, qcm);
  }
  return qcms.get(chemin);
}

// Toutes les questions d'un document, prêtes pour le quiz.
export async function questionsDuDocument(matiere, doc) {
  const qcm = await chargerQcm(matiere.id, doc.id);
  return qcm.questions.map((q) => ({ q, matiere, doc, cle: `${doc.id}/${q.id}` }));
}

// Questions de toute la matière, regroupées par document.
export async function questionsDeLaMatiere(matiere) {
  return Promise.all(matiere.documents.map((doc) => questionsDuDocument(matiere, doc)));
}

export function melanger(liste) {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

// Tire `taille` questions réparties au prorata de chaque document,
// avec au moins une question par document quand c'est possible.
export function tirerExamen(groupes, taille) {
  groupes = groupes.filter((g) => g.length > 0);
  const total = groupes.reduce((n, g) => n + g.length, 0);
  taille = Math.min(taille, total);

  const parts = groupes.map(() => 0);
  if (taille < groupes.length) {
    melanger(groupes.map((_, i) => i)).slice(0, taille).forEach((i) => (parts[i] = 1));
  } else {
    groupes.forEach((_, i) => (parts[i] = 1));
    for (let reste = taille - groupes.length; reste > 0; reste--) {
      // donne une question au document le plus en retard sur sa part idéale
      let meilleur = -1;
      let retardMax = -Infinity;
      groupes.forEach((g, i) => {
        const retard = (taille * g.length) / total - parts[i];
        if (parts[i] < g.length && retard > retardMax) {
          retardMax = retard;
          meilleur = i;
        }
      });
      parts[meilleur]++;
    }
  }

  // garde l'ordre du programme : document par document, questions dans l'ordre du fichier
  return groupes.flatMap((g, i) => {
    const choisies = new Set(melanger(g).slice(0, parts[i]));
    return g.filter((item) => choisies.has(item));
  });
}
