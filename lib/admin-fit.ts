// Fit-to-screen scaling for the staff admin (see app/admin/(protected)/admin-shell.module.css).
// The admin is laid out for roughly a 1680 x 1000 window. On smaller or
// Windows-scaled desktop screens it scales down (never below 60%) so it looks
// like it does on a large monitor. Phones and tablets (under 1024px wide) and
// browsers without CSS zoom keep 100%.
//
// The same formula runs twice: inline in the root <head> before first paint
// (an inline script further down the page is streamed in by Next.js and never
// executes), and in <AdminFitToScreen /> for resizes and client navigation.

export function adminZoomFor(width: number, height: number, zoomSupported: boolean) {
  if (width < 1024 || !zoomSupported) return 1;
  const zoom = Math.max(0.6, Math.min(1, width / 1680, height / 1000));
  return Math.round(zoom * 100) / 100;
}

export const ADMIN_FIT_HEAD_SCRIPT =
  "(function(){try{if(location.pathname.indexOf('/admin')!==0)return;var w=innerWidth,h=innerHeight,z=1;if(w>=1024&&window.CSS&&CSS.supports('zoom','0.5')){z=Math.max(0.6,Math.min(1,w/1680,h/1000));z=Math.round(z*100)/100}document.documentElement.style.setProperty('--admin-zoom',String(z))}catch(e){}})();";
