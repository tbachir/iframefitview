# HuddleBoard Documentation - ThinManager

## Table des matières

1. [Introduction](#introduction)
2. [Architecture](#architecture)
3. [Installation sur Windows Server 2022](#installation-sur-windows-server-2022)
4. [Configuration IIS](#configuration-iis)
5. [Configuration](#configuration)
6. [Configuration ThinManager](#configuration-thinmanager)
7. [Utilisation](#utilisation)
8. [Fonctionnalités](#fonctionnalités)
9. [API Reference](#api-reference)
10. [Monitoring](#monitoring)
11. [Dépannage](#dépannage)
12. [Performance](#performance)
13. [Maintenance](#maintenance)

## Introduction

HuddleBoard est un système d'affichage dynamique conçu pour fonctionner 24/7 sur des terminaux ThinManager avec Chrome Container. Il permet d'afficher et de rafraîchir automatiquement du contenu HTML avec mise à l'échelle automatique et détection des changements.

### Environnement cible

- **Serveur** : Windows Server 2022 avec IIS
- **Clients** : ThinManager avec Chrome Container
- **Navigateur** : Chrome en mode conteneur contrôlé
- **Réseau** : Environnement d'entreprise sécurisé

### Caractéristiques clés

- ✅ Rafraîchissement automatique intelligent
- ✅ Mise à l'échelle adaptative du contenu
- ✅ Détection des modifications
- ✅ Monitoring de santé intégré
- ✅ Optimisé pour Chrome Container ThinManager
- ✅ Compatible Windows Server 2022 / IIS

## Architecture

### Structure des fichiers

```
C:\inetpub\wwwroot\huddleboard\
├── index.html              # Page d'accueil avec liste des displays
├── config.js              # Configuration des displays
├── display/
│   └── index.html         # Moteur d'affichage principal
└── displays/              # Dossier contenant les contenus
    ├── dashboard/
    │   └── index.html
    └── monitoring/
        └── index.html
```

### Composants principaux

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ThinManager   │────│  Chrome Container │────│  HuddleBoard    │
│                 │    │                  │    │                 │
├─ Terminal Config│    ├─ Chrome Settings │    ├─ Display Manager│
├─ URL Launch     │    ├─ Kiosk Mode      │    ├─ Scale Handler │
├─ Auto Refresh   │    ├─ Memory Mgmt     │    ├─ Refresh Service│
└─ Session Mgmt   │    └─ Error Recovery  │    └─ Health Monitor │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                 │
                       ┌──────────────────┐
                       │  Windows Server  │
                       │     2022 + IIS   │
                       └──────────────────┘
```

## Installation sur Windows Server 2022

### Prérequis

1. **Windows Server 2022** avec IIS installé
2. **Rôle Web Server (IIS)** activé
3. **Fonctionnalités IIS requises** :
   - Contenu statique
   - Document par défaut
   - Erreurs HTTP
   - Redirection HTTP
   - Compression du contenu statique

### Installation

1. **Activer IIS et fonctionnalités**
   ```powershell
   # Ouvrir PowerShell en tant qu'administrateur
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-CommonHttpFeatures
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpErrors
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpRedirect
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-ApplicationDevelopment
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-NetFxExtensibility45
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpCompressionStatic
   ```

2. **Créer le dossier d'application**
   ```powershell
   # Créer le dossier HuddleBoard
   New-Item -Path "C:\inetpub\wwwroot\huddleboard" -ItemType Directory
   
   # Créer les sous-dossiers
   New-Item -Path "C:\inetpub\wwwroot\huddleboard\display" -ItemType Directory
   New-Item -Path "C:\inetpub\wwwroot\huddleboard\displays" -ItemType Directory
   ```

3. **Copier les fichiers de l'application**
   - Copier `index.html`, `config.js` et le dossier `display/` dans `C:\inetpub\wwwroot\huddleboard\`
   - Créer vos displays dans le dossier `displays\`

## Configuration IIS

### Configuration du site web

1. **Ouvrir IIS Manager**
   - Démarrer → Outils d'administration → Gestionnaire des services Internet (IIS)

2. **Créer une nouvelle application**
   ```
   Site : Default Web Site
   Alias : huddleboard
   Chemin physique : C:\inetpub\wwwroot\huddleboard
   ```

3. **Configuration des types MIME** (Facultatif si extensions spéciales)
   ```
   Extension : .json
   Type MIME : application/json
   ```

### Configuration optimale pour HuddleBoard

**web.config à placer dans C:\inetpub\wwwroot\huddleboard\**

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <!-- Désactiver le cache pour les displays -->
    <staticContent>
      <clientCache cacheControlMode="DisableCache" />
    </staticContent>
    
    <!-- Compression GZIP -->
    <httpCompression>
      <scheme name="gzip" dll="%Windir%\system32\inetsrv\gzip.dll" />
      <dynamicTypes>
        <add mimeType="text/*" enabled="true" />
        <add mimeType="message/*" enabled="true" />
        <add mimeType="application/javascript" enabled="true" />
      </dynamicTypes>
      <staticTypes>
        <add mimeType="text/*" enabled="true" />
        <add mimeType="message/*" enabled="true" />
        <add mimeType="application/javascript" enabled="true" />
      </staticTypes>
    </httpCompression>
    
    <!-- Headers pour le cache -->
    <httpProtocol>
      <customHeaders>
        <add name="Cache-Control" value="no-cache, no-store, must-revalidate" />
        <add name="Pragma" value="no-cache" />
        <add name="Expires" value="0" />
      </customHeaders>
    </httpProtocol>
    
    <!-- Documents par défaut -->
    <defaultDocument>
      <files>
        <clear />
        <add value="index.html" />
      </files>
    </defaultDocument>
  </system.webServer>
</configuration>
```

### Configuration spécifique pour le dossier displays

**web.config à placer dans C:\inetpub\wwwroot\huddleboard\displays\**

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <!-- Forcer no-cache pour les displays -->
    <staticContent>
      <clientCache cacheControlMode="DisableCache" />
    </staticContent>
    
    <httpProtocol>
      <customHeaders>
        <clear />
        <add name="Cache-Control" value="no-cache, no-store, must-revalidate, max-age=0" />
        <add name="Pragma" value="no-cache" />
        <add name="Expires" value="Thu, 01 Jan 1970 00:00:00 GMT" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

## Configuration

### Structure de configuration (config.js)

```javascript
window.AppConfig = {
    // Configuration pour environnement ThinManager
    defaultRefreshInterval: 30000,  // 30 secondes
    maxConsecutiveErrors: 5,        // Limite réduite pour ThinManager
    networkTimeout: 15000,          // Timeout adapté réseau entreprise
    autoReloadHours: 8,             // Reload préventif (shift de travail)
    
    // Liste des displays
    displays: [
        {
            name: "Dashboard Production",
            slug: "production",
            path: "displays/production/index.html",
            refreshInterval: 15000,
            description: "Indicateurs production temps réel"
        },
        {
            name: "Monitoring Système",
            slug: "monitoring",
            path: "displays/monitoring/index.html",
            refreshInterval: 10000,
            description: "État des serveurs et services"
        }
    ]
};
```

## Configuration ThinManager

### Configuration Terminal

1. **Paramètres Chrome Container**
   ```
   Application Type: Chrome Container
   URL: http://[IP_SERVEUR]/huddleboard/display/#/[SLUG_DISPLAY]
   
   Chrome Settings:
   - Start Maximized: True
   - Disable Scrollbars: True
   - Disable Context Menu: True
   - Disable F-Keys: True
   - Auto Refresh: False (géré par l'application)
   ```

2. **Paramètres réseau recommandés**
   ```
   Connection Type: Ethernet (recommandé)
   DHCP ou IP fixe selon infrastructure
   DNS: Serveurs DNS de l'entreprise
   ```

3. **Gestion des sessions**
   ```
   Auto Logon: True
   Session Timeout: Disabled
   Power Management: Always On
   Screen Saver: Disabled
   ```

### Exemple de configuration terminal

**Terminal Profile pour dashboard principal :**
```
Terminal Name: DASHBOARD-001
MAC Address: [MAC_DU_TERMINAL]
Terminal Type: ThinManager Ready
Application: Chrome Container
URL: http://192.168.1.100/huddleboard/display/#/production
Auto Start: True
Session Timeout: None
```

**Terminal Profile pour monitoring :**
```
Terminal Name: MONITOR-001  
MAC Address: [MAC_DU_TERMINAL]
Terminal Type: ThinManager Ready
Application: Chrome Container
URL: http://192.168.1.100/huddleboard/display/#/monitoring
Auto Start: True
Session Timeout: None
```

## Utilisation

### Accès depuis un navigateur standard (configuration)

- **URL d'accueil** : `http://[IP_SERVEUR]/huddleboard/`
- **Accès direct** : `http://[IP_SERVEUR]/huddleboard/display/#/[SLUG]`

### Création d'un nouveau display

1. **Créer le dossier**
   ```powershell
   New-Item -Path "C:\inetpub\wwwroot\huddleboard\displays\nouveau-display" -ItemType Directory
   ```

2. **Créer le contenu HTML**
   ```html
   <!-- displays/nouveau-display/index.html -->
   <!DOCTYPE html>
   <html>
   <head>
       <meta charset="UTF-8">
       <title>Nouveau Display</title>
       <style>
           body {
               font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
               margin: 0;
               padding: 20px;
               background: #f5f5f5;
           }
           .container {
               max-width: 1200px;
               margin: 0 auto;
               background: white;
               padding: 30px;
               border-radius: 8px;
               box-shadow: 0 2px 10px rgba(0,0,0,0.1);
           }
           h1 {
               color: #333;
               text-align: center;
               margin-bottom: 30px;
           }
           .timestamp {
               text-align: center;
               color: #666;
               font-size: 14px;
               margin-top: 20px;
           }
       </style>
   </head>
   <body>
       <div class="container">
           <h1>Nouveau Display</h1>
           <p>Contenu de votre display personnalisé...</p>
           <div class="timestamp">
               Dernière mise à jour : <span id="time"></span>
           </div>
       </div>
       
       <script>
           function updateTime() {
               document.getElementById('time').textContent = 
                   new Date().toLocaleString('fr-FR');
           }
           
           updateTime();
           setInterval(updateTime, 1000);
       </script>
   </body>
   </html>
   ```

3. **Ajouter à config.js**
   ```javascript
   {
       name: "Nouveau Display",
       slug: "nouveau-display", 
       path: "displays/nouveau-display/index.html",
       refreshInterval: 60000,
       description: "Description du nouveau display"
   }
   ```

4. **Configurer le terminal ThinManager**
   - URL : `http://[IP_SERVEUR]/huddleboard/display/#/nouveau-display`

## Fonctionnalités

### 1. Rafraîchissement intelligent adapté ThinManager

- Vérification périodique des modifications
- Gestion optimisée de la bande passante
- Retry automatique avec backoff adaptatif
- Compatible avec les limitations réseau ThinManager

### 2. Mise à l'échelle automatique

- Adaptation automatique à la résolution du terminal
- Support multi-résolutions (1024x768, 1920x1080, etc.)
- Maintien des proportions du contenu
- Optimisation pour affichage plein écran

### 3. Indicateurs visuels optimisés

**Bannière de statut** (coin supérieur droit)
- 🟢 Vert : Connexion serveur OK
- 🔴 Rouge : Erreur réseau ou serveur

**Bannière de modification** (coin inférieur droit)
- Heure de la dernière modification détectée

**Bannière de santé** (coin inférieur gauche, si activée)
- Uptime du display
- Nombre de rafraîchissements
- Compteur d'erreurs

### 4. Gestion robuste pour environnement 24/7

- Récupération automatique après perte réseau
- Reload préventif (toutes les 8h par défaut)
- Gestion des timeouts réseau
- Protection contre les fuites mémoire

## API Reference

### Configuration ThinManager spécifique

```javascript
window.AppConfig = {
    // Optimisations ThinManager
    thinManagerMode: true,           // Active les optimisations
    lowBandwidthMode: false,         // Mode bande passante réduite
    terminalRebootHours: [6, 14, 22], // Heures de reboot suggérées
    
    // Paramètres réseau
    networkTimeout: 15000,           // 15s timeout
    maxRetries: 3,                   // Nombre de tentatives
    retryDelay: 5000,               // Délai entre tentatives
    
    // Gestion mémoire
    memoryThresholdMB: 800,         // Seuil Chrome Container
    autoReloadHours: 8,             // Force reload préventif
    
    displays: [/* ... */]
};
```

### Classes principales

#### ThinManagerOptimizer (Ajout spécifique)

```javascript
class ThinManagerOptimizer {
    constructor(config) {
        this.config = config;
        this.networkQuality = 'good'; // good, poor, offline
    }
    
    optimizeForNetwork() {
        // Ajuste les paramètres selon la qualité réseau
    }
    
    schedulePreventiveReload() {
        // Planifie les reloads préventifs
    }
}
```

## Monitoring

### Métriques spécifiques ThinManager

1. **Santé réseau**
   - Latence vers le serveur IIS
   - Taux de succès des requêtes
   - Qualité de la connexion

2. **Performance terminal**
   - Utilisation mémoire Chrome Container
   - Temps de rendu des displays
   - Fréquence des reloads

3. **Disponibilité**
   - Uptime des displays
   - Détection des déconnexions
   - Temps de récupération

### Logs Windows Event

Les erreurs critiques sont loggées dans l'Event Viewer :

```powershell
# Consulter les logs IIS
Get-EventLog -LogName System -Source "Microsoft-Windows-IIS*" -Newest 50

# Logs personnalisés (si configurés)
Get-EventLog -LogName Application -Source "HuddleBoard" -Newest 20
```

## Dépannage

### Problèmes courants ThinManager

#### Terminal ne se connecte pas

1. **Vérifier la connectivité réseau**
   ```cmd
   ping [IP_SERVEUR]
   telnet [IP_SERVEUR] 80
   ```

2. **Tester l'URL manuellement**
   - Ouvrir navigateur sur poste admin
   - Tester `http://[IP_SERVEUR]/huddleboard/`

3. **Vérifier configuration ThinManager**
   - URL correcte dans le profil terminal
   - Paramètres Chrome Container

#### Display ne se rafraîchit pas

1. **Vérifier la bannière de statut**
   - Rouge = problème serveur/réseau
   - Vert = fonctionne normalement

2. **Consulter les logs IIS**
   ```powershell
   # Logs d'accès IIS
   Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\*.log" | Select-String "huddleboard" | Select-Object -Last 10
   ```

3. **Vérifier les en-têtes cache**
   - Utiliser F12 dans Chrome pour voir les headers
   - Vérifier présence de `Cache-Control: no-cache`

#### Chrome Container plante ou freeze

1. **Redémarrer le terminal via ThinManager**
2. **Vérifier utilisation mémoire** (si monitoring activé)
3. **Réduire l'intervalle de rafraîchissement**
4. **Simplifier le contenu du display**

### Commandes de diagnostic Windows

```powershell
# Vérifier statut IIS
Get-Service W3SVC

# Redémarrer IIS si nécessaire
iisreset

# Vérifier les fichiers
Test-Path "C:\inetpub\wwwroot\huddleboard\config.js"

# Permissions du dossier
icacls "C:\inetpub\wwwroot\huddleboard"

# Ports en écoute
netstat -an | findstr :80
```

## Performance

### Optimisations pour ThinManager

1. **Contenu des displays**
   - Éviter les animations CSS gourmandes
   - Limiter les requêtes AJAX externes
   - Optimiser les images (max 1MB par display)
   - Utiliser des polices système

2. **Configuration IIS optimale**
   ```xml
   <!-- Compression activée -->
   <httpCompression directory="%SystemDrive%\inetpub\temp\IIS Temporary Compressed Files">
       <scheme name="gzip" dll="%Windir%\system32\inetsrv\gzip.dll" />
       <staticTypes>
           <add mimeType="text/*" enabled="true" />
           <add mimeType="application/javascript" enabled="true" />
       </staticTypes>
   </httpCompression>
   ```

3. **Paramètres Chrome optimisés pour ThinManager**
   ```
   Chrome Switches:
   --disable-background-timer-throttling
   --disable-renderer-backgrounding  
   --disable-backgrounding-occluded-windows
   --max-memory-usage=512000000
   ```

### Benchmarks environnement ThinManager

| Métrique | Valeur cible | Notes |
|----------|--------------|-------|
| Temps chargement initial | < 5s | Réseau local 100Mbps |
| Mémoire Chrome Container | < 400MB | Par display |
| CPU au repos | < 10% | Terminal ThinManager |
| Résolution recommandée | 1920x1080 | Optimale pour scaling |

## Maintenance

### Maintenance préventive

1. **Hebdomadaire**
   ```powershell
   # Nettoyer les logs IIS (garder 7 jours)
   Get-ChildItem "C:\inetpub\logs\LogFiles\W3SVC1\" | 
   Where-Object {$_.CreationTime -lt (Get-Date).AddDays(-7)} | 
   Remove-Item -Force
   
   # Vérifier l'espace disque
   Get-WmiObject -Class Win32_LogicalDisk | 
   Select-Object DeviceID, @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
   ```

2. **Mensuelle**
   - Redémarrage serveur IIS (fenêtre de maintenance)
   - Mise à jour des displays si nécessaire
   - Vérification des certificats (si HTTPS)

3. **Trimestrielle**
   - Sauvegarde complète configuration
   - Test de récupération
   - Audit des performances

### Sauvegarde et restauration

**Script de sauvegarde PowerShell :**
```powershell
# Sauvegarde HuddleBoard
$backupPath = "C:\Backups\HuddleBoard_$(Get-Date -Format 'yyyyMMdd')"
New-Item -Path $backupPath -ItemType Directory -Force

# Copier les fichiers
Copy-Item -Path "C:\inetpub\wwwroot\huddleboard" -Destination $backupPath -Recurse

# Exporter configuration IIS
& "$env:windir\system32\inetsrv\appcmd.exe" list config /section:system.webServer > "$backupPath\iis-config.txt"

Write-Host "Sauvegarde terminée : $backupPath"
```

### Surveillance continue

**Script de monitoring basique :**
```powershell
# Vérifier disponibilité HuddleBoard
try {
    $response = Invoke-WebRequest -Uri "http://localhost/huddleboard" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ HuddleBoard accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ HuddleBoard inaccessible" -ForegroundColor Red
    # Envoyer alerte ou redémarrer service
}

# Vérifier utilisation disque
$freeSpace = (Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / 1GB
if ($freeSpace -lt 5) {
    Write-Host "⚠️ Espace disque faible : $([math]::Round($freeSpace,1))GB" -ForegroundColor Yellow
}
```

---

*Documentation adaptée pour environnement ThinManager - Version 1.1 - 03/06/2025*