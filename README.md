# thinks.lol

A blog about thought. Hugo, the [smol](https://github.com/colorchestra/smol)
theme as a Hugo module, built by GitHub Actions and published to GitHub Pages at
<https://thinks.lol/>.

## Layout

| Path | What it is |
| --- | --- |
| `content/` | Posts and pages. Posts use `/:year/:month/:title/` permalinks. |
| `config/_default/` | Hugo config: site, menus, params, markup, module. |
| `static/` | Copied verbatim to the site root — `CNAME` lives here. |
| `hexfield/` | Git submodule: the [Hexfield](https://github.com/thinks-lol/hexfield) instrument, published at `/hexfield/`. **Temporary** — it is moving to `hexfield.thinks.lol`; see that repo's [docs/deploy.md](https://github.com/thinks-lol/hexfield/blob/main/docs/deploy.md). |
| `.github/workflows/hugo.yml` | Builds with `make prod_build` and deploys `public/` to `gh-pages`. |

## Local development

```sh
make serve      # hugo serve --buildDrafts --buildFuture
make preview    # production-settings preview
make build      # hugo + publish-hexfield into public/
```

Hugo **extended** and **Go** are both required, because the theme is resolved as
a Hugo module (`hugo mod get`). Clone with submodules:

```sh
git clone --recurse-submodules git@github.com:thinks-lol/thinks.lol.git
# or, in an existing clone:
git submodule update --init
```

## The Hexfield instrument

## The Hexfield instrument

> **Pending removal.** `hexfield/` and the `publish-hexfield` step are temporary.
> The instrument is moving to its own hostname, `hexfield.thinks.lol`, and will be
> taken back out of this repo. It is blocked on one Cloudflare `CNAME` record.
> The checklist is in
> [hexfield/docs/deploy.md](https://github.com/thinks-lol/hexfield/blob/main/docs/deploy.md).
> Until then the page is live but deliberately unlinked from the navigation.

<https://thinks.lol/hexfield/> is a browser instrument on a hexagonal lattice:
the same key shape gives the same intervals in every tuning, with Wicki–Hayden,
Sonome, Chromatic and custom layouts across 12–53 EDO, an internal polyphonic
synth, Web MIDI with MPE, and an experimental audio-MIDI encoder.

It is developed in its own repository and pulled in as a submodule. Its source of
truth is <https://github.com/thinks-lol/hexfield> — edit it there, not here.

`make publish-hexfield` copies exactly the runtime files into `public/hexfield/`:

```
index.html style.css app.js music.js engine.js serial.js
midi-worklet.js icon.svg manifest.webmanifest
```

Tests, docs, `package.json` and repo metadata stay out of the published tree.
Every URL inside the instrument is relative, so it works at `/hexfield/`.

Updating the published instrument is a submodule bump:

```sh
cd hexfield && git pull origin main && cd ..
git add hexfield && git commit -m "Update hexfield" && git push
```

## Deployment

Push to `main`. The workflow runs `make prod_build`
(`hugo mod clean/get/tidy`, then a minified production build, then
`publish-hexfield`) and `peaceiris/actions-gh-pages` publishes `public/` to the
`gh-pages` branch, which GitHub Pages serves at `thinks.lol` with the certificate
GitHub provisions.

Because the theme and the instrument are both fetched at build time, a successful
deploy needs network access to the Hugo module proxy and to the hexfield repo
(public, over HTTPS — submodules are checked out with `submodules: true`).

`baseURL` in `config/_default/hugo.toml` must stay set to
`https://thinks.lol/`. Unset, Hugo falls back to `https://example.org/`, which
makes absolute links and the sitemap point at the wrong host.
