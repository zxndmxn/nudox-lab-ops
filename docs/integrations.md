# Integration plan

| Integration | Next slice | How we know it works |
| --- | --- | --- |
| Forgejo | Confirm the source revision, compare it with deployed files, and classify the difference. | The briefing distinguishes a new observation from when the change happened and identifies the script or unit to review. |
| Restore evidence | The briefing has separate checks for isolated boot, restored HTTP health, and a test clone. Import a receipt for each check as it is verified. | A current archive or healthy running guest leaves restore checks unknown until there is evidence. |
| ntfy | Add an explicitly invoked sender for coverage transitions after choosing a private topic. | The same finding does not send again. A confirmed recovery sends once. Only a short summary leaves the machine. |
| DNS and Nginx Proxy Manager | Forgejo is the first route. Import independent DNS and proxy HTTP results from a lab client. | A failed HTTP route can appear between current DNS and a running guest. The demo shows this case. Live results require separate receipts. |
| n8n | Import the outcome and time of one existing maintenance workflow. | A failed run appears as a maintenance item. Payloads and execution logs stay with n8n. |

Nudox indexes the hand-written rules and supports code lookup. Lab Ops reads
local observations and evaluates those rules. Live receipts remain outside
Git and outside the indexed package. Production actions require an operator.
