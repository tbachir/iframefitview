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
                        loading="lazy"></iframe>
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
let resizeDebounceTimer = null;
let isIframeLoading = false;
let iframe = false;
let errorNotificationTimer = null;

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
            manageRefreshTimer();
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
        const projectSlug = ctx.params.slug;
        const project = config.projects.find(p => p.slug === projectSlug);
        if (!project) {
            router.showDynamic(
                templates.error(
                    "Projet non trouvé",
                    `Le projet demandé (<code>${escapeHtml(projectSlug)}</code>) n'existe pas.<br>
                    <a href="#projects" class="back-button" style="margin-top:1rem;display:inline-block;">Retour aux projets</a>`
                )
            );
            return;
        }
        currentProject = project;
        document.title = `${project.name} - Huddle Board`;
        router.showDynamic(() => {
            setTimeout(() => {
                const iframe = document.querySelector('#project-iframe');
                if (iframe) {
                    setupIframeEvents(iframe, project);
                    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                        displayTimestamp();
                    }
                    manageRefreshTimer(project);
                }
            }, 100);
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

// Redimensionnement & notifications d’erreur
window.addEventListener('resize', () => {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(() => {
        if (!isIframeLoading && currentProject) {
            console.log('Redimensionnement de la fenêtre, réapplication du fit-to-view');
            applyFitToView();
        }
    }, 250);
});

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


function refreshIframe(project) {
    const iframe = document.querySelector('.iframe-container iframe');
    if (!iframe) {
        console.warn('[refreshIframe] Aucun iframe trouvé.');
        return;
    }
    const timestamp = Date.now();
    const newUrl = project.path + '?t=' + timestamp;
    console.log(`[refreshIframe] Tentative de rafraîchissement vers : ${newUrl}`);
    Object.assign(iframe.style, {});
    iframe.src = newUrl;
    return
    // Crée un iframe caché pour tester le chargement
    const testIframe = document.createElement('iframe');
    testIframe.style.display = 'none';
    testIframe.sandbox = 'allow-scripts allow-same-origin';

    testIframe.onload = function () {
        console.log('[refreshIframe] testIframe.onload déclenché. L\'URL est accessible, on met à jour l\'iframe principale.');
        isIframeLoading = true;
        iframe.src = newUrl;
        toggleErrorNotification(false);
        document.body.removeChild(testIframe);
    };

    testIframe.onerror = function () {
        console.error('[refreshIframe] testIframe.onerror déclenché. L\'URL n\'est PAS accessible, on conserve la version courante.');
        toggleErrorNotification(true, project);
        document.body.removeChild(testIframe);
    };

    testIframe.src = newUrl;
    document.body.appendChild(testIframe);

    console.log('[refreshIframe] testIframe ajouté au DOM pour vérification en arrière-plan.');
}



function setupIframeEvents(iframe, project) {
    iframe.onload = () => {
        isIframeLoading = false;
        // Attendre un peu que tout se charge
        setTimeout(() => {
            applyFitToView();

            // Observateur de mutations pour détecter les changements de taille dynamiques
            try {
                const doc = iframe.contentDocument;
                if (doc && window.MutationObserver) {
                    let observer = new MutationObserver(() => {
                        console.log('[applyFitToView] Mutation détectée dans l\'iframe, tentative de re-fit...');
                        applyFitToView();
                    });
                    observer.observe(doc.documentElement, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        characterData: true
                    });
                }
            } catch (e) {
                console.warn('[setupIframeEvents] Impossible de mettre en place le MutationObserver sur l\'iframe.', e);
            }
        }, 200); // délai à ajuster selon ton contenu
    };

    iframe.onerror = () => {
        isIframeLoading = false;
    };
}


let lastIframeHTML = '';
let lastWidth = null;
let lastHeight = null;
let lastScale = null;

function applyFitToView() {
    console.log('[applyFitToView] Appel de la fonction.');

    if (isIframeLoading) {
        console.log('[applyFitToView] isIframeLoading = true, arrêt de la fonction.');
        return;
    }

    const frame = document.querySelector('.iframe-container iframe');
    const container = frame?.parentElement;
    if (!frame) {
        console.warn('[applyFitToView] Aucun iframe trouvé.');
        return;
    }
    if (!container) {
        console.warn('[applyFitToView] Aucun container parent trouvé.');
        return;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    let contentWidth = 1;
    let contentHeight = 1;
    let currentHTML = '';
    try {
        const frameDoc = frame.contentDocument;
        if (frameDoc?.readyState === 'complete') {
            contentWidth = Math.max(frameDoc.documentElement.scrollWidth, frameDoc.body.scrollWidth, 1);
            contentHeight = Math.max(frameDoc.documentElement.scrollHeight, frameDoc.body.scrollHeight, 1);
            currentHTML = frameDoc.documentElement.innerHTML || '';
        }
    } catch (e) {
        console.warn('[applyFitToView] Impossible d\'accéder au document de l\'iframe (CORS ?).');
    }

    // Arrondir le scale à 3 chiffres après la virgule
    const padding = 0;
    let scale = Math.min(
        (containerWidth - padding) / contentWidth,
        (containerHeight - padding) / contentHeight,
        1
    );
    scale = Math.round(scale * 1000) / 1000;
    console.log((containerHeight - padding) / contentHeight);
    const frameStyle = {
        width: `${contentWidth}px`,
        height: `${contentHeight}px`,
        transform: `translate(-50%, -50%) ${scale < 0.99 ? ` scale(${scale})` : ''}`,
    };

    // Vérifie si le contenu, dimensions, et scale sont inchangés
    const isSame =
        lastIframeHTML === currentHTML &&
        lastWidth === contentWidth &&
        lastHeight === contentHeight &&
        lastScale === scale;
    if (!isSame) {
        // Log détaillé des différences
        if (lastIframeHTML !== currentHTML) {
            console.log('[applyFitToView] Différence détectée sur le HTML de l\'iframe.');
            // Pour de gros contenus, tu peux aussi faire :
            // console.log('lastIframeHTML:', lastIframeHTML);
            // console.log('currentHTML:', currentHTML);
            // ou juste comparer la longueur pour éviter la pollution :
            console.log('Longueur lastIframeHTML:', lastIframeHTML.length, 'Longueur currentHTML:', currentHTML.length);
        }
        if (lastWidth !== contentWidth) {
            console.log(`[applyFitToView] Différence détectée sur la largeur : lastWidth=${lastWidth} vs contentWidth=${contentWidth}`);
        }
        if (lastHeight !== contentHeight) {
            console.log(`[applyFitToView] Différence détectée sur la hauteur : lastHeight=${lastHeight} vs contentHeight=${contentHeight}`);
        }
        if (lastScale !== scale) {
            console.log(`[applyFitToView] Différence détectée sur le scale : lastScale=${lastScale} vs scale=${scale}`);
        }
    }
    if (isSame) {
        console.log('[applyFitToView] Aucun changement détecté (contenu, dimensions et scale inchangés). Pas de mise à jour du style.');
        return;
    }

    // Applique le style car il y a eu un changement
    Object.assign(frame.style, frameStyle);
    console.log('[applyFitToView] Mise à jour du style appliquée :', frameStyle);

    // Stocke le nouvel état
    lastIframeHTML = currentHTML;
    lastWidth = contentWidth;
    lastHeight = contentHeight;
    lastScale = scale;
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
