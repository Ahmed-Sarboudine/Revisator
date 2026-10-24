// Rendu des textes des QCM : Markdown (marked) + formules LaTeX (KaTeX).
// Les formules sont extraites avant marked pour qu'il ne touche pas aux _ et \.

export function echapper(texte) {
  return String(texte)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const FORMULE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

function rendre(texte, enLigne) {
  const formules = [];
  const sansFormules = String(texte).replace(FORMULE, (brut, bloc, ligne) => {
    if (!window.katex) return brut;
    formules.push(
      window.katex.renderToString(bloc ?? ligne, { displayMode: bloc !== undefined, throwOnError: false })
    );
    return `@@FORMULE${formules.length - 1}@@`;
  });

  let html;
  if (window.marked) {
    html = enLigne ? window.marked.parseInline(sansFormules) : window.marked.parse(sansFormules);
  } else {
    html = echapper(sansFormules).replaceAll("\n", "<br>");
  }
  return html.replace(/@@FORMULE(\d+)@@/g, (_, i) => formules[i]);
}

export const markdown = (texte) => rendre(texte, false);
export const markdownEnLigne = (texte) => rendre(texte, true);
