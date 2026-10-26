// Écran de QCM : une question par écran, correction après chaque question, score à la fin.

import { echapper, markdown, markdownEnLigne } from "./rendu.js";
import { noterResultat, erreursDe } from "./erreurs.js";
import { urlPdf, melanger } from "./donnees.js";
import { icones } from "./icones.js";

const NOMS_DOCUMENT = { cours: "Cours", td: "TD" };
const LETTRES = "ABCDEF";

// options : { titre, retour, items, afficherOrigine, recommencer }
export function lancerQuiz(conteneur, options) {
  const { items } = options;
  let position = 0;
  let nbJustes = 0;

  function afficherQuestion() {
    const { q, matiere, doc } = items[position];
    const multiple = q.type === "multiple";
    const typeInput = multiple ? "checkbox" : "radio";
    // les choix sont mélangés à chaque affichage ; value garde l'indice d'origine
    const ordre = melanger(q.choix.map((_, i) => i));

    conteneur.innerHTML = `
      <header class="barre-quiz">
        <a class="bouton-icone" href="${options.retour}" aria-label="Quitter le QCM (${echapper(options.titre)})">${icones.fermer}</a>
        <div class="progression" role="progressbar" aria-label="Progression" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${position}">
          <div style="transform:scaleX(${position / items.length})"></div>
        </div>
        <span class="compteur">${position + 1}<span>/${items.length}</span></span>
      </header>
      <article class="question apparition">
        ${options.afficherOrigine ? `<p class="surtitre">${NOMS_DOCUMENT[doc.document]} · ${echapper(doc.titre)}</p>` : ""}
        ${q.exercice ? `<div class="exercice"><span class="etiquette">Exercice</span>${markdown(q.exercice)}</div>` : ""}
        ${
          q.image
            ? `<figure class="figure">
                <a href="contenu/${matiere.id}/${doc.id}/${q.image}" target="_blank" rel="noopener" aria-label="Agrandir la figure">
                  <img src="contenu/${matiere.id}/${doc.id}/${q.image}" alt="${echapper(q.legende || "Figure de l'exercice")}">
                </a>
                ${q.legende ? `<figcaption>${markdownEnLigne(q.legende)}</figcaption>` : ""}
              </figure>`
            : ""
        }
        <div class="enonce">${markdown(q.enonce)}</div>
        <p class="consigne ${multiple ? "consigne-multiple" : ""}">${multiple ? "Plusieurs réponses possibles" : "Une seule réponse"}</p>
        <form>
          <ul class="choix ${multiple ? "choix-multiple" : ""}">
            ${ordre
              .map(
                (i, position) => `
              <li>
                <label class="choix-item">
                  <input type="${typeInput}" name="choix" value="${i}">
                  <span class="choix-lettre" aria-hidden="true">${LETTRES[position]}</span>
                  <span class="choix-texte">${markdownEnLigne(q.choix[i])}</span>
                </label>
              </li>`
              )
              .join("")}
          </ul>
          <div class="correction" hidden></div>
          <div class="barre-action">
            <button type="submit" class="btn principal" disabled>Valider</button>
          </div>
        </form>
      </article>`;

    const form = conteneur.querySelector("form");
    const bouton = form.querySelector("button");
    const inputs = [...form.querySelectorAll("input")];
    let corrige = false;

    form.addEventListener("change", () => {
      bouton.disabled = !inputs.some((input) => input.checked);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (corrige) return suivante();
      corrige = true;

      const coches = inputs.filter((input) => input.checked).map((input) => Number(input.value));
      const juste = coches.length === q.reponses.length && q.reponses.every((r) => coches.includes(r));
      if (juste) nbJustes++;
      noterResultat(matiere.id, items[position].cle, juste);

      form.classList.add("corrige");
      inputs.forEach((input) => {
        input.disabled = true;
        const bonne = q.reponses.includes(Number(input.value));
        let etat = null;
        if (bonne && input.checked) etat = ["juste", icones.juste, "Bonne réponse"];
        else if (bonne) etat = ["manquee", icones.juste, multiple ? "À cocher aussi" : "La bonne réponse"];
        else if (input.checked) etat = ["fausse", icones.faux, "Mauvaise réponse"];
        if (!etat) return;
        input.closest("li").classList.add(etat[0]);
        input.parentElement
          .querySelector(".choix-texte")
          .insertAdjacentHTML("beforeend", `<span class="statut">${etat[1]}${etat[2]}</span>`);
      });

      const correction = form.querySelector(".correction");
      const lienPage =
        q.page && doc.pdf
          ? `<a class="lien-page" href="${urlPdf(matiere.id, doc.id)}#page=${q.page}" target="_blank" rel="noopener">${icones.document}Voir dans le ${doc.document === "td" ? "TD" : "cours"}, page ${q.page}${icones.externe}</a>`
          : "";
      correction.classList.add(juste ? "ok" : "ko");
      correction.innerHTML = `
        <p class="verdict">${juste ? icones.juste : icones.faux}${juste ? "Bonne réponse" : "Mauvaise réponse"}</p>
        <div class="explication">${markdown(q.explication)}</div>
        ${lienPage}`;
      correction.hidden = false;

      bouton.innerHTML = position + 1 < items.length ? `Question suivante${icones.suivant}` : "Voir le résultat";
      bouton.disabled = false;
      bouton.focus({ preventScroll: true });
      correction.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function suivante() {
    position++;
    window.scrollTo(0, 0);
    if (position < items.length) afficherQuestion();
    else afficherResultat();
  }

  function afficherResultat() {
    const ratio = nbJustes / items.length;
    const pourcent = Math.round(ratio * 100);
    const matiere = items[0].matiere;
    const nbErreurs = erreursDe(matiere.id).length;
    const message =
      pourcent === 100 ? "Sans faute !" : pourcent >= 75 ? "Très bien" : pourcent >= 50 ? "Pas mal" : "À retravailler";
    const rayon = 52;
    const perimetre = 2 * Math.PI * rayon;

    conteneur.innerHTML = `
      <header class="barre-quiz">
        <a class="bouton-icone" href="${options.retour}" aria-label="Retour à ${echapper(options.titre)}">${icones.fermer}</a>
      </header>
      <section class="resultat apparition">
        <div class="anneau" role="img" aria-label="${nbJustes} bonnes réponses sur ${items.length}">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="anneau-fond" cx="60" cy="60" r="${rayon}"/>
            <circle class="anneau-valeur" cx="60" cy="60" r="${rayon}"
              stroke-dasharray="${perimetre}" stroke-dashoffset="${perimetre * (1 - ratio)}"/>
          </svg>
          <div class="anneau-texte"><strong>${pourcent}%</strong><span>${nbJustes} / ${items.length}</span></div>
        </div>
        <h1>${message}</h1>
        <p class="meta">${echapper(options.titre)}</p>
        <div class="actions">
          <button type="button" class="btn principal" data-recommencer>Recommencer</button>
          ${nbErreurs > 0 ? `<a class="btn" href="#/erreurs/${matiere.id}">Revoir mes erreurs (${nbErreurs})</a>` : ""}
          <a class="btn btn-discret" href="#/m/${matiere.id}">Retour à ${echapper(matiere.nom)}</a>
        </div>
      </section>`;
    conteneur.querySelector("[data-recommencer]").addEventListener("click", options.recommencer);
  }

  afficherQuestion();
}
