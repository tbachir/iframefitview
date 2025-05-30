window.CONFIG = {
    app: {
        title: "Huddle Board",
        defaultRefreshInterval: 30000,
        defaultResizeMode: "scale",
        maxRetries: 3,
        healthCheckInterval: 30000
    },
    projects: [
        {
            name: "Projet Principal",
            slug: "projet",
            path: "projects/Projet/index.html",
            refreshInterval: 7000,
            description: "Tableau principal avec données"
        },
        {
            name: "Grande Hauteur",
            slug: "hauteur",
            path: "projects/Projet copy/index.html",
            description: "Test de performance avec 300 lignes"
        },
        {
            name: "Largeur Excessive", 
            slug: "largeur",
            path: "projects/Projet copy 2/index.html",
            description: "Test avec 20+ colonnes"
        },
        {
            name: "Avec Images",
            slug: "images", 
            path: "projects/Projet copy 3/index.html",
            description: "Tableaux contenant des images"
        },
        {
            name: "Cellules Fusionnées",
            slug: "fusion",
            path: "projects/Projet copy 4/index.html", 
            description: "Rowspan et colspan"
        },
        {
            name: "Styles Inline",
            slug: "styles-inline",
            path: "projects/inline_styles_excel_like/index.html",
            description: "Styles Excel inline"
        },
        {
            name: "Texte Long",
            slug: "texte-long", 
            path: "projects/long_text_in_cell/index.html",
            refreshInterval: 8000,
            description: "Cellule avec texte très long"
        },
        {
            name: "Formules Visibles",
            slug: "formules",
            path: "projects/visible_formulas/index.html",
            description: "Formules =A2+B2 affichées"
        },
        {
            name: "Tableaux Imbriqués", 
            slug: "imbriques",
            path: "projects/nested_tables/index.html",
            description: "Tables dans des cellules"
        },
        {
            name: "Cellules Vides",
            slug: "vides",
            path: "projects/empty_cells_with_width/index.html",
            description: "Cellules vides avec largeur CSS"
        }
    ]
};