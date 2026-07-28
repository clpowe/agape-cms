# Agape CMS

Strapi 5 CMS for the Agape website.

## Development

```sh
pnpm install
pnpm dev
```

## Keep local content in sync with production

Production is the content source of truth. The project provides a one-way,
production-to-local sync so local development can start from the same content
without risking a production overwrite.

1. In the production Strapi admin, open **Settings > Global settings > Transfer
   Tokens** and create a token with **Pull** permission.
2. Add the production admin URL and token to your local `.env`:

   ```dotenv
   STRAPI_TRANSFER_URL=https://your-production-strapi.example.com/admin
   STRAPI_TRANSFER_TOKEN=your-pull-token
   ```

3. Stop the local Strapi server, then refresh the local database:

   ```sh
   pnpm data:pull
   ```

To pull production content and immediately start development:

```sh
pnpm dev:sync
```

The pull replaces local content and configuration. Before each pull, the command
creates a timestamped SQLite backup under `.tmp/backups/`. It never supports the
opposite direction, so it cannot overwrite production.

Binary media transfer is deliberately excluded because both environments use
Cloudflare R2. Media records and their public URLs are synchronized as content,
while the shared R2 objects are left untouched.

This is a startup/on-demand snapshot, not live two-way replication. Make content
changes in production and run `pnpm data:pull` again when production changes.

## Other commands

```sh
pnpm build
pnpm start
pnpm strapi --help
```
