import { createHandler } from "./handler.js";

Deno.test("backend integrations: 28 isolated security and provider cases", async () => {
  const result = await (async () => {

const testOrg="11111111-1111-4111-8111-111111111111", testUser="22222222-2222-4222-8222-222222222222", requestId="33333333-3333-4333-8333-333333333333";
const cases=[];
function check(ok,name){if(!ok)throw new Error("FAIL: "+name);cases.push(name);}
function fixture(options={}){
 const calls=[];
 const variables={SUPABASE_URL:"https://test-project.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"synthetic-service-key",...(options.variables??{})};
 const handle=createHandler({env:name=>variables[name],fetch:async(url,init={})=>{
  const target=String(url);calls.push({url:target,init});
  if(target.endsWith("/auth/v1/user"))return Response.json(options.invalidAuth?{}:{id:testUser},{status:options.invalidAuth?401:200});
  if(target.includes("/rest/v1/organization_members?")){const q=new URL(target).searchParams;if(q.get("user_id")!=="eq."+testUser||q.get("organization_id")!=="eq."+testOrg)throw new Error("Wrong tenant filter");return Response.json(options.noMembership?[]:[{role:options.role??"admin",status:"active"}]);}
  if(target.includes("/rest/v1/organizations?"))return Response.json([{id:testOrg,status:options.orgInactive?"blocked":"active",billing_enabled:true,block_on_expiry:true,plan_status:options.expired?"expired":"active",plan_expires_at:null}]);
  if(target.endsWith("/rest/v1/rpc/fama_consume_rate_limit"))return Response.json(!options.rateDenied);
  if(options.providerStatus)return Response.json({error:"synthetic-provider-secret-echo"},{status:options.providerStatus});
  if(target==="https://oauth2.googleapis.com/token")return Response.json({access_token:"synthetic-google-token",expires_in:3600});
  if(target.startsWith("https://www.googleapis.com/upload/drive/v3/files?"))return Response.json({id:"drive-file-1",name:"test.txt",webViewLink:"https://drive.google.com/file/d/test"});
  if(target==="https://api.resend.com/emails")return Response.json({id:"email-id-1"});
  if(target==="https://api.ocr.space/parse/image")return Response.json({IsErroredOnProcessing:false,OCRExitCode:1,ParsedResults:[{ParsedText:"Documento de teste"}]});
  if(target==="https://o123.ingest.us.sentry.io/api/42/envelope/")return Response.json({id:"sentry-id"});
  throw new Error("Unexpected request: "+target);
 }});
 const request=(action,body={},extra={})=>new Request("https://test-project.supabase.co/functions/v1/fama-system-integrations",{method:"POST",headers:{"authorization":"Bearer synthetic-valid-user-token-12345","content-type":"application/json","origin":"https://famasystem.online",...extra},body:JSON.stringify({action,organization_id:testOrg,...body})});
 return{handle,calls,request};
}
let h=fixture(),r=await h.handle(new Request("https://example.test",{method:"POST"}));
check(r.status===401&&h.calls.length===0,"sem autenticação: 401 antes de qualquer chamada");
h=fixture();r=await h.handle(h.request("integration_status",{},{"origin":"https://evil.example"}));
check(r.status===403&&h.calls.length===0,"origem externa bloqueada");
h=fixture({invalidAuth:true});r=await h.handle(h.request("integration_status"));
check(r.status===401,"JWT inválido bloqueado");
h=fixture({role:"viewer"});r=await h.handle(h.request("integration_status"));
check(r.status===403,"perfil sem privilégio bloqueado");
h=fixture({noMembership:true});r=await h.handle(h.request("integration_status"));
check(r.status===403,"usuário de outra empresa bloqueado");
h=fixture({orgInactive:true});r=await h.handle(h.request("integration_status"));
check(r.status===403,"empresa suspensa bloqueada");
h=fixture({expired:true});r=await h.handle(h.request("integration_status"));
check(r.status===402,"plano bloqueado respeitado");
h=fixture();r=await h.handle(h.request("integration_status",{organization_id:"44444444-4444-4444-8444-444444444444"},{"x-organization-id":testOrg}));
check(r.status===403,"troca de empresa no corpo bloqueada");
h=fixture();r=await h.handle(h.request("integration_status"));let result=await r.json();
check(r.status===200&&Object.values(result.data).every(x=>x.configured===false)&&!JSON.stringify(result).includes("synthetic-service-key"),"status não revela credenciais e informa serviços pendentes");
for(const action of ["drive_upload","resend_send","ocr_extract","sentry_capture"]){h=fixture();r=await h.handle(h.request(action));check(r.status===424,"credencial ausente em "+action+": 424");}
h=fixture({rateDenied:true});r=await h.handle(h.request("integration_status"));
check(r.status===429,"limite de requisições respeitado");
const resendVars={FAMA_RESEND_API_KEY:"synthetic-resend-key",FAMA_RESEND_FROM:"Fama <sender@example.test>"};
h=fixture({variables:resendVars});const emailBody={to:"recipient@example.test",subject:"Documento",text:"Mensagem de teste",request_id:requestId,apikey:"untrusted-client-key"};
r=await h.handle(h.request("resend_send",emailBody));result=await r.json();
const sent=h.calls.find(x=>x.url==="https://api.resend.com/emails");
check(r.status===200&&result.data.id==="email-id-1"&&sent.init.headers.Authorization==="Bearer synthetic-resend-key"&&!JSON.stringify(result).includes("synthetic-resend-key"),"Resend usa somente a credencial do servidor");
await h.handle(h.request("resend_send",emailBody));
const sentTwice=h.calls.filter(x=>x.url==="https://api.resend.com/emails");
check(sentTwice[0].init.headers["Idempotency-Key"]===sentTwice[1].init.headers["Idempotency-Key"],"reenvio mantém a chave de idempotência");
h=fixture({variables:resendVars});r=await h.handle(h.request("resend_send",{...emailBody,request_id:""}));
check(r.status===400&&!h.calls.some(x=>x.url==="https://api.resend.com/emails"),"e-mail sem identificador não é enviado");
h=fixture({variables:resendVars});r=await h.handle(h.request("resend_send",{...emailBody,to:"a@example.test\r\nBcc:b@example.test"}));
check(r.status===400&&!h.calls.some(x=>x.url==="https://api.resend.com/emails"),"injeção no destinatário bloqueada");
const driveVars={FAMA_GOOGLE_DRIVE_CLIENT_ID:"client-test",FAMA_GOOGLE_DRIVE_CLIENT_SECRET:"secret-test",FAMA_GOOGLE_DRIVE_REFRESH_TOKEN:"refresh-test",FAMA_GOOGLE_DRIVE_FOLDER_ID:"test_folder_12345"};
h=fixture({variables:driveVars});r=await h.handle(h.request("drive_upload",{file:{name:"test.txt",mime_type:"text/plain",base64:"dGVzdA=="}}));
const upload=h.calls.find(x=>x.url.startsWith("https://www.googleapis.com/upload/drive/"));
check(r.status===200&&upload.init.headers["Content-Type"].startsWith("multipart/related;")&&new TextDecoder().decode(upload.init.body).includes(testOrg+"_test.txt")&&new TextDecoder().decode(upload.init.body).includes("test"),"Drive envia multipart e marca a empresa nos metadados");
await h.handle(h.request("drive_upload",{file:{name:"test2.txt",mime_type:"text/plain",base64:"dGVzdA=="}}));
check(h.calls.filter(x=>x.url==="https://oauth2.googleapis.com/token").length===1,"token OAuth renovado em cache no servidor");
h=fixture({variables:driveVars});r=await h.handle(h.request("drive_upload",{file:{name:"../bad.txt",mime_type:"text/plain",base64:"dGVzdA=="}}));
check(r.status===400&&!h.calls.some(x=>x.url==="https://oauth2.googleapis.com/token"),"nome de arquivo inválido bloqueado antes do provedor");
h=fixture({variables:{FAMA_OCRSPACE_API_KEY:"synthetic-ocr-key"}});r=await h.handle(h.request("ocr_extract",{file:{name:"image.png",mime_type:"image/png",base64:"dGVzdA=="}}));result=await r.json();
const ocr=h.calls.find(x=>x.url==="https://api.ocr.space/parse/image");
check(r.status===200&&result.data.text==="Documento de teste"&&ocr.init.headers.apikey==="synthetic-ocr-key"&&ocr.init.body.get("base64Image").startsWith("data:image/png;base64,"),"OCR protegido usa POST e chave no cabeçalho");
h=fixture({variables:{FAMA_OCRSPACE_API_KEY:"synthetic-ocr-key"}});r=await h.handle(h.request("ocr_extract",{file:{name:"large.png",mime_type:"image/png",base64:"A".repeat(1398108)}}));
check(r.status===413&&!h.calls.some(x=>x.url==="https://api.ocr.space/parse/image"),"limite de arquivo OCR validado antes do envio");
h=fixture({variables:{FAMA_SENTRY_DSN:"https://"+"a".repeat(32)+"@attacker.example/42"}});r=await h.handle(h.request("sentry_capture"));
check(r.status===424&&!h.calls.some(x=>x.url.includes("attacker.example")),"DSN externo arbitrário bloqueado");
h=fixture({variables:{FAMA_SENTRY_DSN:"https://"+"a".repeat(32)+"@o123.ingest.us.sentry.io/42"}});r=await h.handle(h.request("sentry_capture",{message:"Teste de monitoramento"}));result=await r.json();
const sentry=h.calls.find(x=>x.url==="https://o123.ingest.us.sentry.io/api/42/envelope/");
check(r.status===200&&sentry.init.headers["Content-Type"]==="application/x-sentry-envelope"&&sentry.init.body.includes('"type":"event"')&&!JSON.stringify(result).includes("a".repeat(32)),"Sentry recebe envelope do backend sem divulgar DSN");
h=fixture({variables:resendVars,providerStatus:429});r=await h.handle(h.request("resend_send",emailBody));result=await r.json();
check(r.status===429&&!JSON.stringify(result).includes("synthetic-provider-secret-echo"),"erro do provedor não expõe corpo ou credenciais");
h=fixture();r=await h.handle(h.request("integration_status",{},{"content-length":"9999999"}));
check(r.status===413,"requisição excessiva rejeitada");
h=fixture();r=await h.handle(h.request("arbitrary_proxy",{url:"https://attacker.example"}));
check(r.status===400&&!h.calls.some(x=>x.url.includes("attacker.example")),"proxy arbitrário não permitido");
return {passed:cases.length,cases,real_provider_calls:0,scope:"Testes com Web APIs nativas e rede simulada; nenhum e-mail, arquivo ou evento real enviado."};
  })();
  if (result.passed !== 28) throw new Error("Unexpected test count");
});
