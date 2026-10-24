---
name: lancer-site
description: Lance le site Revisator en local (génère l'index, démarre le serveur, ouvre le navigateur). À utiliser quand l'utilisateur veut « voir le site », « lancer en local », « tester sur mon téléphone ».
---

# Lancer le site en local

1. Valider les QCM et générer l'index (à refaire après chaque ajout de QCM, sans redémarrer le serveur) :
   ```bash
   node scripts/build-index.js
   ```
   S'il échoue, montrer les erreurs à l'utilisateur et les corriger avant de continuer.

2. Vérifier si un serveur tourne déjà :
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/
   ```
   Si la réponse est `200`, ne pas en relancer un.

3. Sinon, démarrer le serveur **en arrière-plan** (`run_in_background`) depuis la racine du projet :
   ```bash
   python -m http.server 8000
   ```

4. Ouvrir le navigateur (PowerShell) sur la page la plus utile, par exemple la matière qu'on vient de modifier :
   ```powershell
   Start-Process "http://localhost:8000/#/m/<matiere>"
   ```

5. Donner l'adresse pour le téléphone (même Wi-Fi) : récupérer l'IPv4 avec `ipconfig` et indiquer `http://<ip>:8000`. Si le téléphone n'y accède pas, c'est en général le pare-feu Windows qui bloque Python sur le réseau : autoriser Python pour les réseaux privés.

Routes utiles : `#/` accueil, `#/m/<matiere>`, `#/q/<matiere>/<dossier>`, `#/examen/<matiere>/20`, `#/erreurs/<matiere>`.
