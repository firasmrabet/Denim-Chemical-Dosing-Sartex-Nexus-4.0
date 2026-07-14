# Denim Chemical Dosing - Sartex Nexus 4.0 Dashboard

Bienvenue dans le dépôt du **Dashboard SCADA** pour le projet **Sartex Nexus 4.0**. Ce projet offre une interface de supervision moderne et intelligente pour le système de dosage chimique de Denim.

## 📖 À propos du projet

Ce tableau de bord (Dashboard) sert d'interface de contrôle et de surveillance. Il intègre :
- **Visualisation en temps réel :** Suivi des niveaux de cuves, pressions, températures et états des vannes.
- **Contrôle Manuel/Automatique :** Interface d'administration pour ajuster les paramètres de dosage.
- **Analyse Intelligente (IA) :** Détection d'anomalies, prédiction de maintenance et optimisation des dosages grâce à un moteur Python intégré.
- **Historique & Rapports :** Génération de graphiques et export de données pour l'analyse des performances.

## 🚀 Comment exécuter le projet localement

### Prérequis
Assurez-vous d'avoir installé sur votre machine :
- **Node.js** (version 18 ou supérieure recommandée)
- **Python** (version 3.10 ou supérieure recommandée)

### Installation

1. **Cloner le dépôt :**
   ```bash
   git clone https://github.com/firasmrabet/Denim-Chemical-Dosing-Sartex-Nexus-4.0.git
   ```

2. **Accéder au dossier du projet :**
   ```bash
   cd Denim-Chemical-Dosing-Sartex-Nexus-4.0
   ```

3. **Installer les dépendances du projet :**
   ```bash
   npm install
   ```

4. *(Optionnel)* **Installer les dépendances Python pour l'IA :**
   Allez dans le dossier `server` et installez les paquets requis.
   ```bash
   cd server
   pip install -r requirements.txt
   cd ..
   ```

### Lancement

Pour démarrer l'ensemble du projet (le client React, le serveur Node.js et le moteur IA Python en même temps), exécutez simplement la commande suivante à la racine du projet :

```bash
npm run dev
```

Une fois lancé, ouvrez votre navigateur web et accédez à l'adresse locale indiquée dans votre terminal (généralement `http://localhost:5173`).

---
*Projet développé dans le cadre de la modernisation des systèmes industriels de Sartex.*
