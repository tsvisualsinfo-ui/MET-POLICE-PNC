# PRC Discord + ER:LC integrations

The website now calls the `prc-integrations` Supabase Edge Function.

## Secrets
Keep these in Supabase Edge Function Secrets. Do NOT put them in GitHub or browser JavaScript:

- `DISCORD_ARREST_WEBHOOK`
- `ERLC_SERVER_KEY`

Supabase automatically provides the function with its own project URL and secret-key environment variables.

## What it does

- New arrest -> formatted Discord webhook embed.
- BOLO/alert/manual radio transmissions -> ER:LC `:h` server-wide hint with the officer callsign.

This uses ER:LC Remote Server Management. The `:h` message is a server-wide in-game announcement; it is not a direct injection into the native radio channel.

## Deploy

The function must be deployed to Supabase; uploading this folder to GitHub does not deploy it.

Using the Supabase CLI from this project directory:

```bash
supabase functions deploy prc-integrations --project-ref gzegkiwtaytzwmrestge
```

If the CLI asks about JWT verification, keep the function configuration shown in `supabase/config.toml`; the function verifies the user's bearer token itself.

## ER:LC authorization

ER:LC Remote Server Management may require the integration's source to be authorized/trusted. A successful server read does not by itself prove command authorization. If the function returns an ER:LC authorization error, check the private server's API/Trusted IP configuration.

## Test

1. Deploy the function.
2. Log into the PRC.
3. Create an arrest: it should appear in Discord.
4. Send a radio message: it should produce an ER:LC server-wide hint.
5. Create a BOLO or alert: it should also be sent through the ER:LC integration because those already call `radioPost()`.
