// Questions ratées, mémorisées dans le navigateur.
// Format : { "<matiere>": ["<dossier>/<id>", ...] }

const CLE = "revisator:erreurs";

function lire() {
  try {
    return JSON.parse(localStorage.getItem(CLE)) || {};
  } catch {
    return {};
  }
}

function ecrire(toutes) {
  try {
    localStorage.setItem(CLE, JSON.stringify(toutes));
  } catch {
    // stockage indisponible (navigation privée...) : on continue sans mémoriser
  }
}

export function erreursDe(matiere) {
  return lire()[matiere] || [];
}

export function noterResultat(matiere, cle, juste) {
  const toutes = lire();
  const liste = new Set(toutes[matiere] || []);
  if (juste) liste.delete(cle);
  else liste.add(cle);
  toutes[matiere] = [...liste];
  ecrire(toutes);
}

export function oublierErreurs(matiere, cles) {
  const toutes = lire();
  toutes[matiere] = (toutes[matiere] || []).filter((c) => !cles.includes(c));
  ecrire(toutes);
}
