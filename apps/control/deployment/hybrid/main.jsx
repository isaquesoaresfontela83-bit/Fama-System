import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import {ThemeProvider} from '../../app/theme-provider';
import {AccessGate} from '../../app/access-gate';
import {ControlApp} from '../../app/control-app';
import {RestrictedAccess} from '../../app/restricted-access';
import Manual from '../../app/manual/page';
import {ServiceNotice,Loading} from './status';
import {installHybridNetwork} from './network';
import '../../app/globals.css';
import '../../app/control-premium.css';
import '../../app/control-integrations.css';
import '../../app/control-apis.css';
import '../../app/professional.css';
installHybridNetwork();
function App(){
 const [session,setSession]=useState(null),[error,setError]=useState(''),[attempt,retry]=useState(0);
 const manual=window.location.pathname==='/manual';
 useEffect(()=>{if(manual)return;let current=true;setError('');fetch('/api/auth/session',{cache:'no-store'}).then(async response=>{const payload=await response.json();if(response.status===401){if(current)setSession({authenticated:false});return;}if(response.status===403){if(current)setSession({restricted:true});return;}if(!response.ok)throw Error(payload.error||'Acesso indisponível.');if(current)setSession(payload);}).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};},[attempt,manual]);
 if(manual)return <Manual/>;
 if(session?.restricted)return <RestrictedAccess signOutPath="/api/auth/logout?return_to=%2F"/>;
 if(session?.authenticated)return <ControlApp displayName={session.displayName} email={session.email} signOutPath={session.signOutPath} systemUrl="https://famasystem.online"/>;
 return <>{error&&<Loading error={error} onRetry={()=>retry(x=>x+1)}/>}<AccessGate/></>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider><div id="conteudo"><App/><ServiceNotice/></div></ThemeProvider>);
