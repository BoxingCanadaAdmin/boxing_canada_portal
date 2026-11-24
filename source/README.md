# Boxing Canada Portal: interface source

`portal-app.jsx` is the whole portal interface (React). It runs in two ways:

- inside the WordPress plugin, where `window.BCP_WP` is set and data, sign-in and permissions come from the plugin's REST API;
- as the standalone single-file prototype, which uses browser storage.

## Build

From this folder:

    npm install
    npm run build

This compiles the JSX into `../plugin/boxing-canada-portal/assets/js/portal-app.js` and the Tailwind styles into `assets/css/portal.css` there. React itself is loaded from `assets/js/react*.production.min.js` (React 18.3.1).

## Coaching pathway

`coach-pathway.json` defines the coaching levels, names, scheduled renames, readiness requirements, evaluation tasks and email templates. The build inlines it into the interface and copies it to the plugin's `data/` folder, where the server uses it to set up or upgrade the pathway. After the first install, Boxing Canada edits the pathway in the portal (Coach Programs › Coaching pathway); this file is only the starting point.
