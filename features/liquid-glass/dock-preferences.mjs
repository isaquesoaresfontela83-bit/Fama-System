export const DOCK_ITEMS = ['home','agenda','new','customers','more'];
export const DOCK_LABELS = {home:'Início',agenda:'Agenda',new:'Novo',customers:'Clientes',more:'Mais'};
export const STORAGE_KEY = 'fama:dock-layout:v1';
export function normalizePreferences(value) {
  const order = [...new Set((Array.isArray(value?.order) ? value.order : []).filter(id=>DOCK_ITEMS.includes(id)))];
  const hidden = [...new Set((Array.isArray(value?.hidden) ? value.hidden : []).filter(id=>DOCK_ITEMS.includes(id)&&id!=='more'))];
  return {order:[...order,...DOCK_ITEMS.filter(id=>!order.includes(id))],hidden};
}
export function moveItem(preferences,id,direction,available=DOCK_ITEMS) {
  const result=normalizePreferences(preferences);
  const visible=result.order.filter(key=>available.includes(key));
  const index=visible.indexOf(id),other=visible[index+direction];
  if(index>=0&&other){const a=result.order.indexOf(id),b=result.order.indexOf(other);[result.order[a],result.order[b]]=[result.order[b],result.order[a]];}
  return result;
}
