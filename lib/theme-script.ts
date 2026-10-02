// Kept free of React imports: the root layout (a Server Component) inlines this script.

export const THEME_KEY = "encore-theme";

/** Runs in <head> before first paint so a saved light/dark choice never flashes the other theme. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
