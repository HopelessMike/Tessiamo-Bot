import { CONFIG } from "./config";

/**
 * Costruisce URL al catalogo tessiamo.it con facet `q=`.
 * Esempio: /3-pannelli-in-tessuto?q=Fantasie+per-Bambini%2FSoggetto-Principesse&page=1
 */
export type Category = "pannelli" | "tessuti" | "prodotti-sagomati" | "pronto-stampa";

const CATEGORY_PATH: Record<Category,string> = {
  "pannelli": "/3-pannelli-in-tessuto",
  "tessuti": "/4-tessuti-al-metro",
  "prodotti-sagomati": "/7-prodotti-sagomati",
  "pronto-stampa": "/8-pronto-stampa"
};

const FANTASIE_PER = new Map<string, string>([
  ["bambini","Bambini"],
  ["bimbo","Bambini"],["bimba","Bambini"],["kids","Bambini"],
  ["adulti","Adulti"],["adulto","Adulti"],
  ["casa","Casa e arredo"],["arredo","Casa e arredo"],["home","Casa e arredo"],
  ["festa","Festività"],["festività","Festività"],["natale","Festività"],["pasqua","Festività"],["halloween","Festività"]
]);

const SOGGETTO = new Map<string, string>([
  ["principesse","Principesse"],["principessa","Principesse"],
  ["animali","Animali"],["animaletti","Animali"],["foresta","Animali"],
  ["floreale","Floreale"],["fiori","Floreale"],
  ["sport","Sport"],
  ["scuola","Scuola"],
  ["vintage","Vintage"],
  ["basic","Basic e microfantasie"],["microfantasie","Basic e microfantasie"]
]);

export interface LinkParams {
  category: Category;
  fantasiePer?: string;   // deve essere una delle chiavi FANTASIE_PER
  soggetto?: string;      // deve essere una delle chiavi SOGGETTO
  page?: number;
}

export function buildCatalogLink(p: LinkParams): string {
  const base = CONFIG.CATALOG_BASE_URL.replace(/\/+$/,"");
  const path = CATEGORY_PATH[p.category];
  const q: string[] = [];
  if (p.fantasiePer) {
    const v = FANTASIE_PER.get(p.fantasiePer.toLowerCase());
    if (v) q.push(`Fantasie+per-${encodeURIComponent(v)}`);
  }
  if (p.soggetto) {
    const v = SOGGETTO.get(p.soggetto.toLowerCase());
    if (v) q.push(`Soggetto-${encodeURIComponent(v)}`);
  }
  const qParam = q.length ? `?q=${q.join("%2F")}&page=${p.page||1}` : `?page=${p.page||1}`;
  return `${base}${path}${qParam}`;
}

export function inferLink(text: string): LinkParams | null {
  const t = text.toLowerCase();
  const category: Category | undefined =
    t.includes("pannelli") ? "pannelli" :
    t.includes("pronto stampa") ? "pronto-stampa" :
    t.includes("sagomat") || t.includes("bavaglini") || t.includes("shopper") ? "prodotti-sagomati" :
    t.includes("tessuti") || t.includes("tessuto") ? "tessuti" :
    undefined;

  if (!category) return null;

  let fantasiePer: string|undefined;
  for (const k of FANTASIE_PER.keys()) if (t.includes(k)) { fantasiePer = k; break; }

  let soggetto: string|undefined;
  for (const k of SOGGETTO.keys()) if (t.includes(k)) { soggetto = k; break; }

  return { category, fantasiePer, soggetto, page: 1 };
}
