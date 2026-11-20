export const SYSTEM_ORIGIN = 'https://watersystem.online';
export const CONTROL_ORIGIN = 'https://control.watersystem.online';

// Match only the three retired hosts, including URLs embedded in JavaScript.
const retiredHost = /(?<![\w.-])((?:www\.|control\.)?)famasystem\.online(?![\w.-])/gi;

export function useWaterHosts(text) {
 return text.replace(retiredHost, (_, subdomain) => subdomain.toLowerCase() + 'watersystem.online');
}

export function renameProducts(text) {
 return text.replace(/\b(Fama)([ \t\u00a0]+)(System|Control)\b/gi, (_, name, space, product) => {
  const brand = name === name.toUpperCase() ? 'WATER' : name === name.toLowerCase() ? 'water' : 'Water';
  return brand + space + product;
 });
}

export function migrateLegacyReferences(text) {
 return renameProducts(useWaterHosts(text))
  .replace(/\bFama(-?)System(?=\/1\.0\b)/g, 'Water$1System')
  .replaceAll('isaquesoaresfontela83-bit/Fama-System', 'isaquesoaresfontela83-bit/Water-System');
}
