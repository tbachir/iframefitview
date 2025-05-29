function escapeHtml(text) {
    if (typeof text !== "string") {
        if (text === undefined || text === null) return "";
        text = String(text);
    }
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

let config = null;
let currentProject = null;
let refreshTimer = null;
let resizeDebounceTimer = null;
let isIframeLoading = false;
let errorNotificationTimer = null;

async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        config = await response.json();
        console.log('Configuration chargée:', config);
        return true;
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration:', error);
        return false;
    }
}

function stopRefreshTimer() {
    if (refreshTimer) { 
        clearInterval(refreshTimer); 
        refreshTimer = null; 
    }
}

function startRefreshTimer(project) {
    const interval = project.refreshInterval || config.defaultRefreshInterval;
    if (interval) {
        refreshTimer = setInterval(async () => {
            console.log(`Tentative de rafraîchissement de ${project.name}`);
            await refreshIframe(project);
        }, interval);
    }
}

// Fonction pour rafraîchir l'iframe avec vérification préalable
async function refreshIframe(project) {
    const iframe = document.querySelector('.iframe-container iframe');
    if (!iframe) return;

    const newUrl = project.path + '?t=' + Date.now();
    
    try {
        // Vérifier que l'URL est accessible avant de modifier l'iframe
        const response = await fetch(newUrl, { 
            method: 'HEAD', // Utiliser HEAD pour économiser la bande passante
            mode: 'no-cors' // Éviter les erreurs CORS
        });
        
        // Si la requête réussit ou si on ne peut pas déterminer (no-cors), procéder
        console.log(`URL accessible: ${project.path}`);
        
        // Marquer le début du chargement
        isIframeLoading = true;
        
        // Mettre à jour l'URL avec le nouveau timestamp
        iframe.src = newUrl;
        
        // Cacher le message d'erreur s'il existe
        hideErrorNotification();
        
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'URL:', error);
        
        // Afficher une notification d'erreur
        showErrorNotification(project);
        
        // Ne pas modifier l'iframe, garder l'ancienne version
        isIframeLoading = false;
    }
}

// Fonction pour attacher les événements à l'iframe
function setupIframeEvents(iframe, project) {
    // Nettoyer les anciens listeners
    iframe.onload = null;
    iframe.onerror = null;
    
    // Gestionnaire de chargement réussi
    iframe.onload = function() {
        console.log('Iframe chargée avec succès');
        isIframeLoading = false;
        displayTimestamp();
        
        // Attendre un court instant pour s'assurer que le contenu est rendu
        setTimeout(() => {
            console.log('Application du fit-to-view après chargement');
            applyFitToView();
        }, 200);
    };

    // Gestionnaire d'erreur
    iframe.onerror = function() {
        console.error('Erreur lors du chargement de l\'iframe');
        isIframeLoading = false;
    };
}

