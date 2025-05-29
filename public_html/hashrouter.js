/**
 * HashRouter.js - Lightweight Hash Navigation Library
 * @version 1.0.0
 * @author Assistant
 * @license MIT
 */

(function (window) {
    'use strict';

    /**
     * HashRouter - Système de navigation par hash
     * @class
     */
    class HashRouter {
        constructor(options = {}) {
            // Configuration
            this.config = {
                defaultRoute: options.defaultRoute || '',
                notFoundRoute: options.notFoundRoute || '404',
                autoStart: options.autoStart !== false,
                debug: options.debug || false,
                contentId: options.contentId || 'app-content',
                onNavigate: options.onNavigate || null,
                onBeforeNavigate: options.onBeforeNavigate || null
            };

            // État interne
            this.routes = new Map();
            this.currentRoute = null;
            this.previousRoute = null;
            this.params = {};
            this.query = {};
            this.initialized = false;
            this.middleware = [];

            // Démarrage automatique si demandé
            if (this.config.autoStart) {
                this.init();
            }
        }

        /**
         * Initialise le routeur
         */
        init() {
            if (this.initialized) {
                this.log('Router already initialized');
                return this;
            }

            // Événements
            window.addEventListener('hashchange', (e) => this._handleHashChange(e));
            window.addEventListener('load', () => this._handleInitialLoad());

            // Si la page est déjà chargée
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                this._handleInitialLoad();
            }

            this.initialized = true;
            this.log('Router initialized');

            return this;
        }

        /**
         * Ajoute une route
         * @param {string} path - Chemin de la route (ex: 'user/:id')
         * @param {Function|Object} handler - Handler ou configuration
         */
        route(path, handler) {
            if (typeof handler === 'function') {
                this.routes.set(path, { handler });
            } else if (typeof handler === 'object') {
                this.routes.set(path, handler);
            } else {
                throw new Error('Handler must be a function or configuration object');
            }

            this.log(`Route added: ${path}`);
            return this;
        }

        /**
         * Ajoute plusieurs routes
         * @param {Object} routes - Objet de routes
         */
        addRoutes(routes) {
            Object.entries(routes).forEach(([path, handler]) => {
                this.route(path, handler);
            });
            return this;
        }

        /**
         * Ajoute un middleware
         * @param {Function} middleware - Fonction middleware
         */
        use(middleware) {
            if (typeof middleware === 'function') {
                this.middleware.push(middleware);
            }
            return this;
        }

        /**
         * Navigation vers une route
         * @param {string} path - Chemin de navigation
         * @param {Object} options - Options de navigation
         */
        navigate(path, options = {}) {
            const currentHash = this._getHash();

            // Nettoyer le path
            path = this._cleanPath(path);

            // Si c'est la même route et pas de force, on ne fait rien
            if (path === currentHash && !options.force) {
                this.log('Already on this route');
                return this;
            }

            // Si replace, on remplace l'historique
            if (options.replace) {
                window.location.replace(`#${path}`);
            } else {
                window.location.hash = path;
            }

            return this;
        }

        /**
         * Navigue en arrière
         */
        back() {
            window.history.back();
            return this;
        }

        /**
         * Recharge la route actuelle
         */
        reload() {
            const currentHash = this._getHash();
            this._navigateToRoute(currentHash, { force: true });
            return this;
        }

        /**
         * Affiche du contenu dynamique
         * @param {string|Function|Object} content - Contenu à afficher
         * @param {string} targetId - ID de l'élément cible (optionnel)
         */
        showDynamic(content, targetId) {
            const target = targetId || this.config.contentId;
            const element = document.getElementById(target);

            if (!element) {
                console.error(`Element with id "${target}" not found`);
                return this;
            }

            // Si content est une fonction, on l'exécute avec le contexte actuel
            if (typeof content === 'function') {
                const result = content({
                    route: this.currentRoute,
                    params: this.params,
                    query: this.query,
                    router: this
                });

                // Si la fonction retourne une promesse
                if (result && typeof result.then === 'function') {
                    result.then(html => this._renderContent(element, html));
                } else {
                    this._renderContent(element, result);
                }
            }
            // Si content est un objet avec html et targetId
            else if (typeof content === 'object' && content.html) {
                const finalTarget = content.targetId ?
                    document.getElementById(content.targetId) : element;
                this._renderContent(finalTarget, content.html);
            }
            // Sinon on considère que c'est du HTML direct
            else {
                this._renderContent(element, content);
            }

            return this;
        }


        _handleInitialLoad() {
            const hash = this._getHash() || this.config.defaultRoute;
            this._navigateToRoute(hash, { initial: true });
        }

        _handleHashChange(event) {
            const newHash = this._getHash() || this.config.defaultRoute;
            const oldHash = this.currentRoute;

            // Vérifier que le hash a changé
            if (newHash === oldHash) {
                return;
            }

            this.log(`Navigation: ${oldHash} -> ${newHash}`);
            this._navigateToRoute(newHash, { event });
        }

        async _navigateToRoute(path, options = {}) {
            // Nettoyer le path
            path = this._cleanPath(path);

            // Parser query params
            const [routePath, queryString] = path.split('?');
            this.query = this._parseQueryString(queryString);

            // Before navigate callback
            if (this.config.onBeforeNavigate) {
                const canNavigate = await this.config.onBeforeNavigate({
                    from: this.currentRoute,
                    to: routePath,
                    router: this
                });

                if (canNavigate === false) {
                    // Restaurer l'ancien hash si la navigation est annulée
                    if (this.currentRoute && !options.initial) {
                        window.history.replaceState(null, null, `#${this.currentRoute}`);
                    }
                    return;
                }
            }

            // Mettre à jour l'état
            this.previousRoute = this.currentRoute;
            this.currentRoute = routePath;

            // Trouver la route correspondante
            let routeFound = false;

            for (let [pattern, config] of this.routes) {
                const params = this._matchRoute(pattern, routePath);

                if (params !== null) {
                    this.params = params;

                    // Exécuter les middlewares
                    const context = {
                        route: routePath,
                        params,
                        query: this.query,
                        router: this
                    };

                    for (let middleware of this.middleware) {
                        await middleware(context);
                    }

                    // Exécuter le handler
                    if (config.handler) {
                        await config.handler(context);
                    }

                    routeFound = true;
                    break;
                }
            }

            // Route non trouvée
            if (!routeFound) {
                this._handleNotFound(routePath);
            }

            // After navigate callback
            if (this.config.onNavigate) {
                this.config.onNavigate({
                    from: this.previousRoute,
                    to: this.currentRoute,
                    params: this.params,
                    query: this.query,
                    router: this
                });
            }

            // Émettre un événement personnalisé
            window.dispatchEvent(new CustomEvent('hashroute', {
                detail: {
                    from: this.previousRoute,
                    to: this.currentRoute,
                    params: this.params,
                    query: this.query
                }
            }));
        }

        _matchRoute(pattern, path) {
            // Correspondance exacte
            if (pattern === path) {
                return {};
            }

            // Pattern avec wildcards (*)
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '(.*)') + '$');
                const match = path.match(regex);
                if (match) {
                    return { wildcard: match[1] };
                }
            }

            // Pattern avec paramètres (:param)
            const patternParts = pattern.split('/');
            const pathParts = path.split('/');

            if (patternParts.length !== pathParts.length) {
                return null;
            }

            const params = {};

            for (let i = 0; i < patternParts.length; i++) {
                if (patternParts[i].startsWith(':')) {
                    params[patternParts[i].slice(1)] = pathParts[i];
                } else if (patternParts[i] !== pathParts[i]) {
                    return null;
                }
            }

            return params;
        }

        _handleNotFound(path) {
            this.log(`Route not found: ${path}`);

            // Chercher une route 404
            const notFoundConfig = this.routes.get(this.config.notFoundRoute);
            if (notFoundConfig && notFoundConfig.handler) {
                notFoundConfig.handler({
                    route: path,
                    params: {},
                    query: this.query,
                    router: this
                });
            } else {
                // Affichage par défaut
                this.showDynamic(`
                    <div style="text-align: center; padding: 50px;">
                        <h1>404</h1>
                        <p>Page non trouvée: ${path}</p>
                        <a href="#${this.config.defaultRoute}">Retour à l'accueil</a>
                    </div>
                `);
            }
        }

        _renderContent(element, html) {
            if (typeof html === 'string') {
                element.innerHTML = html;
            } else if (html instanceof HTMLElement) {
                element.innerHTML = '';
                element.appendChild(html);
            }
        }

        _getHash() {
            return window.location.hash.slice(1);
        }

        _cleanPath(path) {
            return path.replace(/^#/, '').replace(/\/$/, '') || this.config.defaultRoute;
        }

        _parseQueryString(queryString) {
            if (!queryString) return {};

            return queryString.split('&').reduce((params, param) => {
                const [key, value] = param.split('=');
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
                return params;
            }, {});
        }

        log(message) {
            if (this.config.debug) {
                console.log(`[HashRouter] ${message}`);
            }
        }
    }

    // Export
    window.HashRouter = HashRouter;

})(window);