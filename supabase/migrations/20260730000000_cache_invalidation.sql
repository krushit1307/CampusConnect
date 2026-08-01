-- Enable pg_net if not already enabled
create extension if not exists pg_net with schema extensions;

-- Create the CDN purge webhook function
create or replace function public.notify_cdn_purge()
returns trigger
language plpgsql
security definer
as $$
declare
  endpoint_url text;
  cdn_zone_id text;
  cdn_api_token text;
begin
  -- For Cloudflare, you might purge by URL or by tag. 
  -- Assuming we purge by URL, the URL depends on the table that triggered this.
  -- In a real setup, we would read the Zone ID and API token from vault or secrets.
  cdn_zone_id := current_setting('app.settings.cloudflare_zone_id', true);
  cdn_api_token := current_setting('app.settings.cloudflare_api_token', true);

  -- We construct the endpoint that needs to be purged based on the table name
  -- e.g., if table is "majors", we purge "/api/majors"
  endpoint_url := current_setting('app.settings.public_site_url', true) || '/api/' || TG_TABLE_NAME;

  if cdn_zone_id is not null and cdn_api_token is not null then
    perform net.http_post(
        url := 'https://api.cloudflare.com/client/v4/zones/' || cdn_zone_id || '/purge_cache',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || cdn_api_token,
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'files', jsonb_build_array(endpoint_url)
        )
    );
  end if;

  return null;
end;
$$;