// Fonction améliorée pour appliquer le fit-to-view
function applyFitToView() {
    // Si l'iframe est en cours de chargement, ne rien faire
    if (isIframeLoading) {
        console.log('Iframe en cours de chargement, fit-to-view reporté');
        return;
    }

    const frame = document.querySelector('.iframe-container iframe');
    if (!frame) {
        console.log('Iframe non trouvée');
        return;
    }

    const container = frame.parentElement;
    if (!container) {
        console.log('Container non trouvé');
        return;
    }

    try {
        // Réinitialiser les styles d'abord
        frame.style.width = '100%';
        frame.style.height = '100%';
        frame.style.transform = '';
        frame.style.transformOrigin = 'top left';
        frame.style.position = 'absolute';
        frame.style.top = '0';
        frame.style.left = '0';
        frame.style.margin = '0';

        // Utiliser les dimensions du conteneur disponible
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        console.log('Dimensions du conteneur:', containerWidth, 'x', containerHeight);

        // Tenter d'accéder au contenu (si même origine)
        let contentWidth = 1920;  // Valeur par défaut
        let contentHeight = 1080; // Valeur par défaut
        
        try {
            const frameDoc = frame.contentDocument || frame.contentWindow.document;

            if (frameDoc && frameDoc.body) {
                // S'assurer que le document est complètement chargé
                if (frameDoc.readyState === 'complete') {
                    // Forcer un reflow pour obtenir les vraies dimensions
                    frameDoc.body.style.display = 'none';
                    frameDoc.body.offsetHeight; // Force reflow
                    frameDoc.body.style.display = '';
                    
                    // Obtenir les dimensions réelles du contenu
                    contentWidth = Math.max(
                        frameDoc.documentElement.scrollWidth,
                        frameDoc.body.scrollWidth,
                        frameDoc.documentElement.offsetWidth,
                        frameDoc.body.offsetWidth,
                        1
                    );

                    contentHeight = Math.max(
                        frameDoc.documentElement.scrollHeight,
                        frameDoc.body.scrollHeight,
                        frameDoc.documentElement.offsetHeight,
                        frameDoc.body.offsetHeight,
                        1
                    );

                    console.log('Dimensions du contenu détectées:', contentWidth, 'x', contentHeight);
                } else {
                    console.log('Document pas encore complètement chargé');
                    // Réessayer plus tard
                    setTimeout(() => applyFitToView(), 500);
                    return;
                }
            }
        } catch (e) {
            // Contenu cross-origin ou autre erreur
            console.log('Impossible d\'accéder au contenu (CORS?), utilisation des dimensions par défaut');
        }

        // S'assurer que les dimensions sont valides
        if (contentWidth > 0 && contentHeight > 0 && containerWidth > 0 && containerHeight > 0) {
            // Calculer le facteur d'échelle pour fit-to-view
            const padding = 40; // Marge de sécurité
            const scaleX = (containerWidth - padding) / contentWidth;
            const scaleY = (containerHeight - padding) / contentHeight;
            const scale = Math.min(scaleX, scaleY, 1); // Ne jamais agrandir au-delà de 100%

            console.log('Facteurs d\'échelle - X:', scaleX.toFixed(3), 'Y:', scaleY.toFixed(3), 'Final:', scale.toFixed(3));

            if (scale < 0.99) { // Seulement si on doit réduire
                // Définir les dimensions originales de l'iframe
                frame.style.width = `${contentWidth}px`;
                frame.style.height = `${contentHeight}px`;
                
                // Appliquer la transformation
                frame.style.transform = `scale(${scale})`;
                
                // Calculer et appliquer le centrage
                const scaledWidth = contentWidth * scale;
                const scaledHeight = contentHeight * scale;
                const offsetX = Math.max(0, (containerWidth - scaledWidth) / 2);
                const offsetY = Math.max(0, (containerHeight - scaledHeight) / 2);
                
                frame.style.left = `${offsetX}px`;
                frame.style.top = `${offsetY}px`;
                
                console.log('Transformation appliquée - Scale:', scale, 'Offset:', offsetX, ',', offsetY);
            } else {
                console.log('Pas besoin de redimensionner (scale >= 1)');
            }
        } else {
            console.error('Dimensions invalides:', {
                contentWidth, contentHeight, containerWidth, containerHeight
            });
        }

    } catch (error) {
        console.error('Erreur dans applyFitToView:', error);
        // En cas d'erreur, réinitialiser les styles
        frame.style.width = '100%';
        frame.style.height = '100%';
        frame.style.transform = '';
        frame.style.margin = '';
        frame.style.position = '';
        frame.style.top = '';
        frame.style.left = '';
    }
}

// Initialiser le routeur
const router = new HashRouter({
    defaultRoute: 'projects',
    contentId: 'app-content',
    debug: true,
    onBeforeNavigate: (context) => {
        stopRefreshTimer();
        return true;
    }
});

// Liste des projets
router.route('projects', async (ctx) => {
    currentProject = null;
    document.title = 'Huddle Board';

    if (!config) {
        router.showDynamic(`
            <div class="container">
                <div class="header">
                    <h1>Huddle Board</h1>
                    <p>Chargement de la configuration...</p>
                </div>
                <div class="loading">
                    <p>Veuillez patienter...</p>
                </div>
            </div>
        `);
        const loaded = await loadConfig();
        if (!loaded) {
            router.showDynamic(`
                <div class="container">
                    <div class="error-message">
                        <h2>Erreur de configuration</h2>
                        <p>Impossible de charger le fichier config.json</p>
                        <button class="back-button" onclick="router.reload()" style="background: #3498db; margin-top: 1rem;">
                            Réessayer
                        </button>
                    </div>
                </div>
            `);
            return;
        }
    }

    router.showDynamic(() => {
        if (!config || !config.projects) {
            return `
                <div class="container">
                    <div class="error-message">
                        <h2>Erreur</h2>
                        <p>Impossible de charger la configuration des projets.</p>
                    </div>
                </div>
            `;
        }
        let html = `
            <div class="container">
                <div class="header">
                    <h1>Huddle Board</h1>
                    <p>Sélectionnez un projet à afficher</p>
                </div>
                <div class="projects-grid">
        `;
        const enabledProjects = config.projects.filter(p => p.enabled !== false);
        enabledProjects.forEach(project => {
            const icon = project.icon || '📊';
            html += `
                <div class="project-card" onclick="router.navigate('display/${project.slug}')">
                    <span class="project-icon">${icon}</span>
                    <div class="project-name">${escapeHtml(project.name)}</div>
                    ${project.description ?
                        `<div class="project-description">${escapeHtml(project.description)}</div>` : ''}
                </div>
            `;
        });
        html += `</div></div>`;
        return html;
    });
});

