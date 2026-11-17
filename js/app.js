// Navigation du site (routes dans le # de l'URL) :
//   #/                     accueil, liste des matières
//   #/m/<matiere>          cours, TDs, examen et erreurs d'une matière
//   #/q/<matiere>/<doc>    QCM d'un cours ou d'un TD
//   #/d/<matiere>/<doc>    document sans QCM : énoncé, aide (cours, fiche), correction
//   #/lire/<matiere>/<doc>/<fichier>[/<page>]  un PDF du site dans le lecteur intégré
//   #/examen/<matiere>/<n> examen de n questions sur toute la matière
//   #/erreurs/<matiere>    questions ratées de la matière
//   #/examens              liste des exams du semestre

import { echapper } from "./rendu.js";
import { erreursDe, oublierErreurs } from "./erreurs.js";
import {
  ErreurContenu,
  chargerIndex,
  chargerExamens,
  chargerNouveautes,
  trouverMatiere,
  questionsDuDocument,
  questionsDeLaMatiere,
  tirerExamen,
  urlPdf,
  urlFiche,
  urlCorrige,
} from "./donnees.js";
import { lancerQuiz } from "./quiz.js";
import { icones } from "./icones.js";
import { pageExamens, prochainExamen, epreuvesDatees, texteCompteARebours } from "./examens.js";
import { boutonMenu, rendreNav } from "./nav.js";
import { monterLecteur } from "./lecteur.js";
import "./ambiance.js";

const app = document.getElementById("app");
const TAILLES_EXAMEN = [20, 40, 60];

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const totalQuestions = (matiere) => matiere.documents.reduce((n, d) => n + d.nbQuestions, 0);
const numero = (doc) => (doc.id.match(/^(?:cours|td|revision)(\d+)/) || [])[1] || "";
const PREFIXES_NUMERO = { td: "TD", revision: "R", cours: "" };

const barreRetour = (href, libelle) => `
  <header class="barre">
    <a class="bouton-icone" href="${href}" aria-label="${echapper(libelle)}">${icones.retour}</a>
    ${boutonMenu()}
  </header>`;

// Une teinte par matière (angle OKLCH), dans l'ordre de la liste : couleurs stables et distinctes.
const TEINTES = [264, 28, 160, 80, 320, 205, 120, 350];
const CLE_NOUVEAUTES = "revisator:nouveautes-vues";
const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const dateVersion = (texte) => {
  const [a, m, j] = texte.split("-").map(Number);
  return DATE_COURTE.format(new Date(a, m - 1, j));
};

function salutation() {
  const h = new Date().getHours();
  if (h < 5 || h >= 18) return "Bonsoir";
  return "Bonjour";
}

function ligneNouveaute(ajout) {
  const texte = typeof ajout === "string" ? ajout : ajout.texte;
  const lien = typeof ajout === "object" && ajout.lien;
  return `<li>${
    lien
      ? `<a href="${echapper(lien)}">${echapper(texte)}<span class="chevron">${icones.suivant}</span></a>`
      : `<span>${echapper(texte)}</span>`
  }</li>`;
}

