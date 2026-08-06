# Media origin

`compose.yml` documents the production media service. It exposes only the
WordPress upload library, mounted read-only, through the VPS's existing Traefik
network. The running container uses the equivalent configuration and has the
restart policy `unless-stopped`.

Do not run `docker compose up` while a manually created `profexor-media`
container already exists. Migrate it during a maintenance window by removing
that container first, then starting this Compose project.

Verify direct and Netlify-proxied byte-range delivery without downloading a
whole video:

```sh
curl -sS -H 'Range: bytes=0-1023' -D - -o /dev/null \
  https://media.profexer.cloud/wp-content/uploads/2026/02/Website-Film_P0066_McDonalds-1_compressed.mp4

curl -sS -H 'Range: bytes=0-1023' -D - -o /dev/null \
  https://profexor.netlify.app/wp-content/uploads/2026/02/Website-Film_P0066_McDonalds-1_compressed.mp4
```

Both responses should be `206`, with `Content-Type: video/mp4` and a valid
`Content-Range` header.
