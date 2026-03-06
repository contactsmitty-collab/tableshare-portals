# TableShare Portals (Admin + Restaurant)

Static HTML/JS/CSS for the **admin** and **restaurant partner** dashboards. Deployed to Vercel at:

- **admin.tableshare.ai** – TableShare staff
- **partners.tableshare.ai** – Restaurant partners

Both URLs serve the same app; the backend determines which dashboard to show after login.

## Deploy on Vercel

1. Import this repo: [Vercel](https://vercel.com) → Add New → Project → Import `tableshare-portals`
2. **Framework Preset:** Other (static)
3. **Build Command:** (leave empty)
4. **Output Directory:** `.`
5. Add domains in Settings → Domains: `admin.tableshare.ai`, `partners.tableshare.ai`

## API

The portals call the TableShare API at `https://tableshare.pixelcheese.com/api/v1`. To change this, edit `api.js` → `getApiBaseUrl()`.

For local testing, set `localStorage.setItem('tableshare_api_url', 'http://localhost:3000/api/v1')` in the browser console.

## Local development

Run the backend locally (e.g. from `tableshare-backend`). Open `index.html` via a local server, or use the backend's portal route if it serves static files.