// Encadré « Nouveautés » : la dernière version en clair, les précédentes repliées.
// Le badge « Nouveau » s'affiche tant que la dernière version n'a pas été vue sur cet appareil.
function blocNouveautes(versions) {
  if (versions.length === 0) return "";
  const [derniere, ...anciennes] = versions;
  let vue = null;
  try {
    vue = localStorage.getItem(CLE_NOUVEAUTES);
    localStorage.setItem(CLE_NOUVEAUTES, derniere.date);
  } catch {}
  const inedite = vue !== derniere.date;
  return `
    <section class="nouveautes${inedite ? " inedite" : ""}" aria-labelledby="titre-nouveautes">
      <div class="nouveautes-tete">
        <span class="nouveautes-icone" aria-hidden="true">${icones.etincelle}</span>
        <div class="nouveautes-titres">
          <h2 id="titre-nouveautes">Nouveautés</h2>
          <p class="meta">Version du ${dateVersion(derniere.date)}</p>
        </div>
        ${inedite ? `<span class="badge-nouveau">Nouveau</span>` : ""}
      </div>
      ${derniere.titre ? `<p class="nouveautes-titre-version">${echapper(derniere.titre)}</p>` : ""}
      <ul class="nouveautes-liste">${derniere.ajouts.map(ligneNouveaute).join("")}</ul>
      ${
        anciennes.length > 0
          ? `<details class="nouveautes-anciennes">
              <summary>Versions précédentes</summary>
              ${anciennes
                .map(
                  (v) => `
                <div class="nouveautes-version">
                  <p class="nouveautes-date">${dateVersion(v.date)}${v.titre ? ` · ${echapper(v.titre)}` : ""}</p>
                  <ul class="nouveautes-liste">${v.ajouts.map(ligneNouveaute).join("")}</ul>
                </div>`
                )
                .join("")}
            </details>`
          : ""
      }
    </section>`;
}

function carteMatiere(m, i, examens) {
  const nbErreurs = erreursDe(m.id).length;
  const compte = (type) => m.documents.filter((d) => d.document === type).length;
  const details = [
    compte("cours") && `${compte("cours")} cours`,
    compte("td") && `${compte("td")} TD`,
    compte("revision") && pluriel(compte("revision"), "révision"),
  ].filter(Boolean);
  const exam = examens && epreuvesDatees(examens).find((e) => e.jours >= 0 && e.ex.revision === m.id);
  const nbQuestions = totalQuestions(m);
  return `
    <li>
      <a class="carte-matiere" href="#/m/${m.id}" style="--teinte: ${TEINTES[i % TEINTES.length]}">
        <span class="carte-haut">
          <span class="monogramme" aria-hidden="true">${echapper(m.nom.charAt(0).toUpperCase())}</span>
          <span class="chevron">${icones.suivant}</span>
        </span>
        <span class="carte-titre">${echapper(m.nom)}</span>
        <span class="meta">${details.length > 0 ? echapper(details.join(" · ")) : pluriel(m.documents.length, "document")}</span>
        <span class="carte-bas">
          ${nbQuestions > 0 ? `<span class="puce">${pluriel(nbQuestions, "question")}</span>` : ""}
          ${exam ? `<span class="puce ${exam.jours <= 7 ? "puce-urgente" : ""}">Exam ${texteCompteARebours(exam.jours)}</span>` : ""}
          ${nbErreurs > 0 ? `<span class="puce puce-erreurs">${nbErreurs} à revoir</span>` : ""}
        </span>
      </a>
    </li>`;
}

