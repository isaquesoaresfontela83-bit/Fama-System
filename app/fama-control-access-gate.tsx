import { FamaControlLoginForm } from "./fama-control-login-form";

export function FamaControlAccessGate() {
  return (
    <main className="min-h-screen bg-[#061426] text-[#edf7ff]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
        <section className="w-full rounded-[30px] border border-[#2a507c] bg-[#0d284c] p-7 shadow-2xl sm:p-12">
          <div className="mb-10 flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white p-1 shadow-xl">
              <img src="/fama-piscinas-mark.png" alt="Fama System" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-sm font-black tracking-[0.16em] text-[#74def5]">FAMA SYSTEM</div>
              <div className="text-2xl font-bold">Fama Control</div>
            </div>
          </div>

          <div className="mb-7 grid h-[72px] w-[72px] place-items-center rounded-[22px] bg-gradient-to-br from-[#27c8e8] to-[#168bea] text-3xl">🔒</div>
          <div className="text-sm font-black tracking-[0.14em] text-[#39a8f2]">PAINEL DO PROPRIETÁRIO</div>
          <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">Entrar no Fama Control</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[#b8cadb]">
            Use o e-mail e a senha cadastrados no Supabase. O acesso administrativo continua restrito às contas autorizadas para o Fama Control.
          </p>

          <FamaControlLoginForm />

          <div className="mt-8 border-t border-[#2a507c] pt-6 text-sm leading-6 text-[#b8cadb]">
            A sessão é protegida por cookie criptografado e a autorização é validada pelo backend antes de o painel ser carregado.
          </div>
        </section>
      </div>
    </main>
  );
}
