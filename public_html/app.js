// Configuration et état global
let config = window.CONFIG;
let currentProject = null;
let refreshTimer = null;

// Templates HTML
const templates = {
    loading: () => `
        <div class="container">
            <div class="header">
                <h1>Huddle Board</h1>
                <p>Chargement...</p>
            </div>
        </div>
    `,
    error: (title, message) => `
        <div class="container">
            <div class="error-message">
                <h2>${title}</h2>
                <p>${message}</p>
                <button onclick="location.reload()">Réessayer</button>
            </div>
        </div>
    `,

    projects: (projects) => `
        <div class="container">
            <div class="header">
                <h1>Huddle Board</h1>
                <p>Sélectionnez un projet</p>
            </div>
            <div class="projects-grid">
                ${projects.map(p => `
                    <div class="project-card" onclick="router.navigate('display/${p.slug}')">
                        <span class="project-icon">📊</span>
                        <div class="project-name">${p.name}</div>
                        ${p.description ? `<div class="project-description">${p.description}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `,

    display: (project) => `
        <div class="display-view">
            <div class="display-header">
                <a href="#projects" class="back-button">←</a>
                <h3>${project.name}</h3>
            </div>
            <div class="iframe-container">
                <iframe 
                    src="${project.path}?t=${Date.now()}"
                    onload="handleIframeLoad()"
                    onerror="handleIframeError()">
                </iframe>
            </div>
        </div>
    `,
};


// Gérer le timer de rafraîchissement
function setRefreshTimer(project) {
    clearInterval(refreshTimer);
    if (project) {
        const interval = project.refreshInterval || window.CONFIG.defaultRefreshInterval || 30000;
        refreshTimer = setInterval(() => {
            const iframe = document.querySelector('.iframe-container iframe');
           
        }, interval);
    }
}

// Appliquer le zoom/scale à l'iframe
const fitIframe = debounce(() => {
    const iframe = document.querySelector('iframe');
    const container = iframe?.parentElement;
    if (!iframe || !container) return;

    try {
        const doc = iframe.contentDocument;
        if (doc) {
            // Masquer les scrollbars
            const style = doc.createElement('style');
            style.textContent = 'html, body { overflow: hidden !important; margin: 0; padding: 0; }';
            doc.head.appendChild(style);

            // Calculer et appliquer le scale
            const contentW = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth, 1);
            const contentH = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 1);
            const containerW = container.clientWidth;
            const containerH = container.clientHeight;

            const scale = Math.min(containerW / contentW, containerH / contentH, 1);

            iframe.style.width = `${contentW}px`;
            iframe.style.height = `${contentH}px`;
            iframe.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
    } catch (e) {
        // CORS - utiliser dimensions par défaut
        iframe.style.width = '1920px';
        iframe.style.height = '1080px';
        iframe.style.transform = 'translate(-50%, -50%) scale(0.5)';
    }
}, 100);

function preloadProject(project) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = project.path;
    document.body.appendChild(iframe);
    // Retirer après chargement
}
// Gestionnaires globaux pour l'iframe
window.handleIframeLoad = function () {
    fitIframe();
    displayTimestamp();
};

window.handleIframeError = function () {
    console.error('Erreur iframe');
    showErrorNotification('Impossible de charger l\'affichage');
};

// Timestamp
window.displayTimestamp = function() {
    const now = new Date();
    const time = now.toLocaleString('fr-FR');
    let div = document.querySelector('.refresh-indicator');
    if (!div) {
        div = document.createElement('div');
        div.className = 'refresh-indicator';
        document.body.appendChild(div);
    }
    div.textContent = `m.a.j : ${time}`;
};

// Initialiser le routeur
const router = new SimpleHashRouter();

// Route: Liste des projets
router.route('projects', async () => {
    setRefreshTimer(null);
    currentProject = null;

    router.render(templates.projects(window.CONFIG.projects));
});

// Route: Affichage projet
router.route('display/:param', async (slug) => {
    currentProject = window.CONFIG.projects.find(p => p.slug === slug);
    if (currentProject) {
        router.render(templates.display(currentProject));
        setRefreshTimer(currentProject);
    } else {
        router.render(templates.error('Erreur', "Vous essayer d'acceder à un projet qui n'est pas configuré ou le lie utilisé est incorrect."));
    }
});

// Redimensionnement
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitIframe, 250);
});

// Exposer le routeur globalement
window.router = router;