async function accueil() {
  const [{ matieres }, examens, versions] = await Promise.all([chargerIndex(), chargerExamens(), chargerNouveautes()]);
  const prochain = examens && prochainExamen(examens);
  const nbQuestions = matieres.reduce((n, m) => n + totalQuestions(m), 0);
  const aujourdhui = DATE_LONGUE.format(new Date());
  document.title = "Revisator";
  app.innerHTML = `
    <div class="accueil">
      <header class="accueil-entete apparition">
        <div class="accueil-haut mobile-seulement">
          <p class="logo">Revisator</p>
          ${boutonMenu()}
        </div>
        <p class="accueil-date">${salutation()} · ${aujourdhui.charAt(0).toUpperCase() + aujourdhui.slice(1)}</p>
        <h1>Qu'est-ce qu'on révise <span class="accent">aujourd'hui</span> ?</h1>
        <div class="accueil-chiffres">
          <span><strong>${matieres.length}</strong> ${matieres.length > 1 ? "matières" : "matière"}</span>
          <span><strong>${nbQuestions}</strong> questions</span>
          ${
            prochain
              ? `<a class="accueil-exam" href="#/examens">${icones.calendrier}<span>Prochain exam : <strong>${echapper(prochain.ex.matiere)}</strong>, ${texteCompteARebours(prochain.jours)}</span></a>`
              : examens
                ? `<a class="accueil-exam" href="#/examens">${icones.calendrier}<span>Liste des exams</span></a>`
                : ""
          }
        </div>
      </header>

      <div class="accueil-colonnes">
        <aside class="accueil-cote apparition">${blocNouveautes(versions)}</aside>
        <section class="accueil-matieres apparition" aria-labelledby="titre-matieres">
          <h2 class="titre-section" id="titre-matieres">Matières</h2>
          ${
            matieres.length === 0
              ? `<p class="vide">Aucune matière pour l'instant. Ajoute un dossier dans <code>contenu/</code> pour commencer.</p>`
              : `<ul class="liste grille-matieres">${matieres.map((m, i) => carteMatiere(m, i, examens)).join("")}</ul>`
          }
        </section>
      </div>
    </div>`;
}

function ligneDocument(matiere, doc) {
  const sansQcm = doc.nbQuestions === 0;
  const meta = !sansQcm
    ? pluriel(doc.nbQuestions, "question")
    : doc.document === "td"
      ? "Énoncé, aide et correction"
      : "Cours et fiche";
  return `
    <div class="doc">
      <a class="ligne" href="#/${sansQcm ? "d" : "q"}/${matiere.id}/${doc.id}">
        <span class="numero ${doc.document}" aria-hidden="true">${PREFIXES_NUMERO[doc.document]}${numero(doc)}</span>
        <span class="ligne-corps">
          <span class="ligne-titre">${echapper(doc.titre)}</span>
          <span class="meta">${meta}</span>
        </span>
        <span class="chevron">${icones.suivant}</span>
      </a>
      ${
        doc.fiche
          ? `<a class="bouton-fiche" href="${routePdf(matiere.id, doc.id, "fiche.pdf")}" aria-label="Fiche de révision de ${echapper(doc.titre)}">${icones.fiche}<span>Fiche</span></a>`
          : ""
      }
      ${
        // sans QCM, la correction se découvre sur la page de l'exercice, pas directement depuis la liste
        doc.corrige && !sansQcm
          ? `<a class="bouton-fiche" href="${routePdf(matiere.id, doc.id, "corrige.pdf")}" aria-label="Corrigé de ${echapper(doc.titre)}">${icones.corrige}<span>Corrigé</span></a>`
          : ""
      }
      ${
        doc.schema
          ? `<a class="bouton-fiche" href="${routePdf(matiere.id, doc.id, "schema.pdf")}" aria-label="Schéma de ${echapper(doc.titre)}">${icones.schema}<span>Schéma</span></a>`
          : ""
      }
      ${
        doc.pdf
          ? `<a class="bouton-icone bouton-pdf" href="${routePdf(matiere.id, doc.id, "document.pdf")}" aria-label="Ouvrir le PDF du cours ${echapper(doc.titre)}">${icones.document}</a>`
          : ""
      }
    </div>`;
}

async function pageMatiere(idMatiere) {
  const matiere = await trouverMatiere(idMatiere);
  document.title = `${matiere.nom} · Revisator`;

  const cours = matiere.documents.filter((d) => d.document === "cours");
  const tds = matiere.documents.filter((d) => d.document === "td");
  const revisions = matiere.documents.filter((d) => d.document === "revision");
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
        revisions.length > 0 ? `${revisions.length} révision${revisions.length > 1 ? "s" : ""}` : "",
        total > 0 ? pluriel(total, "question") : "",
      ]
        .filter(Boolean)
        .join(" · ")}</p>
    </header>

    <div class="disposition-matiere apparition">
    <aside class="panneau-matiere">
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
    </aside>

    <div class="contenu-matiere">
    ${
      revisions.length > 0
        ? `<section class="section-revision">
            <h2 class="titre-section">Révision examen</h2>
            <ul class="liste">${revisions.map((r) => `<li>${ligneDocument(matiere, r)}</li>`).join("")}</ul>
          </section>`
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
    </div>
    </div>`;

  app.querySelector(".bloc-examen")?.addEventListener("submit", (e) => {
    e.preventDefault();
    location.hash = `#/examen/${matiere.id}/${new FormData(e.target).get("taille")}`;
  });
}

