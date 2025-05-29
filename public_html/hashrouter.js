/**
 * SimpleHashRouter - Version minimaliste du routeur
 */
class SimpleHashRouter {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        
        // Écouter uniquement hashchange
        window.addEventListener('hashchange', () => this.handleRoute());
        
        // Gérer la route initiale via DOMContentLoaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.handleRoute());
        } else {
            this.handleRoute();
        }
    }
    
    // Définir une route
    route(path, handler) {
        this.routes[path] = handler;
        return this;
    }
    
    // Naviguer vers une route
    navigate(path) {
        window.location.hash = path;
        return this;
    }
    
    // Gérer le changement de route
    handleRoute() {
        const hash = window.location.hash.slice(1) || 'projects';
        const [path, ...params] = hash.split('/');
        
        // Route simple
        if (this.routes[path]) {
            this.currentRoute = path;
            this.routes[path]();
            return;
        }
        
        // Route avec paramètre (ex: display/slug)
        const routeWithParam = `${path}/:param`;
        if (this.routes[routeWithParam]) {
            this.currentRoute = routeWithParam;
            this.routes[routeWithParam](params[0]);
            return;
        }
        
        // 404
        if (this.routes['404']) {
            this.routes['404']();
        }
    }
    
    // Afficher du contenu HTML
    render(html, targetId = 'app-content') {
        const element = document.getElementById(targetId);
        if (element) {
            element.innerHTML = html;
        }
        return this;
    }
}

// Export global
window.SimpleHashRouter = SimpleHashRouter;