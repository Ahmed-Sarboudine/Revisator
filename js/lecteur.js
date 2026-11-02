// Lecteur PDF du site (PDF.js) : pages en grand les unes sous les autres, sans miniatures.
// Les pages ne sont dessinées qu'à l'approche de l'écran ; les liens du PDF restent cliquables
// et ceux qui visent un PDF du site s'ouvrent dans ce même lecteur.

import { icones } from "./icones.js";

// PDF.js 4.4.168 (pdfjs-dist, licence Apache 2.0) est hébergé dans js/vendor/pdfjs :
// un worker servi depuis le même site évite les blocages d'un worker venu d'un CDN.
const PDFJS = new URL("./vendor/pdfjs/pdf.min.mjs", import.meta.url).href;
const WORKER = new URL("./vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
const POLICES = new URL("./vendor/pdfjs/standard_fonts/", import.meta.url).href;
const ZOOMS = [0.6, 0.75, 0.9, 1, 1.25, 1.5, 2];

let bibliotheque = null;
async function pdfjs() {
  if (!bibliotheque) {
    bibliotheque = await import(PDFJS);
    bibliotheque.GlobalWorkerOptions.workerSrc = WORKER;
  }
  return bibliotheque;
}

// "https://…/Revisator/contenu/m/doc/fiche.pdf#page=3" ou "contenu/m/doc/fiche.pdf" → "#/lire/m/doc/fiche.pdf/3"
export function routeLecture(url) {
  const m = String(url).match(/(?:^|\/)contenu\/([^/]+)\/([^/]+)\/([^/#?]+\.pdf)(?:#page=(\d+))?/i);
  if (!m) return null;
  return `#/lire/${m[1]}/${m[2]}/${m[3]}${m[4] ? `/${m[4]}` : ""}`;
}

// Monte le lecteur dans `zone` et affiche le PDF `url`, en partant de la page `page`.
export async function monterLecteur(zone, { url, page = 1 }) {
  zone.innerHTML = `
    <div class="lecteur">
      <div class="lecteur-outils">
        <span class="lecteur-page" aria-live="polite">Chargement…</span>
        <div class="lecteur-zoom" role="group" aria-label="Zoom">
          <button type="button" class="bouton-icone" data-zoom="-1" aria-label="Dézoomer">${icones.moins}</button>
          <button type="button" class="lecteur-taux" data-zoom="0" aria-label="Revenir à la largeur de l'écran">100 %</button>
          <button type="button" class="bouton-icone" data-zoom="1" aria-label="Zoomer">${icones.plus}</button>
        </div>
        <a class="bouton-icone" href="${url}" download aria-label="Télécharger le PDF">${icones.telecharger}</a>
      </div>
      <div class="lecteur-pages"></div>
    </div>`;

  const conteneur = zone.querySelector(".lecteur-pages");
  const indicateur = zone.querySelector(".lecteur-page");
  const tauxZoom = zone.querySelector(".lecteur-taux");
  let zoom = 1;

  let pdf;
  try {
    const lib = await pdfjs();
    pdf = await lib.getDocument({ url, standardFontDataUrl: POLICES }).promise;
  } catch (e) {
    console.error(e);
    conteneur.innerHTML = `<p class="lecteur-erreur">Impossible d'afficher ce PDF ici. <a href="${url}" download>Le télécharger</a></p>`;
    indicateur.textContent = "";
    return;
  }
  if (!zone.isConnected) return;

  // Un emplacement par page, à la bonne proportion, pour que la longueur du document soit juste dès le départ.
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const p = await pdf.getPage(n);
    const vue = p.getViewport({ scale: 1 });
    const bloc = document.createElement("div");
    bloc.className = "lecteur-feuille";
    bloc.style.aspectRatio = `${vue.width} / ${vue.height}`;
    bloc.dataset.page = n;
    conteneur.append(bloc);
    pages.push({ n, p, vue, bloc, dessinee: 0 });
  }

  const dessiner = async (pg) => {
    const largeur = pg.bloc.clientWidth;
    if (!largeur || pg.dessinee === largeur) return;
    pg.dessinee = largeur;
    const echelle = (largeur / pg.vue.width) * Math.min(window.devicePixelRatio || 1, 2);
    const vue = pg.p.getViewport({ scale: echelle });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vue.width);
    canvas.height = Math.floor(vue.height);
    canvas.setAttribute("aria-label", `Page ${pg.n}`);
    await pg.p.render({ canvasContext: canvas.getContext("2d"), viewport: vue }).promise;
    pg.bloc.querySelector("canvas")?.remove();
    pg.bloc.prepend(canvas);
    if (!pg.liens) {
      pg.liens = true;
      ajouterLiens(pg);
    }
  };

  // Liens du PDF : calques cliquables positionnés en pourcentage de la page.
  const ajouterLiens = async (pg) => {
    for (const a of await pg.p.getAnnotations()) {
      if (a.subtype !== "Link" || !a.rect) continue;
      const [x1, y1, x2, y2] = pg.vue.convertToViewportRectangle(a.rect);
      const lien = document.createElement("a");
      lien.className = "lecteur-lien";
      Object.assign(lien.style, {
        left: `${(Math.min(x1, x2) / pg.vue.width) * 100}%`,
        top: `${(Math.min(y1, y2) / pg.vue.height) * 100}%`,
        width: `${(Math.abs(x2 - x1) / pg.vue.width) * 100}%`,
        height: `${(Math.abs(y2 - y1) / pg.vue.height) * 100}%`,
      });
      if (a.url) {
        const interne = routeLecture(a.url);
        lien.href = interne || a.url;
        if (!interne) Object.assign(lien, { target: "_blank", rel: "noopener" });
      } else if (a.dest) {
        lien.href = "#";
        lien.addEventListener("click", async (e) => {
          e.preventDefault();
          const dest = typeof a.dest === "string" ? await pdf.getDestination(a.dest) : a.dest;
          const index = dest && (await pdf.getPageIndex(dest[0]));
          pages[index]?.bloc.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else continue;
      pg.bloc.append(lien);
    }
  };

  const visibles = new Set();
  const observateur = new IntersectionObserver(
    (entrees) => {
      for (const e of entrees) {
        const pg = pages[e.target.dataset.page - 1];
        if (e.isIntersecting) {
          visibles.add(pg);
          dessiner(pg);
        } else visibles.delete(pg);
      }
    },
    { rootMargin: "1200px 0px" }
  );
  pages.forEach((pg) => observateur.observe(pg.bloc));

  // Numéro de la page la plus présente à l'écran.
  const suivi = new IntersectionObserver(
    (entrees) => {
      const pleine = entrees.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (pleine) indicateur.textContent = `Page ${pleine.target.dataset.page} / ${pdf.numPages}`;
    },
    { threshold: [0.25, 0.5, 0.75] }
  );
  pages.forEach((pg) => suivi.observe(pg.bloc));
  indicateur.textContent = `Page ${Math.min(page, pdf.numPages)} / ${pdf.numPages}`;

  const appliquerZoom = (nouveau) => {
    zoom = nouveau;
    conteneur.style.setProperty("--zoom", zoom);
    tauxZoom.textContent = `${Math.round(zoom * 100)} %`;
    requestAnimationFrame(() => visibles.forEach(dessiner));
  };
  zone.querySelector(".lecteur-zoom").addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-zoom]");
    if (!bouton) return;
    const sens = Number(bouton.dataset.zoom);
    const i = ZOOMS.indexOf(zoom);
    appliquerZoom(sens === 0 ? 1 : ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + sens))]);
  });

  // Redessine net si la largeur disponible change (rotation du téléphone, fenêtre redimensionnée).
  new ResizeObserver(() => visibles.forEach(dessiner)).observe(conteneur);

  if (page > 1) pages[Math.min(page, pdf.numPages) - 1].bloc.scrollIntoView({ block: "start" });
}
