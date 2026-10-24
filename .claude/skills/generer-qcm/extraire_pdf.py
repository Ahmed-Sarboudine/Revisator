"""Extrait le texte d'un PDF de cours, page par page, et rend en PNG les pages demandées.

Usage :
  python -P extraire_pdf.py <fichier.pdf> <dossier_sortie> [--rendre 30,35-37]

Écrit <dossier_sortie>/texte.txt (une section « ===== PAGE n ===== » par page)
et, avec --rendre, <dossier_sortie>/page-<n>.png pour lire les schémas.
Affiche le nombre de pages et celles qui contiennent peu de texte (probablement des images).
"""

import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

import logging

logging.disable(logging.WARNING)  # pypdf est bavard sur les PDF exportés de PowerPoint

from pypdf import PdfReader

PEU_DE_TEXTE = 60  # caractères, sans compter le numéro de page et l'en-tête répété


def pages_demandees(spec, total):
    pages = set()
    for morceau in spec.split(","):
        if "-" in morceau:
            debut, fin = morceau.split("-")
            pages.update(range(int(debut), int(fin) + 1))
        elif morceau.strip():
            pages.add(int(morceau))
    return sorted(p for p in pages if 1 <= p <= total)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    pdf, sortie = Path(sys.argv[1]), Path(sys.argv[2])
    sortie.mkdir(parents=True, exist_ok=True)

    lecteur = PdfReader(pdf)
    total = len(lecteur.pages)
    textes = [(page.extract_text() or "").strip() for page in lecteur.pages]

    # les lignes répétées sur beaucoup de pages (titre de partie, nom du cours) ne comptent pas
    frequence = {}
    for texte in textes:
        for ligne in {l.strip() for l in texte.splitlines()}:
            frequence[ligne] = frequence.get(ligne, 0) + 1
    repetees = {l for l, n in frequence.items() if n > max(2, total // 5)}

    sections, pauvres = [], []
    for n, texte in enumerate(textes, 1):
        sections.append(f"===== PAGE {n} =====\n{texte}\n")
        utile = [l for l in texte.splitlines() if l.strip() not in repetees and not l.strip().isdigit()]
        if sum(len(l.strip()) for l in utile) < PEU_DE_TEXTE:
            pauvres.append(n)
    (sortie / "texte.txt").write_text("\n".join(sections), encoding="utf-8")

    print(f"{total} pages -> {sortie / 'texte.txt'}")
    print(f"Pages avec peu de texte (à rendre en image) : {', '.join(map(str, pauvres)) or 'aucune'}")

    if "--rendre" in sys.argv:
        import pypdfium2 as pdfium

        spec = sys.argv[sys.argv.index("--rendre") + 1]
        document = pdfium.PdfDocument(str(pdf))
        for n in pages_demandees(spec, total):
            image = document[n - 1].render(scale=1.5).to_pil()
            chemin = sortie / f"page-{n}.png"
            image.save(chemin)
            print(f"rendu : {chemin}")


if __name__ == "__main__":
    main()
