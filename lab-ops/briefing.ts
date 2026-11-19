/** Demo topology. This module is hand-written and does not read the vault. */
export type Host = "Pi 5" | "Mint" | "Proxmox";
export type Outcome = "passed" | "failed";
export type State = "current" | "stale" | "failed" | "unknown";

export type Requirement = {
  id: string;
  host: Host;
  label: string;
  intervalHours: number;
  nextCheck: string;
};

export type Observation = {
  observedAt: string;
  outcome: Outcome;
};

export const requirements: ReadonlyArray<Requirement> = [
  {
    id: "mint-forgejo-script",
    host: "Mint",
    label: "Backup script matches Forgejo checkout",
    intervalHours: 48,
    nextCheck: "Review the deployed script against the homelab-backups checkout before syncing either copy.",
  },
  {
    id: "mint-forgejo-service",
    host: "Mint",
    label: "Backup service matches Forgejo checkout",
    intervalHours: 48,
    nextCheck: "Compare the active service fragment and any drop-ins with the checked-in unit.",
  },
  {
    id: "mint-forgejo-timer",
    host: "Mint",
    label: "Backup timer matches Forgejo checkout",
    intervalHours: 48,
    nextCheck: "Compare the active timer fragment and any drop-ins with the checked-in unit.",
  },
  {
    id: "pi5-restic-job",
    host: "Pi 5",
    label: "Pi 5 restic job result",
    intervalHours: 264,
    nextCheck: "Check the systemd timer and the result of its last run.",
  },
  {
    id: "mint-prox-pull-job",
    host: "Mint",
    label: "Proxmox pull job result",
    intervalHours: 264,
    nextCheck: "Check Mint’s user timer and the result of its last run.",
  },
  {
    id: "pi5-backup",
    host: "Pi 5",
    label: "Pi 5 restic snapshot",
    intervalHours: 240,
    nextCheck: "Review the backup timer and the latest restic snapshot receipt.",
  },
  {
    id: "mint-check",
    host: "Mint",
    label: "Backup repository integrity check",
    intervalHours: 240,
    nextCheck: "Review the latest repository check receipt on Mint.",
  },
  {
    id: "nextcloud-guest",
    host: "Proxmox",
    label: "Nextcloud guest archive",
    intervalHours: 240,
    nextCheck: "Confirm the guest archive exists in Mint’s backup inventory.",
  },
  {
    id: "nextcloud-files",
    host: "Proxmox",
    label: "Nextcloud file archive",
    intervalHours: 240,
    nextCheck: "Inspect Mint’s separate Nextcloud data pull and verify its newest archive.",
  },
  {
    id: "nextcloud-restore",
    host: "Proxmox",
    label: "Nextcloud restore drill",
    intervalHours: 720,
    nextCheck: "Find a restore receipt that verifies the guest and its files together.",
  },
  {
    id: "forgejo-archive",
    host: "Proxmox",
    label: "Forgejo archive integrity",
    intervalHours: 240,
    nextCheck: "Check the latest Forgejo archive verification receipt.",
  },
  {
    id: "forgejo-present",
    host: "Proxmox",
    label: "Forgejo archive present",
    intervalHours: 264,
    nextCheck: "Confirm Mint has a finalized Forgejo archive and find its verification receipt.",
  },
  {
    id: "forgejo-guest",
    host: "Proxmox",
    label: "Forgejo guest running",
    intervalHours: 24,
    nextCheck: "Check the guest state and confirm HTTP and Git health separately.",
  },
  {
    id: "forgejo-boot",
    host: "Proxmox",
    label: "Forgejo isolated restore boot",
    intervalHours: 720,
    nextCheck: "Find a receipt for a restored guest that booted in isolation.",
  },
  {
    id: "forgejo-restore-http",
    host: "Proxmox",
    label: "Forgejo HTTP check after restore",
    intervalHours: 720,
    nextCheck: "Check Forgejo HTTP health inside the isolated restore.",
  },
  {
    id: "forgejo-restore-clone",
    host: "Proxmox",
    label: "Forgejo test clone after restore",
    intervalHours: 720,
    nextCheck: "Clone a disposable repo from the restored instance and verify its expected ref.",
  },
  {
    id: "forgejo-dns",
    host: "Proxmox",
    label: "Forgejo DNS resolution",
    intervalHours: 24,
    nextCheck: "Resolve the service name from a lab client and compare it with the expected proxy address.",
  },
  {
    id: "forgejo-proxy-http",
    host: "Proxmox",
    label: "Forgejo HTTP through the proxy",
    intervalHours: 24,
    nextCheck: "Check the proxy route with the expected host name. Verify the upstream separately if it fails.",
  },
];

export function assessObservation(
  requirement: Requirement,
  observation: Observation | undefined,
  now: Date,
): State {
  if (!observation) return "unknown";
  const age = now.getTime() - Date.parse(observation.observedAt);
  if (!Number.isFinite(age) || age < 0) return "unknown";
  if (observation.outcome === "failed") return "failed";
  return age > requirement.intervalHours * 3_600_000 ? "stale" : "current";
}

export function buildBriefing(
  observations: Partial<Record<string, Observation>>,
  now: Date,
) {
  return requirements.map((requirement) => {
    const observation = observations[requirement.id];
    return {
      ...requirement,
      observedAt: observation?.observedAt,
      state: assessObservation(requirement, observation, now),
    };
  });
}

/** Both archives are required to cover recovery of the service and its files. */
export function nextcloudBackupCoverage(briefing: ReturnType<typeof buildBriefing>) {
  const guest = briefing.find((finding) => finding.id === "nextcloud-guest");
  const files = briefing.find((finding) => finding.id === "nextcloud-files");
  const inputs = [guest, files];
  if (inputs.some((input) => input?.state === "failed" || input?.state === "stale")) {
    return "gap";
  }
  if (inputs.every((input) => input?.state === "current")) return "current";
  return "unknown";
}
