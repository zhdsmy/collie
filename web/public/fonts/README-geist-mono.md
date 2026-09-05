# Geist Mono Web Fonts

Unmodified variable WOFF2 assets from [vercel/geist-font](https://github.com/vercel/geist-font),
pinned to revision `77f0563c03009d6c15c6342183fa53b352255b22`. Both faces cover weights
100-900 and retain the upstream character set. The source revision in each local filename
keeps the service worker's cache-first URLs immutable.

| Local File | Upstream File | SHA-256 |
| --- | --- | --- |
| `terminal-geist-mono-77f0563-normal.woff2` | `fonts/GeistMono/webfonts/GeistMono[wght].woff2` | `afaacc4c5fbba89d2ebf7a02dc4070208540874592a5504d57175782fe893101` |
| `terminal-geist-mono-77f0563-italic.woff2` | `fonts/GeistMono/webfonts/GeistMono-Italic[wght].woff2` | `0891e792f75b9c90e9b7c489f8048bfa09682e96287b3a71dea128faed50d76e` |

The SIL Open Font License and copyright notice are in [LICENSE-geist.txt](./LICENSE-geist.txt),
which is identical to the license accompanying Geist Mono in Google Fonts at revision
`9e25e2ba265e5298f70f6182dd4e8a3ebf1b9123` (`ofl/geistmono/OFL.txt`).

These are committed assets, not a build-time download. To update, fetch both files from a
pinned upstream revision, use new filenames, and update `src/index.css` and `src/lib/sw-routes.ts`.
Geist's existing UI subset is maintained separately by `scripts/build-ui-font.sh`.
