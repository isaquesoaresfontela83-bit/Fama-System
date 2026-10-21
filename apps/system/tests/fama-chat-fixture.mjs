// HTTP fixture for route tests; PostgreSQL rules are also verified by the SQL validation.
export function chatFixture(state, body, path) {
  const fail = message => Response.json({ code: '22023', message }, { status: 400 });
  const connection = state.fama_whatsapp_connections.find(row => row.id === body.p_connection_id && (!body.p_organization_id || row.organization_id === body.p_organization_id));
  const scoped = row => row.connection_id === body.p_connection_id && row.organization_id === connection?.organization_id;
  if (path.endsWith('/fama_chat_record_message')) {
    if (!connection?.verified_at || !connection.webhook_verified_at || state.organizations.find(row => row.id === connection.organization_id)?.status !== 'active') return Response.json(null);
    if (state.fama_chat_messages.some(row => row.connection_id === connection.id && row.provider_message_id === body.p_message_id)) return Response.json(null);
    let thread = state.fama_chat_conversations.find(row => scoped(row) && row.business_phone_id === connection.phone_number_id && row.phone_hash === body.p_phone_hash);
    if (!thread) { thread = { id: crypto.randomUUID(), organization_id: connection.organization_id, connection_id: connection.id, business_phone_id: connection.phone_number_id, phone_hash: body.p_phone_hash, phone_ciphertext: body.p_phone_ciphertext, name_ciphertext: '', last_message_at: body.p_occurred_at, last_message_ciphertext: '', last_inbound_at: null, last_read_at: null }; state.fama_chat_conversations.push(thread); }
    if (body.p_name_ciphertext) thread.name_ciphertext = body.p_name_ciphertext;
    const message = { id: crypto.randomUUID(), organization_id: connection.organization_id, connection_id: connection.id, conversation_id: thread.id, direction: body.p_direction, kind: body.p_kind, body_ciphertext: body.p_body_ciphertext, provider_message_id: body.p_message_id, actor_user_id: body.p_actor_user_id, status: body.p_direction === 'in' ? 'received' : 'sent', occurred_at: body.p_occurred_at };
    state.fama_chat_messages.push(message); thread.last_message_ciphertext = body.p_body_ciphertext; thread.last_message_at = body.p_occurred_at;
    if (body.p_direction === 'in') thread.last_inbound_at = body.p_occurred_at;
    return Response.json(thread.id);
  }
  if (path.endsWith('/fama_chat_reserve_send')) {
    if (!connection?.verified_at || !connection.webhook_verified_at) return fail('Connection not ready');
    let message = state.fama_chat_messages.find(row => row.organization_id === body.p_organization_id && row.client_request_id === body.p_client_request_id);
    if (message) {
      if (message.request_hash !== body.p_request_hash || message.actor_user_id !== body.p_actor_user_id) return fail('Request identity conflict');
      const thread = state.fama_chat_conversations.find(row => scoped(row) && row.id === message.conversation_id && row.business_phone_id === connection.phone_number_id);
      return thread ? Response.json({ created: false, message, conversation: thread }) : fail('Conversation not found');
    }
    let thread = state.fama_chat_conversations.find(row => scoped(row) && row.business_phone_id === connection.phone_number_id && (body.p_conversation_id ? row.id === body.p_conversation_id : row.phone_hash === body.p_phone_hash));
    if (!thread && !body.p_conversation_id && body.p_kind === 'template') { thread = { id: crypto.randomUUID(), organization_id: connection.organization_id, connection_id: connection.id, business_phone_id: connection.phone_number_id, phone_hash: body.p_phone_hash, phone_ciphertext: body.p_phone_ciphertext, name_ciphertext: '', last_inbound_at: null }; state.fama_chat_conversations.push(thread); }
    if (!thread) return fail('Conversation not found');
    if (body.p_kind === 'text' && (!thread.last_inbound_at || Date.now() - Date.parse(thread.last_inbound_at) >= 86400_000)) return fail('Customer service window closed');
    message = { id: crypto.randomUUID(), organization_id: connection.organization_id, connection_id: connection.id, conversation_id: thread.id, direction: 'out', kind: body.p_kind, body_ciphertext: body.p_body_ciphertext, client_request_id: body.p_client_request_id, request_hash: body.p_request_hash, actor_user_id: body.p_actor_user_id, status: 'sending', occurred_at: new Date().toISOString() };
    state.fama_chat_messages.push(message); thread.last_message_ciphertext = body.p_body_ciphertext; thread.last_message_at = message.occurred_at;
    if (state.onReserve) state.onReserve();
    return Response.json({ created: true, message, conversation: thread });
  }
  if (path.endsWith('/fama_chat_message_page')) {
    if (!state.fama_chat_conversations.some(row => scoped(row) && row.id === body.p_conversation_id)) return fail('Conversation not found');
    const rows = state.fama_chat_messages.filter(row => scoped(row) && row.conversation_id === body.p_conversation_id).sort((a,b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id));
    const start = body.p_before_id ? rows.findIndex(row => row.id === body.p_before_id) + 1 : 0;
    if (body.p_before_id && !start) return fail('Message not found');
    return Response.json(rows.slice(start, start + 101));
  }
  if (path.endsWith('/fama_chat_delivery')) {
    const message = state.fama_chat_messages.find(row => row.connection_id === body.p_connection_id && row.provider_message_id === body.p_message_id && row.direction === 'out');
    const thread = state.fama_chat_conversations.find(row => row.id === message?.conversation_id && row.phone_hash === body.p_phone_hash);
    const previous = { read: ['sending','sent','uncertain','delivered'], delivered: ['sending','sent','uncertain'], sent: ['sending','uncertain'], failed: ['sending','sent','uncertain'] };
    if (!message || !thread || !previous[body.p_status]?.includes(message.status)) return Response.json(false);
    message.status = body.p_status; return Response.json(true);
  }
  throw new Error('Unknown chat fixture path');
}
