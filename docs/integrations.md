# Integration plan

| Integration | Next slice | How we know it works |
| --- | --- | --- |
| Forgejo | Confirm the source revision, compare it with deployed files, and classify the difference. | The briefing distinguishes a new observation from when the change happened and identifies the script or unit to review. |
| Restore evidence | Import a small receipt for an isolated Forgejo restore with separate HTTP and Git clone checks. | An archive can be present while boot or clone remains unknown. |
| ntfy | Add an explicitly invoked sender for coverage transitions after choosing a private topic. | The same finding does not send again. A confirmed recovery sends once. Only a short summary leaves the machine. |
| DNS and Nginx Proxy Manager | Trace one service from name resolution through its proxy to the Proxmox guest. | The briefing can distinguish a DNS failure, proxy failure and stopped guest using separate observations. |
| n8n | Bring in selected findings from existing workflows. | A workflow can add a maintenance item without duplicating a backup job or turning its report into restore evidence. |

Nudox indexes the hand-written rules and supports code lookup. Lab Ops reads
local observations and evaluates those rules. Live receipts remain outside
Git and outside the indexed package. Production actions require an operator.
