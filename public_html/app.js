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

function manageRefreshTimer(project = null) {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    if (project) {
        const interval = project.refreshInterval || config.defaultRefreshInterval;
        if (interval) {
            refreshTimer = setInterval(() => refreshIframe(project), interval);
        }
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
        toggleErrorNotification(false);

    } catch (error) {
        console.error('Erreur lors de la vérification de l\'URL:', error);

        // Afficher une notification d'erreur
        toggleErrorNotification(true, project);

        // Ne pas modifier l'iframe, garder l'ancienne version
        isIframeLoading = false;
    }
}

// Fonction pour attacher les événements à l'iframe
function setupIframeEvents(iframe, project) {
    iframe.onload = () => {
        isIframeLoading = false;
        displayTimestamp();
        setTimeout(applyFitToView, 200);
    };
    
    iframe.onerror = () => {
        isIframeLoading = false;
    };
}

// Fonction améliorée pour appliquer le fit-to-view
function applyFitToView() {
    if (isIframeLoading) return;
    
    const frame = document.querySelector('.iframe-container iframe');
    const container = frame?.parentElement;
    
    if (!frame || !container) return;
    
    // Reset styles
    Object.assign(frame.style, {
        width: '100%',
        height: '100%',
        transform: '',
        transformOrigin: 'top left',
        position: 'absolute',
        top: '0',
        left: '0',
        margin: '0'
    });
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Try to get content dimensions
    let contentWidth = 1920;
    let contentHeight = 1080;
    
    try {
        const frameDoc = frame.contentDocument;
        if (frameDoc?.readyState === 'complete') {
            contentWidth = Math.max(frameDoc.documentElement.scrollWidth, frameDoc.body.scrollWidth, 1);
            contentHeight = Math.max(frameDoc.documentElement.scrollHeight, frameDoc.body.scrollHeight, 1);
        }
    } catch (e) {
        // Use default dimensions for CORS
    }
    
    // Apply scale if needed
    const padding = 0;
    const scale = Math.min(
        (containerWidth - padding) / contentWidth,
        (containerHeight - padding) / contentHeight,
        1
    );
    
    if (scale < 0.99) {
        frame.style.width = `${contentWidth}px`;
        frame.style.height = `${contentHeight}px`;
        frame.style.transform = `scale(${scale})`;
        frame.style.left = `${Math.max(0, (containerWidth - contentWidth * scale) / 2)}px`;
        frame.style.top = `${Math.max(0, (containerHeight - contentHeight * scale) / 2)}px`;
    }
}

// Initialiser le routeur
const router = new HashRouter({
    defaultRoute: 'projects',
    contentId: 'app-content',
    debug: true,
    onBeforeNavigate: (context) => {
        manageRefreshTimer();
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
                    <div class="iframe-container" id="iframe-container">
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
                manageRefreshTimer(project);
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

function toggleErrorNotification(show, project = null) {
    const existing = document.getElementById('refresh-error-notification');
    if (existing) {
        existing.remove();
    }
    
    if (errorNotificationTimer) {
        clearInterval(errorNotificationTimer);
        errorNotificationTimer = null;
    }
    
    if (show && project) {
        // Créer et afficher la notification
        const interval = project.refreshInterval || config.defaultRefreshInterval;
        const seconds = Math.round(interval / 1000);
        
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.id = 'refresh-error-notification';
        notification.innerHTML = `
            <span class="error-icon">⚠️</span>
            <div class="error-message">
                <div class="error-title">Mise à jour échouée</div>
                <div class="error-details">Nouvel essai dans ${seconds} secondes</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Compte à rebours
        let remaining = seconds;
        errorNotificationTimer = setInterval(() => {
            if (--remaining > 0) {
                notification.querySelector('.error-details').textContent = 
                    `Nouvel essai dans ${remaining} seconde${remaining > 1 ? 's' : ''}`;
            } else {
                clearInterval(errorNotificationTimer);
            }
        }, 1000);
    }
}
