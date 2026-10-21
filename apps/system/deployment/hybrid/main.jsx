import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '../../app/theme-provider';
import { AccessGate } from '../../app/access-gate';
import { FamaSystemApp } from '../../app/cloriva-app';
import { CompanyOnboarding } from '../../app/company-onboarding';
import { LegalConsentGate } from '../../app/legal-consent-gate';
import { PlansView } from '../../app/plans-view';
import Manual from '../../app/manual/page';
import Terms from '../../app/termos/page';
import Privacy from '../../app/privacidade/page';
import PrivacyRequest from '../../app/privacidade/solicitar/page';
import Confirm from '../../app/auth/confirmar/page';
import Recover from '../../app/auth/recuperar/page';
import Proposal from '../../app/proposta/[id]/page';
import { CheckoutClient } from '../../app/assinar/[plan]/checkout-client';
import { onboardingIntent } from '../../lib/onboarding-intent';
import { ServiceNotice, Loading } from './status';
import { installHybridNetwork } from './network';
import 'leaflet/dist/leaflet.css';
import '../../app/globals.css';
import '../../app/refined-layout.css';
import '../../app/operations-center.css';
import '../../app/professional.css';
import '../../app/account-switcher.css';
import '../../app/workspace-navigation.css';
import '../../app/selected-integrations.css';

installHybridNetwork();
const query=Object.fromEntries(new URLSearchParams(window.location.search));
const path=window.location.pathname.replace(/\/$/,'') || '/';
function PublicPlans({checkout=false}) {
 const [plans,setPlans]=useState(null),[error,setError]=useState(''),[attempt,retry]=useState(0);
 useEffect(()=>{let current=true;setError('');fetch('/api/public/plans',{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Planos indisponíveis.');if(current)setPlans(data.plans);}).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};},[attempt]);
 if(checkout){const code=path.split('/')[2];if(error)return <Loading error={error} onRetry={()=>retry(x=>x+1)}/>;if(!plans)return <Loading/>;return plans[code]?<CheckoutClient planCode={code} plan={plans[code]} initialCycle={query.cycle||'monthly'}/>:<Loading error="Plano não encontrado." onRetry={()=>window.location.assign('/planos')}/>;}
 return <>{error&&<Loading error={error} onRetry={()=>retry(x=>x+1)}/>}<PlansView plans={plans}/></>;
}
function Home() {
 const [session,setSession]=useState(null),[error,setError]=useState(''),[attempt,retry]=useState(0);
 useEffect(()=>{let current=true;setError('');fetch('/api/auth/session',{cache:'no-store'}).then(async response=>{const data=await response.json();if(response.status===401){if(current)setSession({authenticated:false});return;}if(!response.ok)throw Error(data.error||'Acesso indisponível.');if(current)setSession(data);}).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};},[attempt]);
 if(error)return <><Loading error={error} onRetry={()=>retry(x=>x+1)}/><AccessGate/></>;
 if(!session)return <PublicPlans/>;
 if(!session.authenticated)return <PublicPlans/>;
 const {currentUser,signOutPath,organizations,plans}=session;
 if(!session.consent)return <LegalConsentGate currentUser={currentUser} displayName={currentUser.displayName} signOutPath={signOutPath}/>;
 if(!organizations.length){const intent=onboardingIntent(query);return <CompanyOnboarding currentUser={currentUser} displayName={currentUser.displayName} email={currentUser.email} signOutPath={signOutPath} plans={plans} initialPlan={intent.plan} initialCheckoutId={intent.checkout}/>;}
 return <FamaSystemApp organizations={organizations} currentUser={currentUser} signOutPath={signOutPath}/>;
}
function App(){
 if(path==='/entrar')return <AccessGate initialMode={query.signup==='1'?'signup':'login'} addingAccount={query.add_account==='1'} reconnectingAccount={query.reconnect==='1'} initialEmail={String(query.email||'').slice(0,254)}/>;
 if(path==='/planos')return <PublicPlans/>;
 if(path.startsWith('/assinar/'))return <PublicPlans checkout/>;
 if(path.startsWith('/proposta/'))return <Proposal/>;
 const pages={'/manual':Manual,'/termos':Terms,'/privacidade':Privacy,'/privacidade/solicitar':PrivacyRequest,'/auth/confirmar':Confirm,'/auth/recuperar':Recover};
 if(pages[path]){const Page=pages[path];return <Page/>;}
 if(path==='/')return <Home/>;
 return <main className="legal-page"><h1>Página não encontrada</h1><a href="/">Voltar ao Fama System</a></main>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider><a className="skip-link" href="#conteudo">Pular para o conteúdo</a><div id="conteudo" tabIndex={-1}><App/></div><ServiceNotice/></ThemeProvider>);
