const params = new URLSearchParams(window.location.search);
export const DEBUG = params.get("debug") === "true";
