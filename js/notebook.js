// Affiche un notebook Jupyter importé par scripts/importer-notebooks.js : texte (Markdown + formules),
// code coloré, et les résultats enregistrés (texte, tableaux, graphiques). Rien n'est exécuté.
// marked, KaTeX et highlight.js sont hébergés dans js/vendor/ et chargés à la première ouverture.

import { echapper } from "./rendu.js";

const VENDOR = new URL("./vendor/", import.meta.url).href;
let bibliotheques;

const script = (src) =>
  new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => ko(new Error(`Impossible de charger ${src}`));
    document.head.append(s);
  });

function chargerBibliotheques() {
  if (!bibliotheques) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${VENDOR}katex/katex.min.css`;
    document.head.append(css);
    bibliotheques = Promise.all([
      script(`${VENDOR}marked/marked.min.js`),
      script(`${VENDOR}katex/katex.min.js`),
      script(`${VENDOR}highlight/highlight.min.js`),
    ]).catch((e) => {
      bibliotheques = null;
      throw e;
    });
  }
  return bibliotheques;
}

// Les formules ($…$, $$…$$, \[…\], \(…\)) sont mises de côté avant marked, sinon il transforme
// leurs _ et * en italique ; les blocs de code Markdown, eux, sont laissés intacts.
function markdownVersHtml(source) {
  const formules = [];
  const garder = (f, bloc) => (formules.push([f, bloc]), `@@F${formules.length - 1}@@`);
  const morceaux = source.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  const protege = morceaux
    .map((m, i) =>
      i % 2 === 1
        ? m
        : m
            .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => garder(f, true))
            .replace(/\\\[([\s\S]+?)\\\]/g, (_, f) => garder(f, true))
            .replace(/\\\(([\s\S]+?)\\\)/g, (_, f) => garder(f, false))
            .replace(/(^|[^\\])\$([^$\n]+?)\$/g, (_, avant, f) => avant + garder(f, false))
    )
    .join("");
  const html = window.marked.parse(protege);
  return html.replace(/@@F(\d+)@@/g, (_, i) => {
    const [f, bloc] = formules[Number(i)];
    try {
      return window.katex.renderToString(f, { displayMode: bloc, throwOnError: false, strict: false });
    } catch {
      return echapper(f);
    }
  });
}

const coloration = (code) => {
  try {
    return window.hljs.highlight(code, { language: "python", ignoreIllegals: true }).value;
  } catch {
    return echapper(code);
  }
};

function sortieHtml(o, dossier) {
  if (o.t === "img") return `<img class="nb-figure" src="${dossier}/${o.f}" alt="Graphique produit par le code" loading="lazy">`;
  if (o.t === "html") return `<div class="nb-tableau">${o.s}</div>`;
  if (o.t === "md") return `<div class="nb-md">${markdownVersHtml(o.s)}</div>`;
  return `<pre class="nb-sortie${o.t === "err" ? " nb-erreur" : ""}">${echapper(o.s)}</pre>`;
}

function celluleHtml(c, i, dossier) {
  if (c.t === "md") return `<div class="nb-md">${markdownVersHtml(c.s)}</div>`;
  return `
    <div class="nb-code">
      <div class="nb-code-entete">
        <span class="nb-numero">${c.n ? `[${c.n}]` : "[ ]"}</span>
        <button type="button" class="nb-copier" data-copier="${i}">Copier</button>
      </div>
      <pre><code class="hljs">${coloration(c.s)}</code></pre>
      ${
        c.o
          ? `<div class="nb-sorties"><span class="nb-sorties-libelle">Résultat</span>${c.o.map((o) => sortieHtml(o, dossier)).join("")}</div>`
          : ""
      }
    </div>`;
}

const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const normaliser = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// En-tête orange « À réviser pour l'exam » d'un cours ou d'un TD (a-reviser.json), d'après la page
// « Contrôle final » du site du cours. Avec points: true, la liste des points à revoir est affichée.
export function bandeauReviser(r, { points = false } = {}) {
  if (!r) return "";
  const prioritaire = r.priorite != null;
  return `
    <aside class="bandeau-reviser${prioritaire ? "" : " secondaire"}">
      <p class="bandeau-reviser-titre">
        ${prioritaire ? `À réviser pour l'exam <span class="bandeau-reviser-priorite">Priorité n°${r.priorite} sur 5</span>` : "Pas prioritaire pour l'exam"}
      </p>
      <p>${echapper(r.resume || "")}</p>
      ${points && r.points?.length ? `<ul>${r.points.map((p) => `<li>${echapper(p)}</li>`).join("")}</ul>` : ""}
      ${r.horsProgramme?.length ? `<p class="bandeau-reviser-hors"><strong>Hors programme :</strong> ${r.horsProgramme.map(echapper).join(" · ")}</p>` : ""}
    </aside>`;
}

// Regroupe le contenu en zones : les sections à réviser (orange) et hors programme (grisées) sont
// encadrées, du titre jusqu'au titre suivant de même niveau ou de niveau supérieur.
function zoner(contenu, cibles) {
  if (cibles.length === 0) return;
  const trouver = (titre) => {
    const t = normaliser(titre);
    return cibles.find((c) => t.startsWith(normaliser(c.titre))) || null;
  };
  const blocs = [];
  for (const cellule of [...contenu.children]) {
    if (cellule.classList.contains("nb-md")) for (const el of [...cellule.children]) blocs.push({ el, md: true });
    else blocs.push({ el: cellule, md: false });
  }
  contenu.replaceChildren();
  const pile = [];
  let cibleCourante = null;
  let conteneur = contenu;
  let mdCourant = null;
  for (const b of blocs) {
    if (b.md && /^H[1-6]$/.test(b.el.tagName)) {
      const niveau = Number(b.el.tagName[1]);
      while (pile.length && pile.at(-1).niveau >= niveau) pile.pop();
      pile.push({ niveau, cible: trouver(b.el.textContent) });
    }
    // la section la plus intérieure qui a un repère l'emporte
    const cible = [...pile].reverse().find((p) => p.cible)?.cible || null;
    if (cible !== cibleCourante) {
      cibleCourante = cible;
      mdCourant = null;
      if (cible) {
        conteneur = document.createElement("section");
        conteneur.className = `nb-zone nb-zone-${cible.type}`;
        conteneur.innerHTML = `<p class="nb-zone-etiquette">${cible.type === "hors" ? "Hors programme du contrôle" : "À réviser pour l'exam"}${cible.note ? `<span>${echapper(cible.note)}</span>` : ""}</p>`;
        contenu.append(conteneur);
      } else {
        conteneur = contenu;
      }
    }
    if (b.md) {
      if (!mdCourant || conteneur.lastElementChild !== mdCourant) {
        mdCourant = document.createElement("div");
        mdCourant.className = "nb-md";
        conteneur.append(mdCourant);
      }
      mdCourant.append(b.el);
    } else {
      mdCourant = null;
      conteneur.append(b.el);
    }
  }
}

// Affiche le notebook <dossier>/<fichier> dans la zone ; renvoie quand c'est prêt.
// aReviser (a-reviser.json du document) ajoute l'en-tête du notebook et les zones à réviser / hors programme.
export async function monterNotebook(zone, dossier, fichier, aReviser) {
  zone.innerHTML = `<p class="vide">Chargement du notebook…</p>`;
  let nb;
  try {
    const [rep] = await Promise.all([fetch(`${dossier}/${fichier}`), chargerBibliotheques()]);
    if (!rep.ok) throw new Error(`${fichier} : ${rep.status}`);
    nb = await rep.json();
  } catch (e) {
    console.error(e);
    zone.innerHTML = `<p class="vide">Impossible de charger le notebook. Vérifie ta connexion puis recharge la page.</p>`;
    return;
  }

  const sansResultat = nb.cellules.every((c) => c.t !== "code" || !c.o);
  zone.innerHTML = `
    <div class="nb">
      <article class="nb-contenu">
        ${sansResultat ? `<p class="nb-info">Énoncé à compléter : les blocs de code n'ont pas encore de résultat. Les résultats sont dans l'onglet Correction.</p>` : ""}
        ${nb.cellules.map((c, i) => celluleHtml(c, i, dossier)).join("")}
      </article>
      <nav class="nb-sommaire" aria-label="Sommaire du notebook"></nav>
    </div>`;

  const idNb = fichier.replace(/\.json$/, "");
  const infoNb = aReviser?.notebooks?.[idNb];
  zoner(zone.querySelector(".nb-contenu"), [
    ...(aReviser?.sectionsHorsProgramme || []).map((c) => ({ ...c, type: "hors" })),
    ...(aReviser?.sections || []).map((c) => ({ ...c, type: "reviser" })),
  ]);
  if (infoNb) {
    const secondaire = infoNb.statut === "secondaire";
    const titre = secondaire
      ? "Pas prioritaire pour l'exam"
      : infoNb.statut === "entier"
        ? "Tout ce notebook est à réviser"
        : "À réviser : les parties encadrées en orange";
    zone.querySelector(".nb-contenu").insertAdjacentHTML(
      "afterbegin",
      `<aside class="bandeau-reviser${secondaire ? " secondaire" : ""}">
        <p class="bandeau-reviser-titre">${titre}</p>
        <p>${echapper(infoNb.message)}</p>
        ${
          infoNb.points?.length
            ? `<ul class="bandeau-reviser-liens">${infoNb.points
                .map((p) => `<li><button type="button" data-section="${echapper(p.section)}">${echapper(p.texte)}</button></li>`)
                .join("")}</ul>`
            : ""
        }
      </aside>`
    );
  }

  // liens et images relatifs du Markdown : rattachés au dossier du notebook ; liens externes dans un nouvel onglet
  for (const img of zone.querySelectorAll(".nb-md img")) {
    const src = img.getAttribute("src") || "";
    if (!/^(data:|https?:|\/)/.test(src)) img.src = `${dossier}/${src}`;
    img.loading = "lazy";
  }
  for (const a of zone.querySelectorAll(".nb-md a[href^='http']")) {
    a.target = "_blank";
    a.rel = "noopener";
  }

  // sommaire à partir des titres (affiché à côté sur grand écran)
  const titres = [...zone.querySelectorAll(".nb-md h1, .nb-md h2, .nb-md h3")];
  const vus = new Set();
  for (const h of titres) {
    let id = `nb-${slug(h.textContent) || "titre"}`;
    while (vus.has(id)) id += "-";
    vus.add(id);
    h.id = id;
  }
  const sommaire = zone.querySelector(".nb-sommaire");
  if (titres.length >= 3) {
    sommaire.innerHTML = `<p class="nb-sommaire-titre">Sommaire</p><ol>${titres
      .map((h) => {
        const zoneH = h.closest(".nb-zone");
        const marque = zoneH ? (zoneH.classList.contains("nb-zone-hors") ? " hors" : " reviser") : "";
        return `<li class="niveau-${h.tagName[1]}${marque}"><a href="#${h.id}" data-cible="${h.id}">${echapper(h.textContent)}</a></li>`;
      })
      .join("")}</ol>`;
    // le # de l'URL sert aux routes : on fait défiler sans le changer
    sommaire.addEventListener("click", (e) => {
      const lien = e.target.closest("[data-cible]");
      if (!lien) return;
      e.preventDefault();
      document.getElementById(lien.dataset.cible)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } else {
    sommaire.remove();
  }

  zone.querySelector(".nb-contenu").addEventListener("click", async (e) => {
    // ancres internes du notebook (« #partie-2 ») : défilement, sans toucher à la route
    const ancre = e.target.closest(".nb-md a[href^='#']");
    if (ancre && !ancre.getAttribute("href").startsWith("#/")) {
      e.preventDefault();
      const cible = `nb-${slug(decodeURIComponent(ancre.getAttribute("href").slice(1)))}`;
      (document.getElementById(cible) || titres.find((h) => h.id.startsWith(cible)))?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const point = e.target.closest("[data-section]");
    if (point) {
      const cible = normaliser(point.dataset.section);
      titres.find((h) => normaliser(h.textContent).startsWith(cible))?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const bouton = e.target.closest("[data-copier]");
    if (!bouton) return;
    try {
      await navigator.clipboard.writeText(nb.cellules[Number(bouton.dataset.copier)].s);
      bouton.textContent = "Copié";
    } catch {
      bouton.textContent = "Échec";
    }
    setTimeout(() => (bouton.textContent = "Copier"), 1500);
  });
}
