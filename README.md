# Revisator

Site de révision perso, hébergé sur **GitHub Pages**, pour s'entraîner sur des QCM générés à partir de mes diapos de cours et de mes TDs.

## Principe

1. Je donne un PDF (un cours **ou** un TD) à une IA avec le [prompt de génération](#prompt-à-donner-à-lia).
2. L'IA me renvoie un fichier `qcm.json` qui respecte le [format ci-dessous](#format-du-fichier-qcmjson).
3. Je range le PDF et le JSON dans leur propre dossier : `contenu/<matiere>/<cours01-…|td01-…>/`.
4. Je fais `git push` : une GitHub Action met à jour l'index et redéploie le site automatiquement.

**Le site ne génère aucune question** : il n'appelle aucune IA, il affiche seulement les `qcm.json` que j'ai générés de mon côté et ajoutés au dépôt. Le [prompt](#prompt-à-donner-à-lia) n'est là que comme modèle à copier dans l'IA.

Pas de backend, pas de compte : tout tourne dans le navigateur.

## Fonctionnalités

- **Navigation par matière** : pour chaque matière, la liste de ses **cours** et de ses **TDs** (un QCM chacun), avec le nombre de questions.
- **Consultation des PDF** : chaque cours / TD donne accès à son PDF directement depuis le site.
- **QCM** :
  - questions à **une seule** ou à **plusieurs** bonnes réponses, avec l'indication affichée : « Une réponse » (boutons radio) ou « Plusieurs réponses » (cases à cocher) ;
  - questions de type **exercice** (énoncé avec des données, calculs, code) ;
  - une **explication** pour chaque question ;
  - un lien vers la **page du PDF** d'où vient la question, quand elle est indiquée.
- **Correction immédiate** : après avoir validé chaque question, le site montre si c'est juste, les bonnes réponses et l'explication, puis on passe à la suivante. Score récapitulatif à la fin de la série.
- **Mode examen** : un QCM par matière qui pioche un **échantillon** de questions dans tous ses cours et TDs (pas toutes les questions), réparti entre les documents pour couvrir tout le programme. Pas de chronomètre.
- **Revoir mes erreurs** : les questions ratées sont mémorisées dans le navigateur (`localStorage`) ; un mode ne repose que celles-ci. Dès qu'une question est réussie (dans n'importe quel mode), elle sort de la liste.
- Les questions s'affichent dans l'ordre du fichier (sauf le tirage du mode examen), mais **l'ordre des réponses est mélangé à chaque affichage** : on ne peut pas retenir « c'était la B ». Dans les explications, ne jamais faire référence à une lettre ou à une position.
- **Raccourcis clavier** sur ordinateur : `A`–`F` (ou `1`–`6`) pour cocher, `Entrée` pour valider puis passer à la question suivante.
- **Pensé pour le téléphone d'abord** : une question par écran, gros boutons, lisible sans zoomer ; s'adapte aussi à l'ordinateur.
- **Mise en forme** : énoncés, choix et explications en Markdown, formules en LaTeX (`$...$`), blocs de code.

## Organisation du dépôt

```
Revisator/
├── index.html              # point d'entrée du site
├── css/
├── js/
├── contenu/
│   ├── reseaux/
│   │   ├── matiere.json    # { "nom": "Réseaux" }
│   │   ├── cours01-modele-osi/
│   │   │   ├── document.pdf
│   │   │   └── qcm.json
│   │   ├── cours02-tcp/
│   │   │   ├── document.pdf
│   │   │   └── qcm.json
│   │   └── td01-adressage/
│   │       ├── document.pdf
│   │       └── qcm.json
│   └── algo/
│       └── ...
├── contenu/index.json      # généré automatiquement, ne pas éditer
└── .github/workflows/deploy.yml
```

- Un dossier par matière, puis **un sous-dossier par document** : un cours ou un TD, avec son PDF et son QCM.
- Le préfixe du dossier indique le type et l'ordre : `cours01-`, `cours02-`, `td01-`…
- Un TD peut être **rattaché à un cours** (champ `cours` du JSON) : il s'affiche alors sous ce cours. Les TDs non rattachés sont dans une liste « TDs » à part.
- Le PDF est facultatif : un dossier avec seulement un `qcm.json` (questions tirées d'annales, de notes…) fonctionne aussi, sans liens vers les pages.
- Le mode examen n'a pas de fichier : il est construit à partir des QCM de la matière.
- `index.json` liste toutes les matières et tous les documents. GitHub Pages ne permet pas de lister le contenu d'un dossier, donc c'est la GitHub Action qui le génère à chaque push.

## Format du fichier `qcm.json`

```json
{
  "matiere": "Réseaux",
  "document": "cours",
  "titre": "Le protocole TCP",
  "questions": [
    {
      "id": "tcp-001",
      "type": "unique",
      "enonce": "Quel mécanisme TCP utilise-t-il pour établir une connexion ?",
      "choix": [
        "Un échange en deux temps",
        "Une poignée de main en trois temps (SYN, SYN-ACK, ACK)",
        "Un broadcast ARP",
        "Aucun, TCP est sans connexion"
      ],
      "reponses": [1],
      "explication": "TCP établit la connexion avec le *three-way handshake* : SYN, puis SYN-ACK, puis ACK.",
      "page": 12
    },
    {
      "id": "tcp-002",
      "type": "multiple",
      "enonce": "Parmi ces propriétés, lesquelles sont garanties par TCP ?",
      "choix": [
        "Livraison dans l'ordre",
        "Délai de livraison borné",
        "Retransmission des segments perdus",
        "Contrôle de flux"
      ],
      "reponses": [0, 2, 3],
      "explication": "TCP garantit l'ordre, la fiabilité (retransmissions) et le contrôle de flux, mais aucun délai.",
      "page": 8
    },
    {
      "id": "tcp-003",
      "type": "unique",
      "exercice": "Un lien a un débit de $10\\ \\text{Mb/s}$ et un RTT de $40\\ \\text{ms}$.",
      "enonce": "Quelle est la taille minimale de la fenêtre pour saturer le lien ?",
      "choix": ["5 ko", "50 ko", "400 ko", "4 Mo"],
      "reponses": [1],
      "explication": "Produit débit × délai : $10^7 \\times 0{,}04 = 4 \\times 10^5$ bits, soit $50$ ko.",
      "page": 15
    }
  ]
}
```

### Champs

| Champ | Obligatoire | Description |
|---|---|---|
| `matiere` | oui | Nom de la matière, affiché sur le site. |
| `document` | oui | `"cours"` ou `"td"`. |
| `titre` | oui | Titre du cours ou du TD, affiché sur le site. |
| `cours` | non | Pour un TD seulement : nom du dossier du cours auquel il se rattache, ex. `"cours02-tcp"`. |
| `questions` | oui | Liste des questions. |
| `questions[].id` | oui | Identifiant **unique et stable** (sert à mémoriser les erreurs ; ne pas le changer après coup). |
| `questions[].type` | oui | `"unique"` (une seule bonne réponse) ou `"multiple"` (une ou plusieurs). |
| `questions[].exercice` | non | Données / mise en situation d'un exercice, affichées au-dessus de l'énoncé. Plusieurs questions peuvent reprendre le même texte. |
| `questions[].image` | non | Image placée dans le même dossier que le `qcm.json` (ex. `"fig-trame.png"`), affichée sous l'exercice ; un clic l'agrandit. |
| `questions[].legende` | non | Légende de l'image (sert aussi de texte alternatif). |
| `questions[].enonce` | oui | La question. |
| `questions[].choix` | oui | Entre 2 et 6 propositions. |
| `questions[].reponses` | oui | Indices des bonnes réponses dans `choix`, en commençant à **0**. Exactement un indice si `type` vaut `"unique"`. |
| `questions[].explication` | oui | Pourquoi la ou les bonnes réponses sont correctes (et, si utile, pourquoi les autres sont fausses). |
| `questions[].page` | non | Page du PDF (`document.pdf`) d'où vient la question : la correction affiche un lien vers cette page. |

Les champs texte acceptent le Markdown et le LaTeX (`$...$` en ligne, `$$...$$` en bloc). Dans un JSON, chaque `\` doit être doublé : `\\frac`, `\\text`.

### Correction des questions à plusieurs réponses

Le site affiche « Une réponse » ou « Plusieurs réponses » selon le `type`, sans dire combien. Une question `"multiple"` ne compte comme juste que si **toutes** les bonnes réponses sont cochées et **aucune** mauvaise.

Une question `"multiple"` peut n'avoir qu'une seule bonne réponse : ça évite que l'indication « Plusieurs réponses » donne un indice.

### Mode examen

Pour une matière, le site rassemble les questions de tous ses cours et TDs et en tire un nombre limité au hasard, réparti au prorata de chaque document (chaque cours / TD a au moins une question). La correction reste affichée après chaque question, et il n'y a pas de limite de temps.

Avant de lancer l'examen, je choisis la taille : **20** (par défaut), **40** ou **60** questions. Si la matière en contient moins, toutes sont utilisées.

### Validation

Au chargement, le site vérifie chaque `qcm.json` (champs obligatoires, indices valides, `id` en double) et affiche les erreurs au lieu de planter. La GitHub Action fait la même vérification et fait échouer le déploiement si un fichier est invalide.

## Fiches de révision

Chaque cours ou TD peut avoir une fiche de révision PDF (`fiche.pdf` dans son dossier) : l'essentiel du cours en quelques pages, avec des tutos pas à pas pour les calculs. Sur la page de la matière, un bouton « Fiche » l'ouvre.

Les fiches sont écrites en HTML dans `fiches/<matiere>/<dossier>.html` (style commun : `fiches/style.css`) puis converties en PDF avec Chrome ou Edge :

```bash
node scripts/build-fiches.js            # toutes les fiches
node scripts/build-fiches.js cours03    # seulement celles dont le nom contient « cours03 »
```

Les PDF générés sont commités : la GitHub Action ne les régénère pas.

Les **corrigés de TD** suivent le même principe : `fiches/<matiere>/<dossier>.corrige.html` → `contenu/<matiere>/<dossier>/corrige.pdf`, ouvert par le bouton « Corrigé » du TD.

## Liste des exams

La page « Liste des exams » (lien sur l'accueil) lit `contenu/examens.json` : les épreuves à venir triées par date avec un compte à rebours, celles dont la date reste à préciser, et les passées.

```json
{
  "titre": "Semestre 1",
  "examens": [
    {
      "matiere": "Algèbre",
      "revision": "algebre",
      "epreuves": [
        { "nom": "Exam", "date": "2026-11-26", "poids": 60 },
        { "nom": "Wims / TD", "poids": 40 }
      ]
    },
    { "matiere": "Dev front", "epreuves": [] }
  ]
}
```

| Champ | Obligatoire | Description |
|---|---|---|
| `matiere` | oui | Nom affiché. |
| `revision` | non | Dossier de `contenu/` à réviser : la ligne devient un lien vers cette matière. |
| `epreuves` | oui | Liste des épreuves ; vide si les modalités sont inconnues. |
| `epreuves[].nom` | non | « Exam », « Projet », « Diapo »… |
| `epreuves[].date` | non | Format `AAAA-MM-JJ`. Sans date, l'épreuve va dans « Date à préciser ». |
| `epreuves[].poids` | non | Coefficient en pourcentage. |

## Prompt à donner à l'IA

À copier avec le PDF en pièce jointe :

````
À partir du document PDF joint, génère un QCM de révision au format JSON.

Contraintes :
- Réponds uniquement avec le JSON, sans texte autour.
- Respecte exactement ce schéma :
  {
    "matiere": string,
    "document": "cours" | "td",
    "titre": string,
    "cours": string,               // optionnel, pour un TD : dossier du cours lié
    "questions": [
      {
        "id": string,              // préfixe court + numéro, ex. "tcp-001"
        "type": "unique" | "multiple",
        "exercice": string,        // optionnel : données d'un exercice
        "enonce": string,
        "choix": [string],         // 2 à 6 propositions
        "reponses": [number],      // indices à partir de 0
        "explication": string,
        "page": number             // page du PDF d'où vient la question
      }
    ]
  }
- Génère environ 20 questions qui couvrent tout le document, de la définition
  simple à l'application.
- Mélange les types : environ un tiers de questions "multiple".
- Si le document contient des exercices, crée des questions de type exercice :
  mets les données dans "exercice" et demande le résultat dans "enonce".
- Les mauvaises réponses doivent être plausibles (erreurs fréquentes, confusions
  entre notions proches).
- L'explication justifie la bonne réponse en s'appuyant sur le cours.
- Une question "multiple" peut n'avoir qu'une bonne réponse.
- Indique la page du PDF d'où vient chaque question.
- Markdown autorisé ; formules en LaTeX entre $...$ avec les antislashs doublés.

Matière : <MATIÈRE>
Type de document : <cours | td>
Titre : <TITRE>
````

## Ajouter un cours ou un TD

```bash
mkdir -p contenu/reseaux/cours03-udp
cp ~/Téléchargements/cours-udp.pdf contenu/reseaux/cours03-udp/document.pdf
# coller la réponse de l'IA dans contenu/reseaux/cours03-udp/qcm.json
git add contenu/reseaux/cours03-udp
git commit -m "Ajout QCM Réseaux cours 03 UDP"
git push
```

Le site est à jour quelques minutes plus tard.

## Stack technique

- **HTML / CSS / JavaScript sans framework ni build** : il suffit d'un serveur de fichiers statiques.
- **marked** (Markdown) et **KaTeX** (formules), chargés depuis un CDN ; police **Geist** (Google Fonts).
- Thème clair / sombre automatique selon le réglage du téléphone ou de l'ordinateur.
- **PDF** ouverts avec le lecteur du navigateur (`cours.pdf#page=12`).
- **localStorage** pour les erreurs à revoir.
- **GitHub Actions** : génère `contenu/index.json`, valide les `qcm.json`, déploie sur GitHub Pages.

### Lancer le site en local

`fetch()` ne fonctionne pas en ouvrant `index.html` directement, il faut un petit serveur. À relancer après chaque ajout de QCM :

```bash
node scripts/build-index.js   # valide les QCM et génère contenu/index.json
python -m http.server 8000    # puis ouvrir http://localhost:8000
```

Pour tester sur le téléphone, ouvrir `http://<ip-du-pc>:8000` depuis le même Wi-Fi.
## Pistes pour plus tard

- Historique des scores et statistiques par cours / TD.
- Questions Vrai / Faux.
- Export des erreurs vers Anki.
