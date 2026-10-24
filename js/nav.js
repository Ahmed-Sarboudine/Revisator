// Barre latérale : matières et prochains exams.
// Toujours visible sur grand écran ; tiroir ouvert par le bouton menu sur téléphone.

import { echapper } from "./rendu.js";
import { erreursDe } from "./erreurs.js";
import { chargerIndex, chargerExamens } from "./donnees.js";
import { epreuvesDatees } from "./examens.js";
import { icones } from "./icones.js";

const nav = document.getElementById("nav");
const voile = document.getElementById("voile");
const grandEcran = window.matchMedia("(min-width: 960px)");
const MOIS_COURT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export const boutonMenu = () =>
  `<button type="button" class="bouton-icone bouton-menu" aria-label="Ouvrir le menu" aria-controls="nav" aria-expanded="false">${icones.menu}</button>`;

function compte(jours) {
  if (jours === 0) return "Auj.";
  if (jours === 1) return "Demain";
  return `J-${jours}`;
}

function majAccessibilite() {
  const ouvert = nav.classList.contains("ouvert");
  // fermé sur téléphone : hors écran, donc ni focusable ni lu
  nav.inert = !grandEcran.matches && !ouvert;
  voile.hidden = grandEcran.matches || !ouvert;
  document.querySelectorAll(".bouton-menu").forEach((b) => b.setAttribute("aria-expanded", String(ouvert)));
}

export function ouvrirMenu() {
  nav.classList.add("ouvert");
  majAccessibilite();
  nav.querySelector("a")?.focus({ focusVisible: false });
}

export function fermerMenu() {
  if (!nav.classList.contains("ouvert")) return;
  nav.classList.remove("ouvert");
  majAccessibilite();
}

export async function rendreNav() {
  const [{ matieres }, examens] = await Promise.all([chargerIndex(), chargerExamens()]);
  const [vue, idMatiere] = location.hash.replace(/^#\/?/, "").split("/");
  const matiereActive = (id) => (vue !== "examens" && idMatiere === id ? ' aria-current="page"' : "");
  const aVenir = examens ? epreuvesDatees(examens).filter((e) => e.jours >= 0) : [];

  nav.innerHTML = `
    <div class="nav-entete">
      <a class="logo" href="#/">Revisator</a>
      <button type="button" class="bouton-icone nav-fermer" aria-label="Fermer le menu">${icones.fermer}</button>
    </div>

    <nav aria-label="Matières">
      <p class="nav-titre">Matières</p>
      <ul class="nav-liste">
        ${matieres
          .map((m) => {
            const nbErreurs = erreursDe(m.id).length;
            return `
            <li>
              <a class="nav-lien" href="#/m/${m.id}"${matiereActive(m.id)}>
                <span class="nav-mono" aria-hidden="true">${echapper(m.nom.charAt(0).toUpperCase())}</span>
                <span class="nav-texte">${echapper(m.nom)}</span>
                ${nbErreurs > 0 ? `<span class="nav-badge" title="${nbErreurs} à revoir">${nbErreurs}</span>` : ""}
              </a>
            </li>`;
          })
          .join("")}
      </ul>
    </nav>

    ${
      examens
        ? `<section class="nav-exams" aria-labelledby="nav-exams-titre">
            <div class="nav-titre-ligne">
              <p class="nav-titre" id="nav-exams-titre">Prochains exams</p>
              <a class="nav-tout" href="#/examens"${vue === "examens" ? ' aria-current="page"' : ""}>Tout voir</a>
            </div>
            ${aVenir.length === 0 ? `<p class="meta">Aucun exam à venir.</p>` : ""}
            <ul class="nav-liste">
              ${aVenir
                .map(({ ex, ep, date, jours }) => {
                  const contenu = `
                    <span class="nav-exam-date">${MOIS_COURT.format(date).replace(".", "")}</span>
                    <span class="nav-texte">${echapper(ex.matiere)}${ep.nom ? `<span class="nav-sous">${echapper(ep.nom)}</span>` : ""}</span>
                    <span class="nav-compte ${jours <= 7 ? "proche" : ""}">${compte(jours)}</span>`;
                  return ex.revision
                    ? `<li><a class="nav-exam" href="#/m/${ex.revision}">${contenu}</a></li>`
                    : `<li><div class="nav-exam">${contenu}</div></li>`;
                })
                .join("")}
            </ul>
          </section>`
        : ""
    }`;

  nav.querySelector(".nav-fermer").addEventListener("click", fermerMenu);
  majAccessibilite();
}

document.addEventListener("click", (e) => {
  if (e.target.closest(".bouton-menu")) ouvrirMenu();
});
voile.addEventListener("click", fermerMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fermerMenu();
});
window.addEventListener("hashchange", fermerMenu);
grandEcran.addEventListener("change", () => {
  nav.classList.remove("ouvert");
  majAccessibilite();
});
