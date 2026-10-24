// Navigation du site (routes dans le # de l'URL) :
//   #/                     accueil, liste des matières
//   #/m/<matiere>          cours, TDs, examen et erreurs d'une matière
//   #/q/<matiere>/<doc>    QCM d'un cours ou d'un TD
//   #/examen/<matiere>/<n> examen de n questions sur toute la matière
//   #/erreurs/<matiere>    questions ratées de la matière
//   #/examens              liste des exams du semestre

import { echapper } from "./rendu.js";
import { erreursDe, oublierErreurs } from "./erreurs.js";
import {
  ErreurContenu,
  chargerIndex,
  chargerExamens,
  trouverMatiere,
  questionsDuDocument,
  questionsDeLaMatiere,
  tirerExamen,
  urlPdf,
  urlFiche,
} from "./donnees.js";
import { lancerQuiz } from "./quiz.js";
import { icones } from "./icones.js";
import { pageExamens, prochainExamen, texteCompteARebours } from "./examens.js";
import { boutonMenu, rendreNav } from "./nav.js";

const app = document.getElementById("app");
const TAILLES_EXAMEN = [20, 40, 60];

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const totalQuestions = (matiere) => matiere.documents.reduce((n, d) => n + d.nbQuestions, 0);
const numero = (doc) => (doc.id.match(/^(?:cours|td)(\d+)/) || [])[1] || "";

const barreRetour = (href, libelle) => `
  <header class="barre">
    <a class="bouton-icone" href="${href}" aria-label="${echapper(libelle)}">${icones.retour}</a>
    ${boutonMenu()}
  </header>`;

