// Vérifie un qcm.json. Utilisé par le site et par scripts/build-index.js.
// Renvoie la liste des erreurs (vide si le fichier est valide).

const TYPES_DOCUMENT = ["cours", "td"];
const TYPES_QUESTION = ["unique", "multiple"];

function texteNonVide(v) {
  return typeof v === "string" && v.trim() !== "";
}

export function validerQcm(qcm) {
  const erreurs = [];

  if (typeof qcm !== "object" || qcm === null || Array.isArray(qcm)) {
    return ["le fichier doit contenir un objet JSON"];
  }
  if (!texteNonVide(qcm.matiere)) erreurs.push("« matiere » manquant ou vide");
  if (!TYPES_DOCUMENT.includes(qcm.document)) erreurs.push("« document » doit valoir \"cours\" ou \"td\"");
  if (!texteNonVide(qcm.titre)) erreurs.push("« titre » manquant ou vide");
  if (qcm.cours !== undefined) {
    if (qcm.document !== "td") erreurs.push("« cours » n'est autorisé que pour un TD");
    else if (!texteNonVide(qcm.cours)) erreurs.push("« cours » doit être un nom de dossier");
  }
  if (!Array.isArray(qcm.questions) || qcm.questions.length === 0) {
    erreurs.push("« questions » doit être une liste non vide");
    return erreurs;
  }

  const ids = new Set();
  qcm.questions.forEach((q, i) => {
    const ou = `question ${i + 1}${q && texteNonVide(q.id) ? ` (${q.id})` : ""}`;
    if (typeof q !== "object" || q === null) {
      erreurs.push(`${ou} : doit être un objet`);
      return;
    }

    if (!texteNonVide(q.id)) erreurs.push(`${ou} : « id » manquant`);
    else if (ids.has(q.id)) erreurs.push(`${ou} : « id » en double`);
    else ids.add(q.id);

    if (!TYPES_QUESTION.includes(q.type)) erreurs.push(`${ou} : « type » doit valoir "unique" ou "multiple"`);
    if (q.exercice !== undefined && !texteNonVide(q.exercice)) erreurs.push(`${ou} : « exercice » doit être un texte`);
    if (!texteNonVide(q.enonce)) erreurs.push(`${ou} : « enonce » manquant`);
    if (!texteNonVide(q.explication)) erreurs.push(`${ou} : « explication » manquante`);
    if (q.page !== undefined && !(Number.isInteger(q.page) && q.page >= 1)) {
      erreurs.push(`${ou} : « page » doit être un entier ≥ 1`);
    }

    const choixOk = Array.isArray(q.choix) && q.choix.length >= 2 && q.choix.length <= 6 && q.choix.every(texteNonVide);
    if (!choixOk) erreurs.push(`${ou} : « choix » doit contenir 2 à 6 textes`);

    if (!Array.isArray(q.reponses) || q.reponses.length === 0) {
      erreurs.push(`${ou} : « reponses » doit être une liste non vide`);
    } else {
      if (choixOk && !q.reponses.every((r) => Number.isInteger(r) && r >= 0 && r < q.choix.length)) {
        erreurs.push(`${ou} : « reponses » contient un indice hors de « choix » (on compte à partir de 0)`);
      }
      if (new Set(q.reponses).size !== q.reponses.length) erreurs.push(`${ou} : « reponses » contient un doublon`);
      if (q.type === "unique" && q.reponses.length !== 1) {
        erreurs.push(`${ou} : une question "unique" doit avoir exactement une réponse`);
      }
    }
  });

  return erreurs;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Vérifie contenu/examens.json (liste des exams du semestre).
export function validerExamens(donnees) {
  const erreurs = [];
  if (typeof donnees !== "object" || donnees === null || !Array.isArray(donnees.examens)) {
    return ["le fichier doit contenir un objet avec une liste « examens »"];
  }
  donnees.examens.forEach((ex, i) => {
    const ou = `examen ${i + 1}${ex && texteNonVide(ex.matiere) ? ` (${ex.matiere})` : ""}`;
    if (!texteNonVide(ex?.matiere)) erreurs.push(`${ou} : « matiere » manquante`);
    if (ex?.revision !== undefined && !texteNonVide(ex.revision)) {
      erreurs.push(`${ou} : « revision » doit être le nom d'un dossier de contenu/`);
    }
    if (!Array.isArray(ex?.epreuves)) {
      erreurs.push(`${ou} : « epreuves » doit être une liste (vide si inconnue)`);
      return;
    }
    ex.epreuves.forEach((ep, j) => {
      const ouEp = `${ou}, épreuve ${j + 1}`;
      if (ep.nom !== undefined && !texteNonVide(ep.nom)) erreurs.push(`${ouEp} : « nom » doit être un texte`);
      if (ep.date !== undefined && !(DATE.test(ep.date) && !isNaN(new Date(ep.date)))) {
        erreurs.push(`${ouEp} : « date » doit être au format AAAA-MM-JJ`);
      }
      if (ep.poids !== undefined && !(typeof ep.poids === "number" && ep.poids > 0 && ep.poids <= 100)) {
        erreurs.push(`${ouEp} : « poids » doit être un pourcentage entre 1 et 100`);
      }
    });
  });
  return erreurs;
}
