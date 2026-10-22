import { EventEmitter } from 'node:events';
import { Buffer } from 'node:buffer';

// Adapt ws' small client interface to workerd's supported WebSocket transport.
// Cloudflare performs the TLS connection and WebSocket framing.
export default class WorkerWebSocket extends EventEmitter {
    static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3;
    constructor(url,options={}) {
        super();this.readyState=0;this.socket=null;this.cancelled=false;
        this.open(url,options).catch(error=>{this.readyState=3;this.emit('error',error);this.emit('close',1006,Buffer.from('Connection failed'));});
    }
    async open(input,options) {
        const url=new URL(input);url.protocol=url.protocol==='wss:'?'https:':'http:';
        if(url.protocol!=='https:' || url.hostname!=='web.whatsapp.com')throw new Error('Unexpected WhatsApp destination');
        const response=await fetch(url,{headers:{Upgrade:'websocket',Origin:options.origin || 'https://web.whatsapp.com',...(options.headers || {})},redirect:'manual',signal:AbortSignal.timeout(options.handshakeTimeout || 20000)});
        if(!response.webSocket){void response.body?.cancel();throw new Error('WhatsApp WebSocket rejected: '+response.status);}
        this.socket=response.webSocket;this.socket.binaryType='arraybuffer';
        this.socket.addEventListener('message',event=>this.emit('message',typeof event.data==='string'?Buffer.from(event.data):Buffer.from(event.data)));
        this.socket.addEventListener('close',event=>{this.readyState=3;this.emit('close',event.code,Buffer.from(event.reason || ''));});
        this.socket.addEventListener('error',()=>this.emit('error',new Error('WhatsApp transport error')));
        this.socket.accept();
        if(this.cancelled){this.socket.close(1000,'Cancelled');return;}
        this.readyState=1;this.emit('open');
    }
    send(data,callback) {
        try{if(this.readyState!==1)throw new Error('WebSocket is not open');this.socket.send(data);callback?.();}
        catch(error){if(callback)callback(error);else throw error;}
    }
    close(code=1000,reason='') {this.cancelled=true;if(this.socket && this.readyState!==3){this.readyState=2;this.socket.close(code,reason);}}
    terminate(){this.close(1000,'Closed');}
}
