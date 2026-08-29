# EAS Android Build (Preview)

Already configured in this repo: `android.package` is set to `id.sigap.app` in `app.json`,
and `eas.json` defines a `preview` build profile (internal distribution, APK output, no
Play Store signing/submission).

## Manual steps (requires an Expo account)

Run these from `apps/native/`, in order:

```sh
eas login
eas init
eas build --platform android --profile preview
```

1. `eas login` — authenticate with an Expo account.
2. `eas init` — links this project to that Expo account and populates
   `extra.eas.projectId` in `app.json`. This modifies `app.json`, so commit that change
   afterward.
3. `eas build --platform android --profile preview` — triggers the cloud build and
   produces a downloadable APK link on completion.

## Notes

- This is the `preview` / internal-distribution profile only. No Play Store signing or
  submission (`submit` block) is configured, and none is in scope for this ticket.
- `eas-cli` doesn't need to be a local project dependency. Use `npx eas-cli@latest <command>`
  for each step above, or install it as a global/dev tool if preferred.
