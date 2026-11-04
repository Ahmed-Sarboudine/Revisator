// Ambiance sonore pour réviser : sons de nature générés dans le navigateur (Web Audio),
// sans fichier audio. On peut en mélanger plusieurs ; le choix et le volume sont mémorisés.
// Le lecteur vit dans #ambiance, en bas de la barre latérale, et continue d'une page à l'autre.

import { icones } from "./icones.js";

const CLE = "revisator:ambiance";
const SONS = [
  { id: "pluie", nom: "Pluie" },
  { id: "orage", nom: "Orage" },
  { id: "vagues", nom: "Vagues" },
  { id: "vent", nom: "Vent" },
  { id: "feu", nom: "Feu de bois" },
  { id: "riviere", nom: "Rivière" },
  { id: "foret", nom: "Forêt" },
  { id: "brun", nom: "Bruit brun" },
];

let ctx = null;
let maitre = null;
let tampons = null;
const actifs = new Map(); // id → { arreter() }
let enLecture = false;
let reglages = lireReglages();

function lireReglages() {
  try {
    const r = JSON.parse(localStorage.getItem(CLE));
    if (r && Array.isArray(r.sons) && typeof r.volume === "number") return r;
  } catch {}
  return { sons: ["pluie"], volume: 0.6 };
}

function sauver() {
  try {
    localStorage.setItem(CLE, JSON.stringify(reglages));
  } catch {}
}

// ---------- Outils audio ----------

const hasard = (min, max) => min + Math.random() * (max - min);

