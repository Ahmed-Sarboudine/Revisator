// Liste des exams du semestre (contenu/examens.json) : à venir, date à préciser, passés.

import { echapper } from "./rendu.js";
import { icones } from "./icones.js";

const MOIS_COURT = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const MOIS_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const JOUR_SEMAINE = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });

// "2026-11-13" -> date locale à minuit (new Date("2026-11-13") serait en UTC)
function dateLocale(texte) {
  const [a, m, j] = texte.split("-").map(Number);
  return new Date(a, m - 1, j);
}

function joursRestants(date) {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((date - aujourdhui) / 86_400_000);
}

function compteARebours(jours) {
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return "Demain";
  if (jours < 0) return `Il y a ${-jours} j`;
  return `Dans ${jours} j`;
}

const libelle = (ep) => [ep.nom, ep.poids ? `${ep.poids} %` : ""].filter(Boolean).join(" · ");

// Une ligne par épreuve, triées par date.
export function epreuvesDatees(donnees) {
  return donnees.examens
    .flatMap((ex) => ex.epreuves.filter((ep) => ep.date).map((ep) => ({ ex, ep, date: dateLocale(ep.date) })))
    .map((e) => ({ ...e, jours: joursRestants(e.date) }))
    .sort((a, b) => a.date - b.date);
}

export function prochainExamen(donnees) {
  return epreuvesDatees(donnees).find((e) => e.jours >= 0) || null;
}

export const texteCompteARebours = (jours) => compteARebours(jours).toLowerCase();

function ligneExamen({ ex, ep, date, jours }) {
  const urgence = jours >= 0 && jours <= 7 ? "proche" : "";
  const contenu = `
    <span class="exam-date">
      <span class="exam-jour">${date.getDate()}</span>
      <span class="exam-mois">${MOIS_COURT.format(date).replace(".", "")}</span>
    </span>
    <span class="ligne-corps">
      <span class="ligne-titre">${echapper(ex.matiere)}</span>
      <span class="meta">${libelle(ep) ? `${echapper(libelle(ep))} · ` : ""}<span class="jour-semaine">${JOUR_SEMAINE.format(date)}</span></span>
    </span>
    <span class="exam-compte ${urgence}">${compteARebours(jours)}</span>`;

  return ex.revision
    ? `<li><a class="exam exam-lien" href="#/m/${ex.revision}">${contenu}<span class="chevron">${icones.suivant}</span></a></li>`
    : `<li><div class="exam">${contenu}</div></li>`;
}

export function pageExamens(donnees) {
  const datees = epreuvesDatees(donnees);
  const aVenir = datees.filter((e) => e.jours >= 0);
  const passes = datees.filter((e) => e.jours < 0).reverse();
  const sansDate = donnees.examens.flatMap((ex) =>
    ex.epreuves.length === 0 ? [{ ex, ep: null }] : ex.epreuves.filter((ep) => !ep.date).map((ep) => ({ ex, ep }))
  );

  // regroupe les épreuves à venir par mois
  const parMois = [];
  for (const e of aVenir) {
    const mois = MOIS_LONG.format(e.date);
    if (parMois.at(-1)?.mois !== mois) parMois.push({ mois, items: [] });
    parMois.at(-1).items.push(e);
  }

  return `
    <header class="entete-page apparition">
      <h1>Liste des exams</h1>
      <p class="meta">${[donnees.titre, `${aVenir.length} à venir`].filter(Boolean).map(echapper).join(" · ")}</p>
    </header>
    <div class="apparition">
      ${parMois
        .map(
          ({ mois, items }) => `
        <h2 class="titre-section">${mois}</h2>
        <ul class="liste">${items.map(ligneExamen).join("")}</ul>`
        )
        .join("")}
      ${aVenir.length === 0 ? `<p class="vide">Aucun exam à venir.</p>` : ""}

      ${
        sansDate.length > 0
          ? `<h2 class="titre-section">Date à préciser</h2>
            <ul class="liste">
              ${sansDate
                .map(
                  ({ ex, ep }) => `
                <li><div class="exam exam-sans-date">
                  <span class="exam-date" aria-hidden="true"><span class="exam-jour">?</span></span>
                  <span class="ligne-corps">
                    <span class="ligne-titre">${echapper(ex.matiere)}</span>
                    <span class="meta">${ep && libelle(ep) ? echapper(libelle(ep)) : "Modalités à préciser"}</span>
                  </span>
                </div></li>`
                )
                .join("")}
            </ul>`
          : ""
      }

      ${
        passes.length > 0
          ? `<details class="exams-passes">
              <summary class="titre-section">Passés (${passes.length})</summary>
              <ul class="liste">${passes.map(ligneExamen).join("")}</ul>
            </details>`
          : ""
      }
    </div>`;
}
