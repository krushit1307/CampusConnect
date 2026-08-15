# Mobile deep-link association files

The web client accepts notification `target_route` values such as
`/forum/post/123?highlight=comment456`. The production web domain must also
serve the following association files over HTTPS, without redirects and with
the shown content types:

- `/.well-known/apple-app-site-association` (`application/json`)
- `/.well-known/assetlinks.json` (`application/json`)

These files are deployment-specific because their values belong to the signed
native apps. Do not commit another team's identifiers. Configure the hosting
platform with the values from the iOS and Android release owners:

```json
// apple-app-site-association
{
  "applinks": {
    "details": [{ "appID": "<APPLE_TEAM_ID>.<IOS_BUNDLE_ID>", "paths": ["/*"] }]
  }
}
```

```json
// assetlinks.json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "<ANDROID_PACKAGE_NAME>",
      "sha256_cert_fingerprints": ["<RELEASE_SHA256_CERT_FINGERPRINT>"]
    }
  }
]
```

The Android intent filter and iOS associated-domain entitlement must use this
same HTTPS domain. Release validation should fetch both endpoints from a real
device-facing network before enabling notification campaigns.
