# What Channel is NASCAR on?

Single-page web app that shows the next NASCAR race for each national series (N1 = Cup, N2 = Xfinity, N3 = Truck) and **where to watch/listen**. Pulls schedule data from:
- `https://cf.nascar.com/cacher/2025/race_list_basic.json`

## Features
- Next race card for **N1/N2/N3** with race name, track, **local start time**, and broadcasters.
- Broadcasters:
  - **TV:** `television_broadcaster` (FOX/FS1/NBC/USA/CW/Prime; logos included)
  - **Radio:** `radio_broadcaster` (NRN mapped to MRN; MRN/PRN logos included)
  - **Satellite:** `satellite_radio_broadcaster` (SiriusXM logo included)
- **AdSense**: verification script in `<head>` and header/footer slots using `<ins class="adsbygoogle">`.
- **Google Analytics** via gtag (G-7XQ3DFF102) pre-wired.
- Auto-refreshes ad slots when content meaningfully changes (and at most once per hour).

## Quick start (local)
```bash
npm install
npm run dev
```

## Configure AdSense
- Replace the placeholder slot IDs in `src/App.tsx`:
  - Header: `data-ad-slot="1234567890"`
  - Footer: `data-ad-slot="1234567891"`
- Keep the existing `<script>` in `index.html` with your `data-ad-client`.

## Configure Google Analytics
- `index.html` contains your GA tag for property **G-7XQ3DFF102**.

## Deploy to GitHub Pages
This repo includes a GitHub Actions workflow that builds and deploys to **GitHub Pages** from the `main` branch.

1. Create a new repo on GitHub (e.g., `what-channel-is-nascar-on`).
2. Push this project to the repo:
   ```bash
   git init
   git add .
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/<your-org-or-user>/<your-repo>.git
   git push -u origin main
   ```
3. In GitHub: **Settings → Pages → Build and deployment**: set **Source** to **GitHub Actions**.
4. The included workflow will build and publish to Pages automatically on each push to `main`.

> **Note on Vite base:** `vite.config.ts` is set with `base: './'` so assets work on Pages (serving under `/repo-name/`). If your site is at a custom domain or root, this still works fine.

## Environment
- Node 18+ recommended.
- Built with Vite + React + TypeScript, Luxon for time handling.

## License
MIT
