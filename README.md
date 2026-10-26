# dimitricole.com

The personal site of Dimitri Cole Restaino, applied AI and solutions architect. It is a single static page (`index.html`, `assets/css/site.css`, `assets/js/site.js`) with self-hosted Geist fonts, no build step and no dependencies.

## Preview locally

```sh
python3 -m http.server 8791
```

Then open http://127.0.0.1:8791/. Opening `index.html` straight from disk also works.

## Deploy

GitHub Pages serves the `master` branch at www.dimitricole.com (see `CNAME`). Pushing to `master` deploys, so there is no staging step. Bump the `?v=` query on the CSS and JS links in `index.html` when either file changes.

`companion/` holds redirects to snowyghost.com/companion. `llms.txt` is a plain-text summary of the page for language models.

Geist and Geist Mono are licensed under the SIL Open Font License 1.1 (`assets/fonts/OFL.txt`).
