window.AppConfig = {
    // Intervalles de rafraîchissement
    defaultRefreshInterval: 10000,
    refreshFailInterval: 8000,
    
    // Configuration debug
    debug: true,
    
    // Configuration des affichages
    displays: [
        {
            name: "Projet",
            slug: "projet",
            path: "displays/Projet/index.html",
            refreshInterval: 17000,
            description: "Description optionnelle"
        },
        {
            name: "OFFLINE 2",
            slug: "offline2",
            path: "./displays/Projet copy/index.html",
            description: "Description optionnelle"
        },
        {
            name: "Projet 3",
            slug: "projet-3",
            path: "./displays/Projet copy 3/index.html",
            description: "Description optionnelle"
        },
        {
            name: "Projet 4",
            slug: "projet-4",
            path: "./displays/Projet copy 4/index.html",
            description: "Description optionnelle"
        },
        {
            name: "Cas styles inline",
            slug: "styles-inline",
            path: "./displays/inline_styles_excel_like/index.html",
            description: "Fichier avec de nombreux styles inline"
        },
        {
            name: "Cas texte long",
            slug: "texte-long",
            path: "./displays/long_text_in_cell/index.html",
            refreshInterval: 8000,
            description: "Cellule contenant un texte très long"
        },
        {
            name: "Cas formules visibles",
            slug: "formules-visibles",
            path: "./displays/visible_formulas/index.html",
            description: "Cellules contenant des formules"
        },
        {
            name: "Cas tableaux imbriqués",
            slug: "tableaux-imbriques",
            path: "./displays/nested_tables/index.html",
            description: "Tableaux HTML imbriqués"
        },
        {
            name: "Cas cellules vides",
            slug: "cellules-vides",
            path: "./displays/empty_cells_with_width/index.html",
            description: "Cellules vides avec largeur définie"
        }
    ]
};