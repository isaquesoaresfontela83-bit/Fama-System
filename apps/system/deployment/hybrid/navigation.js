export const useSearchParams = () => new URLSearchParams(window.location.search);
export const usePathname = () => window.location.pathname;
export const useParams = () => { const parts=window.location.pathname.split('/').filter(Boolean); return {id:parts[1],plan:parts[1]}; };
export const useRouter = () => ({push:url=>window.location.assign(url),replace:url=>window.location.replace(url),refresh:()=>window.location.reload(),back:()=>window.history.back(),prefetch:()=>{}});
export const redirect = url => window.location.replace(url);
export const notFound = () => {throw new Error('Página não encontrada.');};
