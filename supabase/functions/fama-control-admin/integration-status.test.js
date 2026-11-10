import { getIntegrationStatus } from "./integration-status.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const read = (values) => (name) => values[name];
const driveKeys = [
  "FAMA_GOOGLE_DRIVE_CLIENT_ID", "FAMA_GOOGLE_DRIVE_CLIENT_SECRET",
  "FAMA_GOOGLE_DRIVE_REFRESH_TOKEN", "FAMA_GOOGLE_DRIVE_FOLDER_ID"
];
const resendKeys = ["FAMA_RESEND_API_KEY", "FAMA_RESEND_FROM"];
const keys = ["IPINFO_LITE_TOKEN", ...driveKeys, ...resendKeys, "FAMA_OCRSPACE_API_KEY", "FAMA_SENTRY_DSN"];
const populated = () => Object.fromEntries(keys.map((key) => [key, "test-only-credential-" + key]));

Deno.test("missing credentials preserve public access without marking external providers configured", () => {
  const status = getIntegrationStatus(read({}));
  assert(JSON.stringify(status.ipinfo) === JSON.stringify({
    available: true, action: "ipinfo_lookup", mode: "public_legacy", secret_required: false,
    requests_per_day: 1000, shared_by_egress_ip: true
  }), "Legacy IPinfo contract changed");
  assert(status.github_rest.available && status.github_rest.mode === "read_only_public", "Public GitHub access changed");
  assert(status.ipinfo_lite.available === false, "IPinfo Lite must require its token");
  for (const provider of ["google_drive", "resend", "ocr_space", "sentry"]) {
    assert(status[provider].configured === false, provider + " must stay unconfigured");
  }
});

Deno.test("complete configuration never returns credential values", () => {
  const values = populated();
  const status = getIntegrationStatus(read(values));
  const serialized = JSON.stringify(status);
  assert(status.ipinfo_lite.available && status.ipinfo.mode === "lite", "Lite token not detected");
  assert(!("requests_per_day" in status.ipinfo), "Public quota leaked into Lite mode");
  for (const provider of ["google_drive", "resend", "ocr_space", "sentry"]) {
    assert(status[provider].configured === true, provider + " credentials not detected");
  }
  for (const secret of Object.values(values)) {
    assert(!serialized.includes(secret), "Credential exposed in status");
  }
});

Deno.test("Drive remains unavailable if any required OAuth or folder setting is absent", () => {
  for (const missing of driveKeys) {
    const values = populated();
    delete values[missing];
    assert(!getIntegrationStatus(read(values)).google_drive.configured, "Drive accepted missing " + missing);
  }
});

Deno.test("Resend requires both an API key and a sender", () => {
  for (const missing of resendKeys) {
    const values = populated();
    delete values[missing];
    assert(!getIntegrationStatus(read(values)).resend.configured, "Resend accepted missing " + missing);
  }
});

Deno.test("blank settings never enable an integration", () => {
  for (const blank of ["", " ", "\t\r\n"]) {
    const values = Object.fromEntries(keys.map((key) => [key, blank]));
    const status = getIntegrationStatus(read(values));
    assert(!status.ipinfo_lite.available, "Blank token enabled Lite");
    for (const provider of ["google_drive", "resend", "ocr_space", "sentry"]) {
      assert(!status[provider].configured, "Blank settings enabled " + provider);
    }
  }
});

Deno.test("configuring one provider does not enable another", () => {
  const status = getIntegrationStatus(read({ FAMA_OCRSPACE_API_KEY: "test-only-ocr" }));
  assert(status.ocr_space.configured, "OCR not enabled by its own credential");
  assert(!status.sentry.configured && !status.resend.configured && !status.google_drive.configured && !status.ipinfo_lite.available, "Another provider was enabled");
});

Deno.test("credential removal is reflected immediately without a stale status cache", () => {
  const values = populated();
  const env = read(values);
  assert(getIntegrationStatus(env).sentry.configured, "Initial Sentry setting missing");
  delete values.FAMA_SENTRY_DSN;
  delete values.IPINFO_LITE_TOKEN;
  const status = getIntegrationStatus(env);
  assert(!status.sentry.configured, "Removed DSN stayed configured");
  assert(!status.ipinfo_lite.available && status.ipinfo.mode === "public_legacy", "Removed Lite token stayed enabled");
});
