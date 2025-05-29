# 📋 Cahier des charges - Huddle Board

## 🎯 **Vue d'ensemble du projet**

### **Objectif**
Développer une application web de visualisation de tableaux de bord HTML pour environnement industriel/manufacture, permettant d'afficher des rapports générés par des outils externes (Excel, BI, etc.) de manière optimisée et centralisée.

### **Contexte d'usage**
- **Environnement** : Manufacture, atelier, bureau industriel
- **Utilisateurs** : Opérateurs, superviseurs, managers
- **Matériel** : Écrans fixes, tablettes industrielles, PC atelier

---

## 🏗️ **Architecture technique**

### **Technologies imposées**
- **Frontend** : HTML5, CSS3 (variables CSS), JavaScript vanilla (ES6+)
- **Aucune dépendance** externe (frameworks, CDN, librairies)
- **Configuration** : Fichier JSON statique
- **Compatibilité** : Navigateurs anciens 

### **Structure des fichiers**
```
huddle-board/
├── index.html          # Application principale
├── styles.css          # Styles CSS optimisés
├── app.js             # Logique JavaScript
├── config.json        # Configuration des projets
└── [Dossiers projets]/
    └── index.html     # Contenu de chaque projet
```

---

## ⚙️ **Spécifications fonctionnelles**

### **F1 - Affichage liste des projets**
- **Description** : Écran d'accueil avec grille de cartes projet
- **Données source** : Fichier `config.json` chargé une seule fois
- **Affichage** : Nom, description, date de modification
- **Interaction** : Clic sur carte → ouverture projet
- **Responsive** : Grille adaptative (1-4 colonnes selon écran)

### **F2 - Visualisation projet en plein écran**
- **Description** : Affichage iframe en mode plein écran
- **Fit-to-screen** : **OBLIGATOIRE** - Ajustement automatique du contenu
- **Calcul** : Basé sur les dimensions du conteneur (page)
- **Centrage** : Contenu centré avec marges proportionnelles
- **Navigation** : Bouton retour vers liste

### **F3 - Navigation par liens directs**
- **URLs** : `index.html?folder=NomProjet` (encodage URI)
- **Historique** : Support bouton retour navigateur
- **Bookmarks** : URLs partageables et mémorisables
- **État** : Synchronisation URL ↔ affichage

### **F4 - Configuration centralisée**
- **Format** : JSON simple sans imbrication complexe
- **Chargement** : Une seule fois au démarrage
- **Structure** : Array de projets avec nom, chemin, description
- **Validation** : Gestion d'erreurs si fichier manquant/invalide

---

## 🎨 **Spécifications design**

