"""Découpe l'énoncé (document.pdf) et la correction (corrige.pdf) d'un TD exercice par exercice.

Usage : python -P scripts/decouper-exercices.py contenu/<matiere>/<td...> [autres dossiers]

Pour chaque dossier, écrit exNN-enonce-K.png / exNN-correction-K.png (une image par morceau de page)
et exercices.json, lu par le site pour afficher chaque exercice suivi de sa correction.
Les titres repérés : « 3. Exercice … » (énoncés) et « Exercice 3 : … » (corrections) ; les liens
des corrections (pastilles vers les fiches) sont conservés en zones cliquables sur les images.
Un document sans titre d'exercice est traité comme un exercice unique.
"""

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
import logging

logging.disable(logging.WARNING)
import pypdfium2 as pdfium
from PIL import Image, ImageOps
from pypdf import PdfReader

ECHELLE = 2.5  # 72 pt → 180 px par pouce : net à l'écran et sur téléphone
MARGE = 6  # pt laissés au-dessus d'un titre d'énoncé
MARGE_CORRECTION = 16  # les corrections encadrent chaque exercice : le cadre commence au-dessus du titre
SITE = re.compile(r"/contenu/([^/]+)/([^/]+)/([^/#?]+\.pdf)(?:#page=(\d+))?", re.I)

TITRE_ENONCE = re.compile(r"^\s*(\d+)\s*\.\s*(Exercice\b.*|Loi normale.*)$")
TITRE_CORRECTION = re.compile(r"^\s*Exercice\s+(\d+)\s*:?\s*(.*)$")
FIN_ENONCE = re.compile(r"^\s*\d+\s*\.\s*ANNEXE\b", re.I)
# en-têtes et pieds de page des documents (bandeau « [ … ] date », « Page x sur y », « 2 / 4 »…)
ENTETE = re.compile(r"^\s*\[.*\]|Page\s+\d+\s+sur\s+\d+|Dernière mise à jour", re.I)
PIED = re.compile(r"Page\s+\d+\s+sur\s+\d+|^\s*\d+\s*/\s*\d+\s*$|^(Mme|M\.|Marcella)\s+SOA|·\s*Probabilités", re.I)


def lignes(page):
    """Lignes de texte de la page : (haut, bas, texte), coordonnées depuis le haut de la page."""
    tp = page.get_textpage()
    _, hauteur = page.get_size()
    texte = tp.get_text_range()
    boites, courante, resultat = [], [], []
    for i in range(tp.count_chars()):
        x0, y0, x1, y1 = tp.get_charbox(i)
        boites.append((hauteur - y1, hauteur - y0))
    # regroupe les caractères en lignes selon les retours à la ligne du texte extrait
    debut = 0
    for morceau in texte.split("\n"):
        fin = debut + len(morceau)
        cases = [b for b in boites[debut:fin] if b[1] - b[0] > 0.5]
        if morceau.strip() and cases:
            resultat.append((min(c[0] for c in cases), max(c[1] for c in cases), morceau.strip()))
        debut = fin + 1
    return resultat


def zone_contenu(page, lignes_page):
    """Haut et bas du contenu utile, sans bandeau d'en-tête ni pied de page."""
    _, h = page.get_size()
    haut, bas = 20.0, h - 20.0
    for y0, y1, t in lignes_page:
        if y1 < 100 and ENTETE.search(t):
            haut = max(haut, y1 + 4)
        if y0 > h - 100 and PIED.search(t):
            bas = min(bas, y0 - 4)
    return haut, bas


def titres(doc, motif, fin=None):
    """Repères (page, y, numéro, titre) des débuts d'exercice, plus d'éventuels repères de fin."""
    reperes = []
    for p in range(len(doc)):
        for y0, _, t in lignes(doc[p]):
            if "...." in t or "…." in t:  # ligne de sommaire
                continue
            if fin and fin.search(t):
                reperes.append((p, y0, None, None))
                continue
            m = motif.match(t)
            if m:
                reperes.append((p, y0, int(m.group(1)), m.group(2).strip(" :")))
    return reperes


def rogner(image):
    """Retire le blanc autour du contenu ; renvoie l'image et le décalage (gauche, haut) en pixels."""
    gris = ImageOps.invert(image.convert("L"))
    boite = gris.point(lambda v: 255 if v > 18 else 0).getbbox()
    if not boite:
        return None, (0, 0)
    g, hh, d, b = boite
    pad = 14
    g, hh = max(0, g - pad), max(0, hh - pad)
    d, b = min(image.width, d + pad), min(image.height, b + pad)
    return image.crop((g, hh, d, b)), (g, hh)


def liens_pdf(chemin):
    """Liens URI de chaque page : [(x0, haut, x1, bas, url)] en points depuis le haut."""
    lecteur = PdfReader(chemin)
    pages = []
    for page in lecteur.pages:
        h = float(page.mediabox.height)
        liste = []
        for a in page.get("/Annots") or []:
            a = a.get_object()
            action = a.get("/A")
            if not action or "/URI" not in action.get_object():
                continue
            x0, y0, x1, y1 = [float(v) for v in a["/Rect"]]
            liste.append((min(x0, x1), h - max(y0, y1), max(x0, x1), h - min(y0, y1), str(action.get_object()["/URI"])))
        pages.append(liste)
    return pages


