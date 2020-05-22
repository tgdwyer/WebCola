describe("Run Examples", () => {
    const examples = [
        "downwardedges",
        "unconstrained",
        "unconstrainedsmallworld",
        "nonoverlapping",
        "smallnonoverlappinggraph",
        "modifyinggraph",
        "onlinebrowse",
        "alignment",
        "smallgroups",
        "browsemovies",
        "sucrosebreakdown",
        "unix",
        "ariel",
        "egonetwork",
        "disconnected_graphs",
        "powergraph",
        "3dLayout",
        "dotpowergraph",
        "gridifiedSmallGroups",
        "3dtree",
        "cygenegene",
        "pageBoundsConstraints",
        "smallworldwithgroups",
        "brainnetwork2"
    ];
    examples.forEach((example) => {
        it(example, () => cy.visit(`./examples/${example}.html`));
    });
});