// Vue projet avec gestion améliorée du chargement
router.route('display/:slug', async (ctx) => {
    if (!config) {
        router.showDynamic('<div class="loading">Chargement de la configuration...</div>');
        const loaded = await loadConfig();
        if (!loaded) {
            router.navigate('projects');
            return;
        }
    }
    const projectSlug = ctx.params.slug;
    const project = config.projects.find(p => p.slug === projectSlug);
    if (!project) {
        router.navigate('404');
        return;
    }

    currentProject = project;
    document.title = `${project.name} - Huddle Board`;

    router.showDynamic(() => {
        const html = `
            <div class="display-view">
                <div class="display-header">
                    <h2>${escapeHtml(project.name)}</h2>
                    <div>
                        <a href="#projects" class="back-button">← Retour aux projets</a>
                    </div>
                </div>
                <div class="display-content">
                    <div class="iframe-container fullscreen-mode" id="iframe-container">
                        <iframe
                            id="project-iframe"
                            src="${escapeHtml(project.path)}"
                            title="${escapeHtml(project.name)}"
                            sandbox="allow-scripts allow-same-origin"
                            loading="lazy"></iframe>
                    </div>
                </div>
            </div>
        `;

        // Attendre que le DOM soit mis à jour
        setTimeout(() => {
            const iframe = document.querySelector('#project-iframe');
            if (iframe) {
                // Configurer les événements
                setupIframeEvents(iframe, project);
                
                // Si l'iframe est déjà chargée (cached), appliquer le fit immédiatement
                if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                    console.log('Iframe déjà chargée (cache), application du fit-to-view');
                    displayTimestamp();
                    setTimeout(() => applyFitToView(), 100);
                }
                
                // Démarrer le timer de rafraîchissement
                startRefreshTimer(project);
            }
        }, 100);

        return html;
    });
});

// 404
router.route('404', (ctx) => {
    document.title = 'Projet non trouvé - Huddle Board';
    router.showDynamic(`
        <div class="container">
            <div class="error-message">
                <h2>Projet non trouvé</h2>
                <p>Le projet demandé n'existe pas.</p>
                <a href="#projects" class="back-button" style="background: #3498db; margin-top: 1rem;">
                    Retour aux projets
                </a>
            </div>
        </div>
    `);
});

// Logging
router.use((ctx) => {
    console.log(`Navigation vers: ${ctx.route}`, ctx.params);
});

// Démarrer le routeur
router.init();

// Exposer le routeur pour les onclick
window.router = router;

// Gestion du redimensionnement avec debounce
window.addEventListener('resize', () => {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(() => {
        // Ne pas appliquer le fit si l'iframe est en cours de chargement
        if (!isIframeLoading && currentProject) {
            console.log('Redimensionnement de la fenêtre, réapplication du fit-to-view');
            applyFitToView();
        }
    }, 250);
});

// Fonctions pour gérer les notifications d'erreur
function showErrorNotification(project) {
    // Supprimer une notification existante
    hideErrorNotification();
    
    // Calculer le temps avant le prochain essai
    const interval = project.refreshInterval || config.defaultRefreshInterval;
    const nextTryInSeconds = Math.round(interval / 1000);
    
    // Créer la notification
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.id = 'refresh-error-notification';
    notification.innerHTML = `
        <span class="error-icon">⚠️</span>
        <div class="error-message">
            <div class="error-title">Mise à jour échouée</div>
            <div class="error-details">Nouvel essai dans ${nextTryInSeconds} secondes</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Mettre à jour le compte à rebours
    let secondsLeft = nextTryInSeconds;
    errorNotificationTimer = setInterval(() => {
        secondsLeft--;
        const details = notification.querySelector('.error-details');
        if (details && secondsLeft > 0) {
            details.textContent = `Nouvel essai dans ${secondsLeft} seconde${secondsLeft > 1 ? 's' : ''}`;
        } else {
            clearInterval(errorNotificationTimer);
        }
    }, 1000);
}

function hideErrorNotification() {
    const notification = document.getElementById('refresh-error-notification');
    if (notification) {
        notification.classList.add('hiding');
        setTimeout(() => notification.remove(), 300);
    }
    if (errorNotificationTimer) {
        clearInterval(errorNotificationTimer);
        errorNotificationTimer = null;
    }
}