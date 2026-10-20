import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { Store } from './store.mjs';
import { Sessions, service } from './server.mjs';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',requestId='33333333-3333-4333-8333-333333333333';
const secret='a'.repeat(64),key='b'.repeat(64);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
    const store=new Store(':memory:',key);let calls=0;const sockets=[];
    const baileys={initAuthCreds:()=>({registered:false}),DisconnectReason:{loggedOut:401,badSession:500},proto:{Message:{AppStateSyncKeyData:{fromObject:value=>value}}},makeWASocket:()=>{
        const sock={ev:new EventEmitter(),user:{id:'5561999999999:1@s.whatsapp.net'},sendMessage:async()=>{calls++;return {key:{id:'message-'+calls}};},logout:async()=>{},end:()=>{}};sockets.push(sock);return sock;
    }};
    const sessions=new Sessions(store,baileys,{toDataURL:async()=> 'data:image/png;base64,cXItZml4dHVyZQ=='},2);
    return {store,sessions,sockets,calls:()=>calls,close:()=>{sessions.stop();store.close();}};
}
test('credentials and message bodies are encrypted, scoped to company, and tamper protected',()=>{
    const f=fixture();try{
        f.store.setAuth(a,'creds',{private:'private-session-fixture'});assert.deepEqual(f.store.getAuth(a,'creds'),{private:'private-session-fixture'});assert.equal(f.store.getAuth(b,'creds'),null);
        const row=f.store.db.prepare('SELECT value FROM auth').get();assert.ok(!row.value.includes('private-session-fixture'));assert.throws(()=>f.store.open(b,'creds',row.value));
        f.store.record(a,{id:'one',phone:'5561999999999',text:'private-message-fixture',timestamp:100,direction:'in'});
        assert.equal(f.store.messages(a,'5561999999999')[0].text,'private-message-fixture');assert.deepEqual(f.store.conversations(b),[]);
        assert.ok(!f.store.db.prepare('SELECT value FROM messages').get().value.includes('private-message-fixture'));
    }finally{f.close();}
});
test('concurrent connect shares a socket, QR is transient, and logout deletes only its company credentials',async()=>{
    const f=fixture();try{
        await Promise.all([f.sessions.connect(a),f.sessions.connect(a)]);assert.equal(f.sockets.length,1);
        f.sockets[0].ev.emit('connection.update',{qr:'qr-fixture'});await tick();assert.equal(f.sessions.view(a).status,'qr');assert.ok(f.sessions.view(a).qr);
        f.sessions.items.get(a).expiresAt=Date.now()-1;assert.equal(f.sessions.view(a).qr,null);
        f.store.setAuth(a,'creds',{private:true});f.store.setAuth(b,'creds',{other:true});
        f.sockets[0].ev.emit('connection.update',{connection:'open'});await tick();assert.equal(f.sessions.view(a).status,'connected');assert.equal(f.sessions.view(a).qr,null);
        await f.sessions.disconnect(a);assert.equal(f.store.getAuth(a,'creds'),null);assert.deepEqual(f.store.getAuth(b,'creds'),{other:true});assert.equal(f.sessions.view(a).status,'disconnected');
        f.sockets[0].ev.emit('connection.update',{qr:'stale-qr'});await tick();assert.equal(f.sessions.view(a).qr,null);
    }finally{f.close();}
});
test('duplicate send is persisted and an uncertain send is never retried',async()=>{
    const f=fixture();try{
        await f.sessions.connect(a);f.sockets[0].ev.emit('connection.update',{connection:'open'});await tick();
        const body={phone:'5561999999999',text:'Teste isolado',clientId:requestId};
        const first=await f.sessions.send(a,body),second=await f.sessions.send(a,body);assert.equal(first.id,second.id);assert.equal(second.duplicate,true);assert.equal(f.calls(),1);
        await assert.rejects(f.sessions.send(a,{...body,text:'Outro texto'}),error=>error.status===409);
        f.sockets[0].sendMessage=async()=>{throw new Error('connection lost');};const uncertain={...body,clientId:'44444444-4444-4444-8444-444444444444'};
        await assert.rejects(f.sessions.send(a,uncertain));f.sockets[0].sendMessage=async()=>{throw new Error('must not retry');};
        await assert.rejects(f.sessions.send(a,uncertain),error=>error.status===409 && /sem confirmação/.test(error.message));
    }finally{f.close();}
});
test('received direct messages stay isolated; groups and old sockets cannot write',async()=>{
    const f=fixture();try{
        await f.sessions.connect(a);const sock=f.sockets[0];
        sock.ev.emit('messages.upsert',{type:'notify',messages:[{key:{id:'direct',remoteJid:'5561999999999@s.whatsapp.net'},pushName:'Contato',messageTimestamp:Date.now()/1000,message:{conversation:'Olá'}},{key:{id:'group',remoteJid:'123@g.us'},message:{conversation:'Grupo'}}]});await tick();
        assert.equal(f.store.conversations(a).length,1);assert.deepEqual(f.store.conversations(b),[]);
        await f.sessions.disconnect(a);sock.ev.emit('messages.upsert',{type:'notify',messages:[{key:{id:'stale',remoteJid:'5561999999999@s.whatsapp.net'},message:{conversation:'old'}}]});await tick();assert.equal(f.store.messages(a,'5561999999999').length,1);
    }finally{f.close();}
});
test('HTTP rejects missing credentials, traversal, oversized body and exposes no auth keys',async()=>{
    const f=fixture(),server=service({secret,sessions:f.sessions,store:f.store});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Bearer '+secret,'Content-Type':'application/json'};
    try{
        assert.equal((await fetch(base+'/health')).status,401);assert.equal((await fetch(base+'/health',{headers})).status,200);
        assert.equal((await fetch(base+'/v1/companies/invalid/session',{headers})).status,404);
        const r=await fetch(base+'/v1/companies/'+a+'/session',{headers,method:'POST'});assert.equal(r.status,200);assert.doesNotMatch(await r.text(),/creds|keys|private/);
        assert.equal((await fetch(base+'/v1/companies/'+a+'/messages',{headers,method:'POST',body:JSON.stringify({text:'a'.repeat(25000)})})).status,413);
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));f.close();}
});
