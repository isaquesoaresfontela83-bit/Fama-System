import { clearFamaControlSession } from "@/lib/fama-control-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await clearFamaControlSession();
  return Response.redirect(new URL("/", request.url), 303);
}

export async function POST(request: Request) {
  await clearFamaControlSession();
  return Response.redirect(new URL("/", request.url), 303);
}
