import { getPlanCatalog } from "@/lib/plans";
export async function GET() { return Response.json({plans:await getPlanCatalog()}, {headers:{"Cache-Control":"no-store"}}); }