### **Charte graphique**
- **Couleur primaire** : Rouge (#dc2626, #ef4444, #b91c1c)
- **Couleur secondaire** : Blanc (#ffffff)
- **Couleurs neutres** : Nuances de gris (#f9fafb à #111827)
- **Police** : Segoe UI, system-ui, sans-serif
- **Style** : Moderne, épuré, professionnel

### **Interface utilisateur**
- **Header** : Titre "Huddle Board", bouton retour (si applicable)
- **Grille projets** : Cartes avec hover effects, animations subtiles
- **Viewer** : Plein écran, header minimal, contenu centré
- **États** : Loading, erreur, succès avec feedback visuel

### **Responsive design**
- **Desktop** : Grille 2-4 colonnes, iframe optimisée
- **Tablet** : Grille 1-2 colonnes, contrôles adaptés
- **Mobile** : Grille 1 colonne, interface simplifiée

---

## 🔧 **Spécifications techniques**

### **Performance**
- **Chargement initial** : < 2 secondes
- **Taille totale** : < 100 KB (HTML+CSS+JS)
- **Frames par seconde** : 60 FPS pour animations
- **Mémoire** : < 50 MB utilisation RAM

### **Sécurité**
- **Sandbox iframe** : `allow-scripts allow-same-origin allow-forms`
- **Meta robots** : `noindex, nofollow` 
- **Validation** : Pas d'injection XSS (échappement optionnel car source contrôlée)
- **HTTPS** : Compatible mais pas obligatoire (intranet)

### **Compatibilité navigateurs**
- **Chrome** : 80+ (90% des cas d'usage)
- **Firefox** : 75+ (support secondaire)
- **Edge** : 80+ (support secondaire)
- **Safari** : Pas de support requis
- **IE** : Pas de support (obsolète)

---

## 📁 **Format de configuration**

### **Structure config.json**
```json
{
  "folders": [
    {
      "name": "Nom affiché",
      "path": "./chemin/vers/dossier",
      "description": "Description optionnelle"
    }
  ]
}
```

### **Contraintes**
- **Noms** : Pas de caractères spéciaux problématiques
- **Chemins** : Relatifs à l'application, format Unix
- **Structure** : Chaque dossier doit contenir `index.html`
- **Taille** : Max 50 projets (performance UI)

---

## 🎛️ **Algorithme fit-to-screen**

### **Logique de calcul**
1. **Récupérer dimensions conteneur** (`wrapper.clientWidth/Height`)
2. **Accéder contenu iframe** (si CORS autorise)
3. **Calculer dimensions contenu** (`scrollWidth/Height`)
4. **Calculer scale optimal** (`Math.min(scaleX, scaleY, 1)`)
5. **Appliquer transformation** (`transform: scale()` + centrage)
6. **Fallback** : Dimensions relatives si échec

### **Gestion d'erreurs**
- **Cross-origin** : Utiliser dimensions conteneur
- **Contenu vide** : Dimensions par défaut
- **Erreur calcul** : Mode dégradé `calc(100% - 32px)`

---

## ✅ **Critères d'acceptation**

### **Fonctionnels**
- [ ] Liste projets affichée depuis config.json
- [ ] Clic projet → ouverture plein écran
- [ ] Bouton retour fonctionnel
- [ ] URLs directes fonctionnelles
- [ ] Fit-to-screen automatique et optimal
- [ ] Responsive sur tous supports

### **Techniques**
- [ ] Aucune dépendance externe
- [ ] Code < 100 KB total
- [ ] Compatible Chrome/Firefox/Edge 80+
- [ ] Temps chargement < 2s
- [ ] Gestion d'erreurs robuste

### **Qualité**
- [ ] Code HTML5 valide W3C
- [ ] CSS organisé avec variables
- [ ] JavaScript ES6+ propre
- [ ] Pas d'erreurs console
- [ ] Documentation inline suffisante

---

## 🚀 **Livrables attendus**

### **Code source**
1. **index.html** - Application principale (< 50 lignes)
2. **styles.css** - Styles optimisés (< 300 lignes)  
3. **app.js** - Logique métier (< 300 lignes)
4. **config.json** - Configuration exemple

### **Documentation**
1. **README.md** - Installation et utilisation
2. **DEPLOY.md** - Guide de déploiement
3. **CONFIG.md** - Format configuration détaillé

### **Tests**
1. **config-example.json** - Données de test
2. **projets-exemples/** - Dossiers HTML test
3. **checklist-tests.md** - Procédure validation

---

## 📊 **Métriques de succès**

- **Adoption** : 90% des utilisateurs trouvent l'interface intuitive
- **Performance** : < 2s chargement sur réseau d'entreprise  
- **Fiabilité** : 99.9% uptime (pas de crashes JavaScript)
- **Maintenance** : 0 intervention requise après déploiement
- **Compatibilité** : Fonctionne sur 100% du parc navigateurs cible

---

## 🔍 **Points d'attention**

### **Risques techniques**
- **CORS** : Contenu cross-origin peut limiter fit-to-screen
- **Performance** : Gros fichiers HTML peuvent ralentir calculs
- **Cache** : Navigateurs peuvent cacher ancien contenu

### **Contraintes métier**
- **Contenu** : Dépendant de la qualité HTML des sources
- **Réseau** : Doit fonctionner avec connexions lentes
- **Utilisateurs** : Interface doit être utilisable sans formation

---

*Version 1.0 - Document de référence pour développement Huddle Board*