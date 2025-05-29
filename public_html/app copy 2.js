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
    error: (title, message) => `
        <div class="container">
            <div class="error-message">
                <h2>${escapeHtml(title)}</h2>
                <p>${message}</p>
                <a href="/#" class="back-button" >
                    Recharger la page
                </a>
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
    displayProject: (project) => `
        <div class="display-view">
            <div class="display-header">
                <div>
                    <a href="/#" class="back-button">←</a>
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
                        ></iframe>
                </div>
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

let config = null;
let currentProject = null;
let refreshTimer = null;
let isIframeLoading = false;
let errorNotificationTimer = null;

// ------ NOUVEAU: Fit-to-View découplé (état global unique) ------
let fitState = {
    lastHTML: '',
    lastWidth: null,
    lastHeight: null,
    lastScale: null,
    observer: null,
    iframe: null,
    _mutationTimer: null,
    _resizeTimer: null
};

// Initialise le fitting sur une iframe (à appeler au onload de l’iframe)
function initFitToView(iframe) {
    fitState.iframe = iframe;

    // Déconnexion d'un observer précédent
    if (fitState.observer) {
        fitState.observer.disconnect();
        fitState.observer = null;
    }

    // Mise en place d’un MutationObserver
    try {
        const doc = iframe.contentDocument;
        if (doc && window.MutationObserver) {
            fitState.observer = new MutationObserver(() => {
                clearTimeout(fitState._mutationTimer);
                fitState._mutationTimer = setTimeout(() => {
                    updateFitToView(iframe);
                }, 100);
            });
            fitState.observer.observe(doc.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
            });
        }
    } catch (e) {
        console.warn('[initFitToView] Impossible de mettre en place le MutationObserver.', e);
    }

    // Premier fit immédiat
    updateFitToView(iframe);
}

