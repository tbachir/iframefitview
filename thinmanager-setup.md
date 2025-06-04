# Configuration ThinManager pour HuddleBoard 24/7

## 1. Configuration Chrome dans ThinManager

### Paramètres de lancement Chrome recommandés :
```
chrome.exe --kiosk --disable-infobars --disable-session-crashed-bubble --disable-features=TranslateUI --check-for-update-interval=31449600 --disable-background-timer-throttling --disable-renderer-backgrounding --disable-features=RendererCodeIntegrity --no-first-run --disable-default-apps --disable-popup-blocking "http://votre-serveur/display/#/votre-slug"
```

### Flags importants :
- `--disable-background-timer-throttling` : Empêche Chrome de ralentir les timers en arrière-plan
- `--disable-renderer-backgrounding` : Maintient le rendu actif même si non visible
- `--check-for-update-interval=31449600` : Désactive les mises à jour automatiques

## 2. Configuration système Windows

### Task Scheduler - Redémarrage quotidien
Créer une tâche planifiée pour redémarrer Chrome tous les jours à 3h du matin :
```batch
taskkill /F /IM chrome.exe
timeout /t 5
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" [vos paramètres]
```

### Paramètres d'alimentation
- Désactiver la mise en veille
- Désactiver l'extinction de l'écran
- Mode haute performance

## 3. Monitoring et alertes

### Script PowerShell de surveillance
```powershell
# Monitor-HuddleBoard.ps1
$chromeProcess = Get-Process chrome -ErrorAction SilentlyContinue
if (-not $chromeProcess) {
    # Redémarrer Chrome
    Start-Process "chrome.exe" -ArgumentList "[vos paramètres]"
    # Envoyer alerte email/SNMP
}

# Vérifier utilisation mémoire
$memoryMB = $chromeProcess.WorkingSet64 / 1MB
if ($memoryMB -gt 2048) {
    # Redémarrer si > 2GB
    Stop-Process -Name chrome -Force
    Start-Sleep -Seconds 5
    Start-Process "chrome.exe" -ArgumentList "[vos paramètres]"
}
```

## 4. Configuration réseau

### Proxy et cache
- Configurer un proxy local si possible pour réduire la latence
- Désactiver le cache disque Chrome si espace limité : `--disk-cache-size=1`

### Timeout réseau
- Augmenter les timeouts TCP/IP dans le registre si connexion lente

## 5. Logs et diagnostic

### Activer les logs Chrome
```
--enable-logging --log-level=1 --dump-without-crashing
```

### Centraliser les logs
- Utiliser un serveur syslog pour collecter les logs
- Mettre en place des alertes sur les erreurs critiques

## 6. Optimisations supplémentaires du code

### Dans config.js, ajouter :
```javascript
window.AppConfig = {
    // ... existing config ...
    defaultRefreshInterval: 30000,
    maxConsecutiveErrors: 10,
    memoryThresholdMB: 1500,
    autoReloadHours: 12,
    networkTimeout: 10000,
    iframeLoadTimeout: 30000
};
```

### Mécanisme de fallback
En cas d'échec répété, afficher une page statique de maintenance :
```javascript
class FallbackDisplay {
    static show() {
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white; font-family: Arial;">
                <div style="text-align: center;">
                    <h1>Maintenance en cours</h1>
                    <p>Le système se reconnectera automatiquement</p>
                    <p style="opacity: 0.6">Dernière tentative : ${new Date().toLocaleTimeString()}</p>
                </div>
            </div>
        `;
    }
}
```

## 7. Tests de robustesse

Avant déploiement, tester :
- [ ] Coupure réseau de 5 minutes
- [ ] Redémarrage du serveur web
- [ ] Saturation mémoire Chrome
- [ ] Changement de contenu rapide
- [ ] Fonctionnement sur 48h continues

## 8. Métriques à surveiller

- Uptime du display
- Nombre de refresh réussis/échoués par heure
- Utilisation mémoire Chrome
- Temps de réponse du serveur
- Nombre de reloads forcés

Ces configurations garantiront un fonctionnement stable 24/7 dans votre environnement ThinManager.