async function accueil() {
  const [{ matieres }, examens] = await Promise.all([chargerIndex(), chargerExamens()]);
  const prochain = examens && prochainExamen(examens);
  document.title = "Revisator";
  app.innerHTML = `
    <header class="accueil-entete apparition">
      <div class="accueil-haut mobile-seulement">
        <p class="logo">Revisator</p>
        ${boutonMenu()}
      </div>
      <h1>Qu'est-ce qu'on révise aujourd'hui ?</h1>
    </header>
    ${
      examens
        ? `<a class="bloc bloc-lien apparition mobile-seulement" href="#/examens">
            <span class="bloc-icone">${icones.calendrier}</span>
            <span class="ligne-corps">
              <span class="ligne-titre">Liste des exams</span>
              <span class="meta">${
                prochain
                  ? `Prochain : ${echapper(prochain.ex.matiere)}, ${texteCompteARebours(prochain.jours)}`
                  : "Aucun exam à venir"
              }</span>
            </span>
            <span class="chevron">${icones.suivant}</span>
          </a>
          <h2 class="titre-section mobile-seulement">Matières</h2>`
        : ""
    }
    ${
      matieres.length === 0
        ? `<p class="vide">Aucune matière pour l'instant. Ajoute un dossier dans <code>contenu/</code> pour commencer.</p>`
        : ""
    }
    <ul class="liste apparition">
      ${matieres
        .map((m) => {
          const nbErreurs = erreursDe(m.id).length;
          return `
          <li>
            <a class="carte-matiere" href="#/m/${m.id}">
              <span class="monogramme" aria-hidden="true">${echapper(m.nom.charAt(0).toUpperCase())}</span>
              <span class="ligne-corps">
                <span class="ligne-titre">${echapper(m.nom)}</span>
                <span class="meta">${pluriel(m.documents.length, "document")} · ${pluriel(totalQuestions(m), "question")}</span>
              </span>
              ${nbErreurs > 0 ? `<span class="pastille">${nbErreurs} à revoir</span>` : ""}
              <span class="chevron">${icones.suivant}</span>
            </a>
          </li>`;
        })
        .join("")}
    </ul>`;
}

function ligneDocument(matiere, doc) {
  return `
    <div class="doc">
      <a class="ligne" href="#/q/${matiere.id}/${doc.id}">
        <span class="numero ${doc.document}" aria-hidden="true">${doc.document === "td" ? "TD" : ""}${numero(doc)}</span>
        <span class="ligne-corps">
          <span class="ligne-titre">${echapper(doc.titre)}</span>
          <span class="meta">${pluriel(doc.nbQuestions, "question")}</span>
        </span>
        <span class="chevron">${icones.suivant}</span>
      </a>
      ${
        doc.fiche
          ? `<a class="bouton-fiche" href="${urlFiche(matiere.id, doc.id)}" target="_blank" rel="noopener" aria-label="Fiche de révision de ${echapper(doc.titre)}">${icones.fiche}<span>Fiche</span></a>`
          : ""
      }
      ${
        doc.pdf
          ? `<a class="bouton-icone bouton-pdf" href="${urlPdf(matiere.id, doc.id)}" target="_blank" rel="noopener" aria-label="Ouvrir le PDF du cours ${echapper(doc.titre)}">${icones.document}</a>`
          : ""
      }
    </div>`;
}

async function pageMatiere(idMatiere) {
  const matiere = await trouverMatiere(idMatiere);
  document.title = `${matiere.nom} · Revisator`;

  const cours = matiere.documents.filter((d) => d.document === "cours");
  const tds = matiere.documents.filter((d) => d.document === "td");
  const tdsLies = (c) => tds.filter((d) => d.cours === c.id);
  const tdsSeuls = tds.filter((d) => !d.cours);
  const total = totalQuestions(matiere);
  const tailles = [...new Set(TAILLES_EXAMEN.map((t) => Math.min(t, total)))];
  const nbErreurs = erreursDe(matiere.id).length;

  app.innerHTML = `
    ${barreRetour("#/", "Retour aux matières")}
    <header class="entete-page apparition">
      <h1>${echapper(matiere.nom)}</h1>
      <p class="meta">${[
        cours.length > 0 ? `${cours.length} cours` : "",
        tds.length > 0 ? pluriel(tds.length, "TD") : "",
        pluriel(total, "question"),
      ]
        .filter(Boolean)
        .join(" · ")}</p>
    </header>

    <div class="apparition">
    ${
      total > 0
        ? `<form class="bloc bloc-examen">
            <div class="bloc-entete">
              <span class="bloc-icone">${icones.examen}</span>
              <div>
                <h2>Mode examen</h2>
                <p class="meta">Un tirage de questions dans tous les cours et TDs.</p>
              </div>
            </div>
            <fieldset class="segments">
              <legend class="sr-only">Nombre de questions</legend>
              ${tailles
                .map(
                  (t, i) => `
                <label class="segment">
                  <input type="radio" name="taille" value="${t}" ${i === 0 ? "checked" : ""}>
                  <span>${t} questions</span>
                </label>`
                )
                .join("")}
            </fieldset>
            <button type="submit" class="btn principal">Commencer l'examen</button>
          </form>`
        : ""
    }

    ${
      nbErreurs > 0
        ? `<a class="bloc bloc-lien" href="#/erreurs/${matiere.id}">
            <span class="bloc-icone bloc-icone-erreurs">${icones.erreurs}</span>
            <span class="ligne-corps">
              <span class="ligne-titre">Revoir mes erreurs</span>
              <span class="meta">${pluriel(nbErreurs, "question")} à retravailler</span>
            </span>
            <span class="chevron">${icones.suivant}</span>
          </a>`
        : ""
    }

    ${
      cours.length > 0
        ? `<h2 class="titre-section">Cours</h2>
          <ul class="liste">
            ${cours
              .map(
                (c) => `
              <li>
                ${ligneDocument(matiere, c)}
                ${
                  tdsLies(c).length > 0
                    ? `<ul class="sous-liste">${tdsLies(c).map((td) => `<li>${ligneDocument(matiere, td)}</li>`).join("")}</ul>`
                    : ""
                }
              </li>`
              )
              .join("")}
          </ul>`
        : ""
    }

    ${
      tdsSeuls.length > 0
        ? `<h2 class="titre-section">TDs</h2>
          <ul class="liste">${tdsSeuls.map((td) => `<li>${ligneDocument(matiere, td)}</li>`).join("")}</ul>`
        : ""
    }
    </div>`;

  app.querySelector(".bloc-examen")?.addEventListener("submit", (e) => {
    e.preventDefault();
    location.hash = `#/examen/${matiere.id}/${new FormData(e.target).get("taille")}`;
  });
}