// Met à jour le fitting (sur resize/mutation/contenu)
function updateFitToView(iframe = fitState.iframe) {
    if (!iframe) return;
    let contentWidth = 1, contentHeight = 1, currentHTML = '';
    try {
        const frameDoc = iframe.contentDocument;
        if (frameDoc?.readyState === 'complete') {
            contentWidth = Math.max(frameDoc.documentElement.scrollWidth, frameDoc.body.scrollWidth, 1);
            contentHeight = Math.max(frameDoc.documentElement.scrollHeight, frameDoc.body.scrollHeight, 1);
            currentHTML = frameDoc.documentElement.innerHTML || '';
        }
    } catch (e) {
        console.warn('[updateFitToView] Impossible d\'accéder au document de l\'iframe.', e);
    }

    // Dimensions du viewport (fenêtre)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let scale = Math.min(
        viewportWidth / contentWidth,
        viewportHeight / contentHeight,
        1
    );
    scale = Math.round(scale * 1000) / 1000;

    // Skip si rien n’a changé
    const isSame =
        fitState.lastHTML === currentHTML &&
        fitState.lastWidth === contentWidth &&
        fitState.lastHeight === contentHeight &&
        fitState.lastScale === scale;
    if (isSame) return;

    // Appliquer les styles
    Object.assign(iframe.style, {
        width: `${contentWidth}px`,
        height: `${contentHeight}px`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%)${scale < 0.99 ? ` scale(${scale})` : ''}`
    });

    // Stocker l’état
    fitState.lastHTML = currentHTML;
    fitState.lastWidth = contentWidth;
    fitState.lastHeight = contentHeight;
    fitState.lastScale = scale;
}

// ------ FIN refactor Fit-to-View ------

// --------- Chargement unique config avant démarrage de l'app ----------
async function startApp() {
    document.getElementById('app-content').innerHTML = templates.loadingConfig;
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        config = await response.json();
        if (!config.projects || !Array.isArray(config.projects)) {
            throw new Error('Le fichier config.json est mal formé (clé "projects" manquante ou invalide).');
        }
        runRouter();
    } catch (error) {
        document.getElementById('app-content').innerHTML = templates.error(
            "Erreur de configuration",
            escapeHtml(error.message || "Impossible de charger le fichier config.json")
        );
    }
}
// ---------------------------------------------------------------------

// --------- ROUTER ----------
function runRouter() {
    const router = new HashRouter({
        defaultRoute: 'projects',
        contentId: 'app-content',
        debug: true,
        onBeforeNavigate: (context) => {
            
            return true;
        }
    });

    // Liste des projets
    router.route('projects', (ctx) => {
        currentProject = null;
        document.title = 'Huddle Board';
        router.showDynamic(() => templates.projectsList(config.projects));
    });

    // Vue projet
    router.route('display/:slug', (ctx) => {
        console.log('router display')
        const projectSlug = ctx.params.slug;
        const project = config.projects.find(p => p.slug === projectSlug);
        if (!project) {
            return;
        }
        currentProject = project;
        router.showDynamic(() => {
            return templates.displayProject(project);
        });
    });

    // Route 404 et fallback
    router.route('404', (ctx) => {
        router.showDynamic(
            templates.error(
                "Page non trouvée",
                `La page demandée n'existe pas.<br>
                 <a href="#projects" class="back-button" style="margin-top:1rem;display:inline-block;">Retour aux projets</a>`
            )
        );
    });

    router.use((ctx) => {
        console.log(`Navigation vers: ${ctx.route}`, ctx.params);
    });

    router.init();
    window.router = router;
}
// --------- FIN ROUTER ----------

// Redimensionnement global du viewport → updateFitToView
window.addEventListener('resize', () => {
    clearTimeout(fitState._resizeTimer);
    fitState._resizeTimer = setTimeout(() => {
        updateFitToView();
    }, 100);
});

function manageRefreshTimer() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
        refreshTimer = setInterval(() => refreshIframe(), config.defaultRefreshInterval );
}

function refreshIframe() {
    const iframe = document.querySelector('.iframe-container iframe');
    if (!iframe) {
        console.warn('[refreshIframe] Aucun iframe trouvé.');
        return;
    }
    // 1. Sauvegarder l’URL courante
    const previousUrl = iframe.src;
    // 2. Générer la nouvelle URL (cache-buster)
    const timestamp = Date.now();
    const newUrl = currentProject.path + '?t=' + timestamp;
    console.log(`[refreshIframe] Tentative de rafraîchissement vers : ${newUrl}`);

    // 3. Préparer une surveillance du chargement
    let hasLoaded = false;
    let loadTimeout;
    let errorTimeout;

    // Nettoyer les anciens écouteurs éventuels (pour éviter les leaks)
    iframe.onload = null;
    iframe.onerror = null;

    // 4. Définir ce qui se passe quand le nouvel iframe a fini de charger
    iframe.onload = function () {
        hasLoaded = true;
        // Attendre un court délai pour s’assurer que le contenu est OK
        setTimeout(() => {
            try {
                const doc = iframe.contentDocument;
                const html = doc?.documentElement?.innerHTML || '';
                const ok = (doc?.readyState === 'complete') && html.length > 100; // Seuil ajustable
                if (ok) {
                    console.log('[refreshIframe] Nouveau contenu chargé avec succès.');
                    // On ne fait rien de spécial, on garde ce contenu.
                    toggleErrorNotification(false);
                } else {
                    throw new Error("Contenu chargé vide ou incomplet.");
                }
            } catch (e) {
                console.warn('[refreshIframe] Chargement incomplet, on restaure l’ancienne version.', e);
                iframe.src = previousUrl; // On restaure l’ancien contenu
                toggleErrorNotification(true, currentProject);
            }
        }, 200);
        clearTimeout(errorTimeout);
    };

    // 5. Timeout de sécurité (ex: 5 secondes) : si jamais le onload ne vient pas
    errorTimeout = setTimeout(() => {
        if (!hasLoaded) {
            console.warn('[refreshIframe] Timeout : chargement trop long, on restaure l’ancienne version.');
            iframe.src = previousUrl;
            toggleErrorNotification(true, project);
        }
    }, 5000);

    // 6. On lance le refresh
    iframe.src = newUrl;
}

function setupIframeEvents(iframe) {
    iframe.onload = () => {
        isIframeLoading = false;
        
        setTimeout(() => {
            // Appel unique au initFitToView (setup + 1er fit)
            initFitToView(iframe);
            displayTimestamp();
                    
        }, 200); // délai à ajuster si besoin
    };

    iframe.onerror = () => {
        isIframeLoading = false;
    };
    manageRefreshTimer();
}

function toggleErrorNotification(show, project = null) {
    const existing = document.getElementById('refresh-error-notification');
    if (existing) existing.remove();
    if (errorNotificationTimer) {
        clearInterval(errorNotificationTimer);
        errorNotificationTimer = null;
    }
    if (show && project) {
        const interval = project.refreshInterval || config.defaultRefreshInterval;
        const seconds = Math.round(interval / 1000);
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.id = 'refresh-error-notification';
        notification.innerHTML = templates.refreshErrorNotification(seconds);
        document.body.appendChild(notification);
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

// Lancement unique après chargement de la page (DOMContentLoaded géré par le routeur)
startApp();
