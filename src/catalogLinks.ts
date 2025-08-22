// Link reali (verificati) alle sezioni principali del catalogo Tessiamo
// Fonti confermate: /3-pannelli-in-tessuto, /4-tessuti-al-metro, /7-prodotti-sagomati, /8-pronto-stampa,
// e sotto-categorie /6-bavaglini, /28-shopper.
// Riferimenti: homepage e categorie visibili. 
// (Vedi note: alcune sotto-categorie come "grembiuli" appaiono prevalentemente con URL di prodotto.)
export const CATALOG_LINKS: Record<string, string> = {
  "home": "https://tessiamo.it/",
  "tessuti": "https://tessiamo.it/4-tessuti-al-metro",
  "pannelli": "https://tessiamo.it/3-pannelli-in-tessuto",
  "prodotti-sagomati": "https://tessiamo.it/7-prodotti-sagomati",
  "pronto-stampa": "https://tessiamo.it/8-pronto-stampa",
  // sotto-categorie frequenti:
  "bavaglini": "https://tessiamo.it/6-bavaglini",
  "shopper": "https://tessiamo.it/28-shopper"
};

export function getCanonicalLink(key: string): string | undefined {
  return CATALOG_LINKS[key];
}

export function catalogoMessage(): string {
  return [
    "🧵 *Catalogo Tessiamo*",
    "• Tessuti al metro: https://tessiamo.it/4-tessuti-al-metro",
    "• Pannelli in tessuto: https://tessiamo.it/3-pannelli-in-tessuto",
    "• Prodotti sagomati: https://tessiamo.it/7-prodotti-sagomati",
    "• Pronto stampa (basi): https://tessiamo.it/8-pronto-stampa",
    "",
    "Sotto-categorie utili:",
    "• Bavaglini: https://tessiamo.it/6-bavaglini",
    "• Shopper: https://tessiamo.it/28-shopper"
  ].join("\n");
}
