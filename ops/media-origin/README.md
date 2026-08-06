# Profexor media origin

This directory documents the production service behind
`https://media.profexer.cloud`. It restores the repository-excluded WordPress
upload library while keeping public page URLs on the Profexor domain.

```mermaid
flowchart LR
  browser[Browser] -->|"/wp-content/uploads/*"| netlify[Profexor on Netlify]
  netlify -->|"200 rewrite / proxy"| traefik[Existing Traefik proxy]
  traefik -->|"media.profexer.cloud"| nginx[profexor-media / Nginx]
  nginx -->|"read-only mount"| uploads["/var/www/media/wp-content/uploads"]
```

## Service properties

- `nginx:alpine` serves only the upload tree.
- The host directory is mounted read-only.
- `no-new-privileges` reduces container privilege escalation risk.
- The container uses `restart: unless-stopped`.
- Traefik owns HTTPS and routes `media.profexer.cloud` to port 80 in the
  container.
- Netlify's `_redirects` file preserves the site's original upload URLs.
- Nginx supports byte ranges required for seeking and progressive video
  playback.

## Deployment safety

`compose.yml` is the reproducible service definition. The running production
container currently uses its equivalent configuration.

Do **not** run `docker compose up` while a manually created `profexor-media`
container with the same name exists. During a planned maintenance window:

1. confirm the upload directory and external `n8n_default` proxy network exist;
2. record the active container configuration;
3. remove only the existing `profexor-media` container; and
4. start this Compose project and verify routing before ending the window.

The media directory itself must never be removed or made writable by the public
container.

## Verification

Check the origin and the Netlify proxy without downloading the complete video:

```sh
curl -sS -H 'Range: bytes=0-1023' -D - -o /dev/null \
  https://media.profexer.cloud/wp-content/uploads/2026/02/Website-Film_P0066_McDonalds-1_compressed.mp4

curl -sS -H 'Range: bytes=0-1023' -D - -o /dev/null \
  https://profexor.netlify.app/wp-content/uploads/2026/02/Website-Film_P0066_McDonalds-1_compressed.mp4
```

Both responses should include:

```text
HTTP/2 206
Content-Type: video/mp4
Content-Range: bytes 0-1023/<total-size>
Content-Length: 1024
```

Also verify that an ordinary image request returns `200` and that a missing
upload returns `404`; the proxy must not fall back to an unrelated HTML page.

## Related configuration

- [`compose.yml`](compose.yml) — media container, mount, network, and Traefik labels
- [`../../_redirects`](../../_redirects) — Netlify upload-path rewrite
- [`../../netlify.toml`](../../netlify.toml) — static publish and cache headers

Operated by **Profexor**.
