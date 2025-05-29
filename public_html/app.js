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

const templates = {
    loadingConfig: `
        <div class="container">
            <div class="header">
                <h1>Huddle Board</h1>
                <p>Chargement de la configuration...</p>
            </div>
            <div class="loading">
                <p>Veuillez patienter...</p>
            </div>
        </div>
    `,
    configError: `
        <div class="container">
            <div class="error-message">
                <h2>Erreur de configuration</h2>
                <p>Impossible de charger le fichier config.json</p>
                <button class="back-button" onclick="router.reload()">
                    Réessayer
                </button>
            </div>
        </div>
    `,
    projectsList: (projects) => `
        <div class="container">
            <div class="header">
                <h1>Huddle Board</h1>
                <p>Sélectionnez un projet à afficher</p>
            </div>
            <div class="projects-grid">
                ${projects.map(project => `
                    <div class="project-card" onclick="router.navigate('display/${project.slug}')">
                        <span class="project-icon">${project.icon || '📊'}</span>
                        <div class="project-name">${escapeHtml(project.name)}</div>
                        ${project.description ? `<div class="project-description">${escapeHtml(project.description)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `,
    loadingConfigMinimal: `
        <div class="loading">Chargement de la configuration...</div>
    `,
    displayProject: (project) => `
        <div class="display-view">
            <div class="display-header">
                <div>
                    <a href="#projects" class="back-button">←</a>
                </div>
                <h3>${escapeHtml(project.name)}</h3>
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
    `,
    notFound: `
        <div class="container">
            <div class="error-message">
                <h2>Projet non trouvé</h2>
                <p>Le projet demandé n'existe pas.</p>
                <a href="#projects" class="back-button" style="background: #3498db; margin-top: 1rem;">
                    Retour aux projets
                </a>
            </div>
        </div>
    `,
    refreshErrorNotification: (seconds = 10) => `
        <span class="error-icon">⚠️</span>
        <div class="error-message">
            <div class="error-title">Mise à jour échouée</div>
            <div class="error-details">Nouvel essai dans ${seconds} secondes</div>
        </div>
    `
};
// ----------- FIN TEMPLATES -----------

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

    const timestamp = Date.now();
    const newUrl = project.path + '?t=' + timestamp;

    try {
        // Construire l'URL absolue correctement pour le fetch
        const currentLocation = window.location;
        const baseUrl = `${currentLocation.protocol}//${currentLocation.host}${currentLocation.pathname}`;
        const absoluteUrl = new URL(project.path, baseUrl).href + '?t=' + timestamp;

        console.log(`Vérification de l'URL: ${absoluteUrl}`);

        // Vérifier que l'URL est accessible
        const response = await fetch(absoluteUrl, {
            mode: 'no-cors'
        });

        console.log(`URL accessible: ${project.path}`);

        // Marquer le début du chargement
        isIframeLoading = true;

        // Utiliser l'URL relative pour l'iframe
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

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Try to get content dimensions
    let contentWidth = 1920;
    let contentHeight = 1080;

    try {
        const frameDoc = frame.contentDocument;
 hideIframeScrollbars(frameDoc);
        
        if (frameDoc?.readyState === 'complete') {
            contentWidth = Math.max(frameDoc.documentElement.scrollWidth, frameDoc.body.scrollWidth, 1);
            contentHeight = Math.max(frameDoc.documentElement.scrollHeight, frameDoc.body.scrollHeight, 1);
        }
    } catch (e) {
        // Use default dimensions for CORS
    }

    // Apply scale if needed
    const padding = 10;
    const scale = Math.min(
        (containerWidth - padding) / contentWidth,
        (containerHeight - padding) / contentHeight,
        1
    );

    const frameStyle = {
        width: `${contentWidth}px`,
        height: `${contentHeight}px`,
        transform: 'translate(-50%, -50%)',
    }
    if (scale < 0.99) {
        frameStyle.transform += ` scale(${scale})`;
    }
    Object.assign(frame.style, frameStyle);
}

function hideIframeScrollbars(frameDoc) {
                try {
                    // Créer head si absent (cas rares d'export Excel HTML minimal)
                    if (!frameDoc.head) {
                        var head = frameDoc.createElement('head');
                        frameDoc.documentElement.insertBefore(head, frameDoc.body);
                    }
                    var style = frameDoc.createElement('style');
                    style.innerHTML = 'html, body { overflow: hidden !important; margin: 0; padding: 0; }';
                    frameDoc.head.appendChild(style);
                    frameDoc.documentElement.style.overflow = "hidden";
                    frameDoc.body.style.overflow = "hidden";
                } catch (e) { }
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
        router.showDynamic(templates.loadingConfig);
        const loaded = await loadConfig();
        if (!loaded) {
            router.showDynamic(templates.configError);
            return;
        }
    }

    // Utilisation du template dynamique
    router.showDynamic(() => templates.projectsList(config.projects));
});

// Vue projet avec gestion améliorée du chargement
router.route('display/:slug', async (ctx) => {
    if (!config) {
        router.showDynamic(templates.loadingConfigMinimal);
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
        // Injection du template dynamique d'affichage de projet
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

        return templates.displayProject(project);
    });
});

// 404
router.route('404', (ctx) => {
    document.title = 'Projet non trouvé - Huddle Board';
    router.showDynamic(templates.notFound);
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
        notification.innerHTML = templates.refreshErrorNotification(seconds);

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