// Ouvre un PDF du site dans le lecteur intégré (jamais dans un nouvel onglet).
const routePdf = (idMatiere, idDoc, fichier, page) =>
  `#/lire/${idMatiere}/${idDoc}/${fichier}${page ? `/${page}` : ""}`;

// Page d'un document sans QCM : les onglets au-dessus (énoncé, cours, fiche, correction)
// et le document choisi en grand dans le lecteur. Pour un TD, la correction reste masquée
// tant qu'on ne demande pas à la voir.
async function pageDocument(idMatiere, idDoc) {
  const matiere = await trouverMatiere(idMatiere);
  const doc = matiere.documents.find((d) => d.id === idDoc);
  if (!doc) throw new ErreurContenu(`Document « ${idDoc} » introuvable dans ${matiere.nom}.`);
  document.title = `${doc.titre} · Revisator`;

  const td = doc.document === "td";
  const cours = td ? matiere.documents.find((d) => d.id === doc.cours) : doc;
  const fichier = (d, nom) => `contenu/${matiere.id}/${d.id}/${nom}`;

  const onglets = [];
  const parExercice = td && doc.nbExercices > 0;
  if (parExercice) onglets.push({ libelle: "Exercices", exercices: true });
  if (td && doc.pdf) onglets.push({ libelle: parExercice ? "Énoncé complet" : "Énoncé", url: urlPdf(matiere.id, doc.id) });
  if (cours?.pdf) onglets.push({ libelle: "Cours", url: urlPdf(matiere.id, cours.id) });
  for (const c of cours?.complements || []) onglets.push({ libelle: c.titre, url: fichier(cours, c.fichier) });
  if (cours?.fiche) onglets.push({ libelle: "Fiche du chapitre", url: urlFiche(matiere.id, cours.id) });
  if (td && doc.fiche) onglets.push({ libelle: "Fiche de révision", url: urlFiche(matiere.id, doc.id) });
  if (td && !cours) {
    // sujet transversal (révision d'examen) : toutes les fiches de chapitre peuvent servir
    for (const c of matiere.documents.filter((d) => d.document === "cours" && d.fiche)) {
      onglets.push({ libelle: `Fiche : ${c.titre}`, url: urlFiche(matiere.id, c.id) });
    }
  }
  if (td && doc.corrige) {
    onglets.push({ libelle: parExercice ? "Correction complète" : "Correction", url: urlCorrige(matiere.id, doc.id), masquee: true });
  }

  const exercices = td ? [] : matiere.documents.filter((d) => d.document === "td" && d.cours === doc.id);

  app.innerHTML = `
    ${barreRetour(`#/m/${matiere.id}`, `Retour à ${matiere.nom}`)}
    <header class="entete-page">
      <p class="surtitre">${echapper(matiere.nom)}${td && cours ? ` · ${echapper(cours.titre)}` : ""}</p>
      <h1>${echapper(doc.titre)}</h1>
      ${
        exercices.length > 0
          ? `<p class="exercices-lies">Exercices du chapitre :
              ${exercices.map((e) => `<a href="#/d/${matiere.id}/${e.id}">${echapper(e.titre)}</a>`).join("")}</p>`
          : ""
      }
    </header>
    ${
      onglets.length > 0
        ? `<div class="onglets" role="tablist" aria-label="Documents">
            ${onglets
              .map(
                (o, i) => `<button type="button" role="tab" class="onglet${o.masquee ? " onglet-correction" : ""}" data-onglet="${i}" aria-selected="false">${o.masquee ? icones.cadenas : ""}${echapper(o.libelle)}</button>`
              )
              .join("")}
          </div>
          <div class="zone-document" role="tabpanel"></div>`
        : `<p class="vide">Aucun document pour l'instant.</p>`
    }`;

  const zone = app.querySelector(".zone-document");
  let correctionVue = false;

  const ouvrir = (i) => {
    const o = onglets[i];
    app.querySelectorAll(".onglet").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.onglet === String(i))));
    if (o.masquee && !correctionVue) {
      zone.innerHTML = `
        <div class="voile-correction">
          <p class="voile-titre">La correction est prête.</p>
          <p class="meta">Cherche l'exercice jusqu'au bout avant de la regarder : c'est comme ça qu'on retient.</p>
          <button type="button" class="btn principal" data-afficher>Afficher la correction</button>
        </div>`;
      zone.querySelector("[data-afficher]").addEventListener("click", () => {
        correctionVue = true;
        app.querySelector(".onglet-correction")?.querySelector(".icone")?.remove();
        ouvrir(i);
      });
      return;
    }
    if (o.exercices) afficherExercices(zone, matiere, doc);
    else monterLecteur(zone, { url: o.url });
  };

  app.querySelector(".onglets")?.addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-onglet]");
    if (bouton) ouvrir(Number(bouton.dataset.onglet));
  });
  if (onglets.length > 0) ouvrir(0);
}

// Une image découpée d'un énoncé ou d'une correction, avec ses liens (pastilles vers les fiches).
const imageExercice = (dossier, img, legende) => `
  <div class="exo-image" style="aspect-ratio: ${img.largeur} / ${img.hauteur}; max-width: ${img.largeur}px">
    <img src="${dossier}/${img.image}" alt="${echapper(legende)}" loading="lazy" width="${img.largeur}" height="${img.hauteur}">
    ${(img.liens || [])
      .map((l) => `<a class="lecteur-lien" href="${l.href}" style="left:${l.x}%;top:${l.y}%;width:${l.l}%;height:${l.h}%" aria-label="Ouvrir la fiche"></a>`)
      .join("")}
  </div>`;

// Les exercices d'un TD un par un : l'énoncé, puis un bouton qui révèle la correction juste en dessous.
async function afficherExercices(zone, matiere, doc) {
  const dossier = `contenu/${matiere.id}/${doc.id}`;
  zone.innerHTML = `<p class="meta chargement">Chargement des exercices…</p>`;
  let exercices;
  try {
    ({ exercices } = await (await fetch(`${dossier}/exercices.json`, { cache: "no-cache" })).json());
  } catch {
    zone.innerHTML = `<p class="vide">Impossible de charger les exercices. Les onglets « Énoncé complet » et « Correction complète » restent disponibles.</p>`;
    return;
  }
  if (!zone.isConnected) return;

  zone.innerHTML = `<div class="exos">
    ${
      exercices.length > 1
        ? `<nav class="exos-sommaire" aria-label="Aller à un exercice">
            ${exercices.map((e) => `<a href="#exo-${e.numero}" data-aller="${e.numero}" title="${echapper(e.titre)}">${e.numero}</a>`).join("")}
          </nav>`
        : ""
    }
    ${exercices
      .map(
        (e, i) => `
      <article class="exo" id="exo-${e.numero}">
        <h2 class="exo-titre"><span class="exo-numero">${e.numero}</span>${echapper(e.titre)}</h2>
        <div class="exo-pages">${e.enonce.map((img) => imageExercice(dossier, img, `Énoncé de l'exercice ${e.numero}`)).join("")}</div>
        ${
          e.correction.length > 0
            ? `<button type="button" class="btn exo-bouton" data-correction="${e.numero}" aria-expanded="false">${icones.cadenas}Voir la correction</button>
              <section class="exo-correction" id="correction-${e.numero}" hidden>
                <h3 class="exo-sous-titre">Correction de l'exercice ${e.numero}</h3>
                <div class="exo-pages">${e.correction.map((img) => imageExercice(dossier, img, `Correction de l'exercice ${e.numero}`)).join("")}</div>
                ${i + 1 < exercices.length ? `<a class="exo-suivant" href="#exo-${exercices[i + 1].numero}" data-aller="${exercices[i + 1].numero}">Exercice suivant${icones.suivant}</a>` : ""}
              </section>`
            : ""
        }
      </article>`
      )
      .join("")}</div>`;

  // écouteur posé sur le contenu recréé à chaque affichage (la zone, elle, est réutilisée par les onglets)
  zone.querySelector(".exos").addEventListener("click", (ev) => {
    // les ancres internes ne doivent pas changer la route (#/d/...) : on défile simplement
    const aller = ev.target.closest("[data-aller]");
    if (aller) {
      ev.preventDefault();
      zone.querySelector(`#exo-${aller.dataset.aller}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const bouton = ev.target.closest("[data-correction]");
    if (!bouton) return;
    const section = zone.querySelector(`#correction-${bouton.dataset.correction}`);
    const ouvrir = section.hidden;
    section.hidden = !ouvrir;
    bouton.setAttribute("aria-expanded", String(ouvrir));
    bouton.innerHTML = ouvrir ? "Masquer la correction" : `${icones.cadenas}Voir la correction`;
    if (ouvrir) section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// Un PDF du site en plein écran dans le lecteur : #/lire/<matiere>/<doc>/<fichier>[/<page>]
async function pageLecture(idMatiere, idDoc, nomFichier, page) {
  const matiere = await trouverMatiere(idMatiere);
  const doc = matiere.documents.find((d) => d.id === idDoc);
  if (!doc || !/^[\w.-]+\.pdf$/i.test(nomFichier || "")) {
    throw new ErreurContenu("Ce document n'existe pas.");
  }
  const noms = {
    "document.pdf": doc.document === "td" ? "Énoncé" : "Cours",
    "fiche.pdf": "Fiche de révision",
    "corrige.pdf": "Correction",
    "schema.pdf": "Schéma",
  };
  const libelle = noms[nomFichier] || doc.complements?.find((c) => c.fichier === nomFichier)?.titre || nomFichier;
  document.title = `${libelle} · ${doc.titre} · Revisator`;

  app.innerHTML = `
    ${barreRetour(`#/m/${matiere.id}`, "Revenir en arrière")}
    <header class="entete-page">
      <p class="surtitre">${echapper(matiere.nom)} · ${echapper(doc.titre)}</p>
      <h1>${echapper(libelle)}</h1>
    </header>
    <div class="zone-document"></div>`;

  // le bouton retour revient là d'où l'on vient (QCM, exercice, liste) plutôt qu'à la matière
  app.querySelector(".barre .bouton-icone").addEventListener("click", (e) => {
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
  monterLecteur(app.querySelector(".zone-document"), {
    url: `contenu/${matiere.id}/${doc.id}/${nomFichier}`,
    page: Number(page) || 1,
  });
}

async function listeExamens() {
  const examens = await chargerExamens();
  if (!examens) throw new ErreurContenu("Aucune liste d'exams : crée le fichier contenu/examens.json.");
  document.title = "Exams · Revisator";
  app.innerHTML = barreRetour("#/", "Retour à l'accueil") + `<div class="page-examens">${pageExamens(examens)}</div>`;
}

async function quizDocument(idMatiere, idDoc) {
  const matiere = await trouverMatiere(idMatiere);
  const doc = matiere.documents.find((d) => d.id === idDoc);
  if (!doc) throw new ErreurContenu(`Document « ${idDoc} » introuvable dans ${matiere.nom}.`);
  document.title = `${doc.titre} · Revisator`;
  app.classList.toggle("theme-revision", doc.document === "revision");
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
    d: pageDocument,
    lire: pageLecture,
    examen: quizExamen,
    erreurs: quizErreurs,
    examens: listeExamens,
  };
  const vue = vues[route] || accueil;
  app.classList.remove("theme-revision");
  app.classList.toggle("page-lecture", route === "lire" || route === "d");
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
