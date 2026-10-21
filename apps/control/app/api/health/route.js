import { FAMA_VERSION, FAMA_RELEASE_ID } from "@/lib/fama-release";
export const dynamic = "force-dynamic";
export async function GET() { return Response.json({ status: "ok", service: 'Fama Control', version: FAMA_VERSION, releaseId: FAMA_RELEASE_ID, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }); }