function initialiser() {
  if (ctx) return;
  ctx = new AudioContext();
  const compresseur = ctx.createDynamicsCompressor();
  compresseur.threshold.value = -18;
  compresseur.ratio.value = 4;
  maitre = ctx.createGain();
  maitre.gain.value = reglages.volume;
  maitre.connect(compresseur).connect(ctx.destination);

  // 8 s de bruit blanc, rose et brun, joués en boucle
  const duree = ctx.sampleRate * 8;
  const creer = (remplir) => {
    const t = ctx.createBuffer(1, duree, ctx.sampleRate);
    remplir(t.getChannelData(0));
    return t;
  };
  tampons = {
    blanc: creer((d) => {
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }),
    rose: creer((d) => {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }),
    brun: creer((d) => {
      let dernier = 0;
      for (let i = 0; i < d.length; i++) {
        dernier = (dernier + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = dernier * 3.5;
      }
    }),
  };
}

function bruit(type) {
  const s = ctx.createBufferSource();
  s.buffer = tampons[type];
  s.loop = true;
  s.start(0, hasard(0, 7));
  return s;
}

function filtre(type, frequence, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequence;
  f.Q.value = q;
  return f;
}

function gain(valeur) {
  const g = ctx.createGain();
  g.gain.value = valeur;
  return g;
}

// Oscillation lente d'un paramètre autour de `centre` (± amplitude).
function lfo(param, frequence, centre, amplitude) {
  param.value = centre;
  const o = ctx.createOscillator();
  o.frequency.value = frequence;
  const a = gain(amplitude);
  o.connect(a).connect(param);
  o.start();
  return o;
}

// Bref éclat de bruit filtré (goutte, crépitement, tonnerre).
function eclat(type, frequence, q, volume, duree, sortie, filtreType = "bandpass", attaque = 0.002) {
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = tampons[type];
  const f = filtre(filtreType, frequence, q);
  const g = gain(0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attaque + duree);
  s.connect(f).connect(g).connect(sortie);
  s.start(t, hasard(0, 7), attaque + duree + 0.05);
}

// Crée un son : `construire(sortie, planifier)` branche ses nœuds sur `sortie` ;
// `planifier(fn, min, max)` répète fn à intervalle aléatoire (en secondes) tant que le son joue.
function son(construire) {
  const sortie = gain(0);
  sortie.connect(maitre);
  const t = ctx.currentTime;
  sortie.gain.setValueAtTime(0, t);
  sortie.gain.linearRampToValueAtTime(1, t + 1.5);
  const minuteurs = new Set();
  const sources = [];
  let vivant = true;
  const planifier = (fn, min, max) => {
    const suivant = () => {
      if (!vivant) return;
      fn();
      const id = setTimeout(suivant, hasard(min, max) * 1000);
      minuteurs.add(id);
    };
    const id = setTimeout(suivant, hasard(min, max) * 1000);
    minuteurs.add(id);
  };
  construire(sortie, planifier, (n) => (sources.push(n), n));
  return {
    arreter() {
      vivant = false;
      minuteurs.forEach(clearTimeout);
      const fin = ctx.currentTime;
      sortie.gain.cancelScheduledValues(fin);
      sortie.gain.setValueAtTime(sortie.gain.value, fin);
      sortie.gain.linearRampToValueAtTime(0, fin + 0.6);
      setTimeout(() => {
        sources.forEach((n) => {
          try {
            n.stop();
          } catch {}
        });
        sortie.disconnect();
      }, 800);
    },
  };
}

// ---------- Les sons ----------

const fabriques = {
  pluie: () =>
    son((sortie, planifier, garder) => {
      // nappe de pluie : bruit rose filtré, qui respire un peu
      const nappe = gain(0.5);
      garder(bruit("rose")).connect(filtre("highpass", 450)).connect(filtre("lowpass", 7000)).connect(nappe).connect(sortie);
      garder(lfo(nappe.gain, 0.06, 0.5, 0.08));
      // gouttes isolées sur les feuilles et les vitres
      planifier(() => eclat("blanc", hasard(2500, 6500), 4, hasard(0.04, 0.16), hasard(0.015, 0.04), sortie), 0.03, 0.12);
    }),

  orage: () =>
    son((sortie, planifier, garder) => {
      const nappe = gain(0.7);
      garder(bruit("rose")).connect(filtre("highpass", 300)).connect(filtre("lowpass", 5000)).connect(nappe).connect(sortie);
      garder(lfo(nappe.gain, 0.04, 0.7, 0.15));
      planifier(() => eclat("blanc", hasard(2000, 5000), 3, hasard(0.05, 0.2), hasard(0.02, 0.05), sortie), 0.02, 0.08);
      // tonnerre lointain : grondement grave qui roule
      planifier(() => {
        eclat("brun", hasard(90, 160), 0.5, hasard(0.6, 1), hasard(3, 6), sortie, "lowpass", hasard(0.05, 0.4));
        setTimeout(() => eclat("brun", hasard(70, 120), 0.5, hasard(0.3, 0.6), hasard(2, 4), sortie, "lowpass", 0.3), hasard(300, 1200));
      }, 12, 35);
    }),

  vagues: () =>
    son((sortie, planifier, garder) => {
      // houle : le filtre s'ouvre et le volume monte à chaque vague (~12 s)
      const passeBas = filtre("lowpass", 600);
      const niveau = gain(0.4);
      garder(bruit("brun")).connect(passeBas).connect(niveau).connect(sortie);
      const rythme = hasard(0.07, 0.09);
      garder(lfo(passeBas.frequency, rythme, 700, 450));
      garder(lfo(niveau.gain, rythme, 0.45, 0.3));
      // écume : aigus légers qui suivent la vague
      const ecume = gain(0.05);
      garder(bruit("rose")).connect(filtre("highpass", 2500)).connect(ecume).connect(sortie);
      garder(lfo(ecume.gain, rythme, 0.06, 0.05));
    }),

  vent: () =>
    son((sortie, planifier, garder) => {
      const bande = filtre("bandpass", 500, 1.2);
      const niveau = gain(0.5);
      garder(bruit("rose")).connect(bande).connect(niveau).connect(sortie);
      garder(lfo(bande.frequency, 0.05, 550, 250));
      garder(lfo(bande.frequency, 0.13, 0, 120));
      garder(lfo(niveau.gain, 0.07, 0.5, 0.25));
      // rafales
      planifier(() => {
        const t = ctx.currentTime;
        niveau.gain.cancelScheduledValues(t);
        niveau.gain.setTargetAtTime(hasard(0.6, 0.9), t, 1.2);
        niveau.gain.setTargetAtTime(0.5, t + hasard(2, 4), 2);
      }, 6, 16);
    }),

  feu: () =>
    son((sortie, planifier, garder) => {
      // ronflement du foyer
      garder(bruit("brun")).connect(filtre("lowpass", 350)).connect(gain(0.45)).connect(sortie);
      // crépitements : petits claquements secs
      planifier(() => eclat("blanc", hasard(1500, 4500), 1.5, hasard(0.08, 0.45), hasard(0.004, 0.02), sortie, "highpass", 0.001), 0.04, 0.3);
      // de temps en temps, un « pop » de bois
      planifier(() => eclat("blanc", hasard(600, 1400), 2, hasard(0.4, 0.7), hasard(0.03, 0.08), sortie, "bandpass", 0.001), 2, 7);
    }),

  riviere: () =>
    son((sortie, planifier, garder) => {
      // clapotis : plusieurs bandes de bruit dont la fréquence bouge sans cesse
      const bandes = [700, 1400, 2600].map((f) => {
        const b = filtre("bandpass", f, 2.5);
        garder(bruit("blanc")).connect(b).connect(gain(0.22)).connect(sortie);
        return { b, f };
      });
      garder(bruit("rose")).connect(filtre("lowpass", 900)).connect(gain(0.25)).connect(sortie);
      planifier(() => {
        const t = ctx.currentTime;
        for (const { b, f } of bandes) b.frequency.setTargetAtTime(f * hasard(0.7, 1.4), t, 0.05);
      }, 0.06, 0.14);
    }),

  foret: () =>
    son((sortie, planifier, garder) => {
      // fond : vent léger dans les arbres
      const fond = filtre("bandpass", 800, 0.8);
      garder(bruit("rose")).connect(fond).connect(gain(0.15)).connect(sortie);
      garder(lfo(fond.frequency, 0.05, 800, 300));
      // chants d'oiseaux : petites phrases de notes glissées
      planifier(() => {
        let t = ctx.currentTime + 0.05;
        const base = hasard(2200, 4800);
        const notes = Math.floor(hasard(2, 7));
        const volume = hasard(0.03, 0.09);
        for (let i = 0; i < notes; i++) {
          const duree = hasard(0.05, 0.16);
          const o = ctx.createOscillator();
          const g = gain(0);
          o.type = "sine";
          o.frequency.setValueAtTime(base * hasard(0.85, 1.15), t);
          o.frequency.exponentialRampToValueAtTime(base * hasard(0.7, 1.5), t + duree);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(volume, t + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
          o.connect(g).connect(sortie);
          o.start(t);
          o.stop(t + duree + 0.02);
          t += duree + hasard(0.03, 0.12);
        }
      }, 1.5, 6);
    }),

  brun: () =>
    son((sortie, planifier, garder) => {
      garder(bruit("brun")).connect(filtre("lowpass", 500)).connect(gain(0.6)).connect(sortie);
    }),
};

// ---------- Lecture ----------

function demarrer(id) {
  if (!actifs.has(id)) actifs.set(id, fabriques[id]());
}

function arreter(id) {
  actifs.get(id)?.arreter();
  actifs.delete(id);
}

async function lecture() {
  initialiser();
  if (ctx.state === "suspended") await ctx.resume();
  if (reglages.sons.length === 0) reglages.sons = ["pluie"];
  reglages.sons.forEach(demarrer);
  enLecture = true;
  sauver();
  rendre();
}

function pause() {
  [...actifs.keys()].forEach(arreter);
  enLecture = false;
  rendre();
}

function basculerSon(id) {
  const choisi = reglages.sons.includes(id);
  reglages.sons = choisi ? reglages.sons.filter((s) => s !== id) : [...reglages.sons, id];
  sauver();
  if (enLecture) {
    if (choisi) arreter(id);
    else demarrer(id);
    if (reglages.sons.length === 0) enLecture = false;
  } else if (!choisi) {
    // choisir un son quand rien ne joue lance la lecture
    lecture();
    return;
  }
  rendre();
}

// ---------- Interface ----------

const zone = document.getElementById("ambiance");

function rendre() {
  if (!zone) return;
  const noms = SONS.filter((s) => reglages.sons.includes(s.id)).map((s) => s.nom);
  zone.innerHTML = `
    <section class="ambiance" aria-label="Ambiance sonore">
      <div class="ambiance-tete">
        <button type="button" class="ambiance-lecture" data-lecture aria-label="${enLecture ? "Mettre en pause l'ambiance" : "Lancer l'ambiance"}">
          ${enLecture ? icones.pause : icones.lecture}
        </button>
        <div class="ambiance-texte">
          <p class="ambiance-titre">Ambiance sonore</p>
          <p class="meta">${enLecture ? noms.join(", ") : "En pause"}</p>
        </div>
      </div>
      <label class="ambiance-volume">
        <span class="sr-only">Volume</span>
        ${icones.volume}
        <input type="range" min="0" max="1" step="0.01" value="${reglages.volume}" data-volume>
      </label>
      <div class="ambiance-sons" role="group" aria-label="Sons">
        ${SONS.map(
          (s) => `<button type="button" class="ambiance-son" data-son="${s.id}" aria-pressed="${reglages.sons.includes(s.id)}">${s.nom}</button>`
        ).join("")}
      </div>
    </section>`;
}

zone?.addEventListener("click", (e) => {
  if (e.target.closest("[data-lecture]")) return enLecture ? pause() : lecture();
  const bouton = e.target.closest("[data-son]");
  if (bouton) basculerSon(bouton.dataset.son);
});

zone?.addEventListener("input", (e) => {
  if (!e.target.matches("[data-volume]")) return;
  reglages.volume = Number(e.target.value);
  if (maitre) maitre.gain.setTargetAtTime(reglages.volume, ctx.currentTime, 0.05);
  sauver();
});

rendre();