async function listeExamens() {
  const examens = await chargerExamens();
  if (!examens) throw new ErreurContenu("Aucune liste d'exams : crée le fichier contenu/examens.json.");
  document.title = "Exams · Revisator";
  app.innerHTML = barreRetour("#/", "Retour à l'accueil") + pageExamens(examens);
}

async function quizDocument(idMatiere, idDoc) {
  const matiere = await trouverMatiere(idMatiere);
  const doc = matiere.documents.find((d) => d.id === idDoc);
  if (!doc) throw new ErreurContenu(`Document « ${idDoc} » introuvable dans ${matiere.nom}.`);
  document.title = `${doc.titre} · Revisator`;
  lancerQuiz(app, {
    titre: doc.titre,
    retour: `#/m/${matiere.id}`,
    items: await questionsDuDocument(matiere, doc),
    afficherOrigine: false,
    recommencer: afficherRoute,
  });
}

async function quizExamen(idMatiere, taille) {
  const matiere = await trouverMatiere(idMatiere);
  document.title = `Examen ${matiere.nom} · Revisator`;
  const items = tirerExamen(await questionsDeLaMatiere(matiere), Number(taille) || TAILLES_EXAMEN[0]);
  lancerQuiz(app, {
    titre: `Examen · ${matiere.nom}`,
    retour: `#/m/${matiere.id}`,
    items,
    afficherOrigine: true,
    recommencer: afficherRoute,
  });
}

async function quizErreurs(idMatiere) {
  const matiere = await trouverMatiere(idMatiere);
  document.title = `Erreurs ${matiere.nom} · Revisator`;
  const cles = erreursDe(matiere.id);
  const items = (await questionsDeLaMatiere(matiere)).flat().filter((item) => cles.includes(item.cle));

  // questions supprimées ou renommées depuis : on les oublie
  const disparues = cles.filter((c) => !items.some((item) => item.cle === c));
  if (disparues.length > 0) oublierErreurs(matiere.id, disparues);

  if (items.length === 0) {
    app.innerHTML = `
      ${barreRetour(`#/m/${matiere.id}`, `Retour à ${matiere.nom}`)}
      <section class="resultat apparition">
        <div class="anneau anneau-plein" aria-hidden="true">${icones.juste}</div>
        <h1>Aucune erreur à revoir</h1>
        <p class="meta">Toutes tes erreurs en ${echapper(matiere.nom)} ont été corrigées.</p>
        <div class="actions"><a class="btn principal" href="#/m/${matiere.id}">Retour à ${echapper(matiere.nom)}</a></div>
      </section>`;
    return;
  }
  lancerQuiz(app, {
    titre: `Erreurs · ${matiere.nom}`,
    retour: `#/m/${matiere.id}`,
    items,
    afficherOrigine: true,
    recommencer: afficherRoute,
  });
}

function afficherErreur(e) {
  console.error(e);
  const details = e instanceof ErreurContenu ? e.details : [];
  app.innerHTML = `
    ${barreRetour("#/", "Retour aux matières")}
    <section class="bloc bloc-erreur">
      <h2>Impossible d'afficher cette page</h2>
      <p>${echapper(e instanceof ErreurContenu ? e.message : "Une erreur inattendue est survenue.")}</p>
      ${details.length > 0 ? `<ul>${details.map((d) => `<li>${echapper(d)}</li>`).join("")}</ul>` : ""}
    </section>`;
}

async function afficherRoute() {
  const [route, ...params] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const vues = {
    "": accueil,
    m: pageMatiere,
    q: quizDocument,
    examen: quizExamen,
    erreurs: quizErreurs,
    examens: listeExamens,
  };
  const vue = vues[route] || accueil;
  try {
    await vue(...params);
  } catch (e) {
    afficherErreur(e);
  }
  window.scrollTo(0, 0);
  rendreNav().catch(console.error);
}

window.addEventListener("hashchange", afficherRoute);
afficherRoute();
