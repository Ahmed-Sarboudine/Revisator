// Icônes SVG en ligne (traits, couleur héritée du texte).

const svg = (contenu, taille = 20) =>
  `<svg class="icone" width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenu}</svg>`;

export const icones = {
  retour: svg('<path d="M15 18l-6-6 6-6"/>'),
  fermer: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  suivant: svg('<path d="M9 18l6-6-6-6"/>', 18),
  document: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>', 18),
  externe: svg('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 16),
  juste: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 16),
  faux: svg('<path d="M17 7L7 17M7 7l10 10"/>', 16),
  examen: svg('<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M16 5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2"/><path d="M9 13l2 2 4-4"/>'),
  fiche: svg('<path d="M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-14c-4 0-6.5.5-8 2z"/><path d="M12 6.5v14"/>', 18),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  calendrier: svg('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 10h16"/>'),
  erreurs: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
};
