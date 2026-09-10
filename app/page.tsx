import { FamaControlAccessGate } from "./fama-control-access-gate";
import { FamaControlApp } from "./fama-control-app";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    return <FamaControlAccessGate signInPath={chatGPTSignInPath("/")} />;
  }

  return (
    <FamaControlApp
      currentUser={{
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      }}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
