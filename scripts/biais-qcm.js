// Mesure si la bonne réponse se devine à sa longueur.
// Usage : node scripts/biais-qcm.js contenu/<matiere>/<dossier>/qcm.json [...]
// Pour chaque fichier : nombre de questions « unique » dont la bonne réponse est la plus longue
// (à comparer au hasard) et rapport moyen longueur bonne / longueur fausse (viser 0,9 à 1,1).

import { readFileSync } from "node:fs";

const moyenne = (t) => t.reduce((a, b) => a + b, 0) / t.length;

for (const fichier of process.argv.slice(2)) {
  const { questions } = JSON.parse(readFileSync(fichier, "utf8"));
  const uniques = questions.filter((q) => q.type === "unique");
  const plusLongue = uniques.filter((q) => {
    const longueurs = q.choix.map((c) => c.length);
    return longueurs.indexOf(Math.max(...longueurs)) === q.reponses[0];
  }).length;
  const hasard = uniques.reduce((n, q) => n + 1 / q.choix.length, 0);
  const rapports = questions
    .filter((q) => q.reponses.length < q.choix.length)
    .map((q) => {
      const bonnes = q.reponses.map((i) => q.choix[i].length);
      const fausses = q.choix.filter((_, i) => !q.reponses.includes(i)).map((c) => c.length);
      return moyenne(bonnes) / moyenne(fausses);
    });
  console.log(
    `${fichier} : bonne = plus longue ${plusLongue}/${uniques.length} (hasard ≈ ${Math.round(hasard)}), ` +
      `longueur bonne/fausse = ${moyenne(rapports).toFixed(2)}`
  );
}
