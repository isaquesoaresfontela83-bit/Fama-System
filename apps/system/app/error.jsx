"use client";
export default function ErrorPage({ reset }) {
  return <main className="product-state-page" role="alert"><span className="product-eyebrow">FAMA SYSTEM</span><h1>Não foi possível carregar esta área.</h1><p>Tente novamente. Se a conexão caiu durante uma gravação, confira o registro antes de repetir a operação.</p><div className="product-state-actions"><button type="button" onClick={reset}>Tentar novamente</button><a href="/">Voltar ao início</a></div></main>;
}