def route(url):
    m = SITE.search(url)
    if not m:
        return url
    return f"#/lire/{m.group(1)}/{m.group(2)}/{m.group(3)}" + (f"/{m.group(4)}" if m.group(4) else "")


def decouper(doc, chemin, reperes, dossier, prefixe, marge=MARGE):
    """Images de chaque exercice entre deux repères consécutifs. Renvoie {numéro: [images]}."""
    liens = liens_pdf(chemin)
    bornes = [zone_contenu(doc[p], lignes(doc[p])) for p in range(len(doc))]
    debuts = [r for r in reperes if r[2] is not None]
    resultat = {}
    for i, (p, y, numero, _) in enumerate(debuts):
        suivant = next((r for r in reperes if (r[0], r[1]) > (p, y + 1)), None)
        fin_p, fin_y = (suivant[0], suivant[1] - marge) if suivant else (len(doc) - 1, bornes[-1][1])
        morceaux = []
        for q in range(p, fin_p + 1):
            haut = y - marge if q == p else bornes[q][0]
            bas = fin_y if q == fin_p else bornes[q][1]
            haut, bas = max(haut, 0), min(bas, bornes[q][1])
            if bas - haut > 12:
                morceaux.append((q, haut, bas))
        images = []
        for k, (q, haut, bas) in enumerate(morceaux, 1):
            page = doc[q]
            largeur_pt, _ = page.get_size()
            rendu = page.render(scale=ECHELLE).to_pil().convert("RGB")
            bande = rendu.crop((0, int(haut * ECHELLE), rendu.width, int(bas * ECHELLE)))
            image, (dx, dy) = rogner(bande)
            # moins de 45 px : reste de cadre ou de trait qui déborde sur la page, sans contenu
            if image is None or image.height < 45:
                continue
            nom = f"ex{numero:02d}-{prefixe}-{k}.png"
            image.quantize(colors=96, method=Image.Quantize.MEDIANCUT).save(dossier / nom, optimize=True)
            zones = []
            for x0, y0, x1, y1, url in liens[q]:
                if y0 < haut or y1 > bas:
                    continue
                px0, py0 = x0 * ECHELLE - dx, (y0 - haut) * ECHELLE - dy
                px1, py1 = x1 * ECHELLE - dx, (y1 - haut) * ECHELLE - dy
                zones.append({
                    "x": round(100 * px0 / image.width, 2), "y": round(100 * py0 / image.height, 2),
                    "l": round(100 * (px1 - px0) / image.width, 2), "h": round(100 * (py1 - py0) / image.height, 2),
                    "href": route(url),
                })
            images.append({"image": nom, "largeur": image.width, "hauteur": image.height, **({"liens": zones} if zones else {})})
        resultat[numero] = images
    return resultat


def traiter(dossier):
    dossier = Path(dossier)
    for ancien in dossier.glob("ex[0-9][0-9]-*.png"):
        ancien.unlink()
    enonce = pdfium.PdfDocument(str(dossier / "document.pdf"))
    correction = pdfium.PdfDocument(str(dossier / "corrige.pdf"))
    r_enonce = titres(enonce, TITRE_ENONCE, FIN_ENONCE)
    r_correction = titres(correction, TITRE_CORRECTION)
    meta = json.loads((dossier / "document.json").read_text(encoding="utf-8"))

    if not any(r[2] for r in r_enonce) or not any(r[2] for r in r_correction):
        # document d'un seul exercice : tout l'énoncé, puis toute la correction
        r_enonce = [(0, MARGE, 1, None)]
        r_correction = [(0, MARGE, 1, None)]
        titres_corr = {1: re.sub(r"^Exercice\s*:\s*", "", meta["titre"])}
    else:
        titres_corr = {r[2]: r[3] for r in r_correction if r[2]}

    images_enonce = decouper(enonce, dossier / "document.pdf", r_enonce, dossier, "enonce")
    images_correction = decouper(correction, dossier / "corrige.pdf", r_correction, dossier, "correction", MARGE_CORRECTION)

    exercices = [
        {
            "numero": numero,
            "titre": titres_corr.get(numero) or f"Exercice {numero}",
            "enonce": images_enonce.get(numero, []),
            "correction": images_correction.get(numero, []),
        }
        for numero in sorted(set(images_enonce) | set(images_correction))
    ]
    (dossier / "exercices.json").write_text(
        json.dumps({"exercices": exercices}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    manque = [x["numero"] for x in exercices if not x["enonce"] or not x["correction"]]
    print(f"{dossier.name} : {len(exercices)} exercices" + (f" (incomplets : {manque})" if manque else ""))


for d in sys.argv[1:]:
    traiter(d)
