import { whatsappPhoneInput } from './fama-whatsapp';
import { buildTechnicianMessage,normalizeName } from './daily-agenda';
export function splitAgendaMessage(text,maximum=4096) {
    const parts=[];let rest=String(text);
    if(rest.length>64000)throw new Error('Agenda muito extensa. Divida os atendimentos antes de enviar.');
    while(rest.length>maximum){let end=rest.lastIndexOf('\n',maximum-1);if(end<maximum/2)end=maximum-1;if(/[\uD800-\uDBFF]/.test(rest[end-1]))end--;parts.push(rest.slice(0,end));rest=rest.slice(end);}
    if(rest)parts.push(rest);return parts;
}
export function agendaRecipients(data,selectedIds=[]) {
    const employees=data.employees.filter(employee=>employee.active!==false&&employee.active!==0),phones=new Map();
    for(const employee of employees){try{const phone=whatsappPhoneInput(employee.phone);phones.set(phone,(phones.get(phone)||0)+1);}catch{}}
    return employees.filter(employee=>!selectedIds.length||selectedIds.includes(employee.id)).map(employee=>{
        const name=normalizeName(employee.name),result={employee,phone:'',reason:'',appointments:[],warranties:[],orders:[]};
        if(!name||employees.filter(candidate=>normalizeName(candidate.name)===name).length!==1){result.reason='Nome duplicado na equipe. Corrija o cadastro antes de enviar.';return result;}
        try{result.phone=whatsappPhoneInput(employee.phone);}catch{result.reason='Telefone sem DDI/DDD cadastrado.';return result;}
        if(phones.get(result.phone)!==1){result.reason='Telefone compartilhado por mais de um profissional. Confira o destinatário.';return result;}
        for(const key of ['appointments','warranties','orders'])result[key]=(data[key]||[]).filter(record=>normalizeName(record.technician)===name&&!['cancelado','cancelada','concluido','concluida'].includes(record.status));
        if(!result.appointments.length&&!result.warranties.length&&!result.orders.length)result.reason='Sem agenda pendente para hoje.';
        return result;
    });
}
export function recipientMessage(recipient,day){return buildTechnicianMessage({...recipient,day});}
