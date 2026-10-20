// Report only server-side configuration flags. Never return credential values.
export function getIntegrationStatus(readEnv) {
  const configured = (names) => names.every((name) =>
    String(readEnv(name) ?? "").trim().length > 0
  );
  const lite = configured(["IPINFO_LITE_TOKEN"]);
  return {
    ipinfo: {
      available: true,
      action: "ipinfo_lookup",
      mode: lite ? "lite" : "public_legacy",
      secret_required: false,
      ...(!lite ? { requests_per_day: 1000, shared_by_egress_ip: true } : {})
    },
    ipinfo_lite: { available: lite, secret_required: true },
    github_rest: { available: true, mode: "read_only_public" },
    google_drive: {
      configured: configured([
        "FAMA_GOOGLE_DRIVE_CLIENT_ID", "FAMA_GOOGLE_DRIVE_CLIENT_SECRET",
        "FAMA_GOOGLE_DRIVE_REFRESH_TOKEN", "FAMA_GOOGLE_DRIVE_FOLDER_ID"
      ])
    },
    resend: {
      configured: configured(["FAMA_RESEND_API_KEY", "FAMA_RESEND_FROM"])
    },
    ocr_space: { configured: configured(["FAMA_OCRSPACE_API_KEY"]) },
    sentry: { configured: configured(["FAMA_SENTRY_DSN"]) }
  };
}
