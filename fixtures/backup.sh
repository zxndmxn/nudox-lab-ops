#!/usr/bin/env bash
# Documentation fixture only. Intentionally cannot run a backup or prune data.
# Flow annotations below describe explicit reviewed relationships, not parsed calls.
# input: /srv/demo/config
# input: /srv/demo/database-export
# destination: encrypted-repository
# phases: export -> backup -> retention -> notification
# Notification success does not prove recoverability.
printf '%s\n' 'Synthetic fixture only; no backup operations are implemented.'
exit 2
