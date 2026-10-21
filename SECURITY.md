# Security Policy

This is a local-only DSH plugin: no network access, no telemetry, no API calls.
All numbers come from session logs already on the machine. The attack surface is
small, but reports are still welcome.

## Supported versions

Only the latest npm `latest` tag is supported. Older versions are not patched;
upgrade with `plugin_manager action: install_bundle target: dsh-desktop-token-usage`.

## Reporting a vulnerability

Open a GitHub issue with the `security` label, or contact the maintainer through
the repository profile. Please include:

- plugin version (`Config.listConfigs` entry or npm version)
- DSH version and OS
- what you expected vs what happened, with steps to reproduce

Do not paste session-log contents, paths, or tokens into the issue: describe the
shape of the data instead. The maintainer aims to acknowledge within 7 days.

## What is out of scope

- DSH itself, Electron, Chromium, or npm infrastructure;
- the contents of your session logs (private to your machine by design).
