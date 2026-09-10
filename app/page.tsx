import { FamaControlAccessGate } from "./fama-control-access-gate";
import { FamaControlApp } from "./fama-control-app";
import { readFamaControlSession } from "@/lib/fama-control-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const session = await readFamaControlSession();

  if (!session) {
    return <FamaControlAccessGate />;
  }

  return (
    <FamaControlApp
      currentUser={session.user}
      signOutPath="/api/auth/logout"
    />
  );
}
