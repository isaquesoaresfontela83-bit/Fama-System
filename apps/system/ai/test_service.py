import asyncio
import json
import unittest
from service import handle, clean_narrative, DEFAULT_MODEL

TOKEN = 'fixture-service-token-with-at-least-32-characters'


class ServiceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.config = {'FAMA_AI_SERVICE_TOKEN': TOKEN, 'FAMA_AI_GENERATIVE_ENABLED': 'true'}
        self.headers = {'authorization': f'Bearer {TOKEN}', 'content-type': 'application/json'}
        self.query = {'question': 'Como priorizar os recebimentos?', 'history': ['Resumo financeiro'],
                      'evidence': {'source': 'finance', 'text': 'A receber: R$ 450,00. Um lançamento pendente.'}}
        self.calls = []

    async def model(self, name, payload):
        self.calls.append((name, payload))
        return {'response': 'Priorize os recebimentos pendentes e confira os vencimentos.'}

    async def request(self, path='/v1/generate', body=None, headers=None, method='POST', model=None):
        return await handle(method, path, self.headers if headers is None else headers,
                            json.dumps(self.query if body is None else body).encode(), self.config, model or self.model)

    async def test_auth_before_parsing_or_inference(self):
        for headers in [{}, {**self.headers, 'authorization': 'Bearer invalid'}]:
            status, _ = await self.request(body='invalid', headers=headers)
            self.assertEqual(status, 401)
        self.config['FAMA_AI_SERVICE_TOKEN'] = ''
        self.assertEqual((await self.request())[0], 401)
        self.assertEqual(self.calls, [])

    async def test_status_is_free_and_redacted(self):
        status, result = await self.request('/v1/status', method='GET')
        self.assertEqual(status, 200)
        self.assertEqual(result['runtime'], 'python')
        self.assertEqual(result['model'], DEFAULT_MODEL)
        self.assertNotIn(TOKEN, json.dumps(result))
        self.assertEqual(self.calls, [])

    async def test_only_authorized_summary_enters_prompt(self):
        status, result = await self.request()
        self.assertEqual(status, 200)
        self.assertEqual(result['state'], 'ready')
        self.assertEqual(len(self.calls), 1)
        model, body = self.calls[0]
        self.assertEqual(model, DEFAULT_MODEL)
        self.assertFalse(body['stream'])
        self.assertIn('450,00', body['messages'][1]['content'])
        self.assertNotIn(TOKEN, json.dumps(body))
        self.assertEqual(len(body['messages']), 2)

    async def test_rejects_forged_context_and_invalid_types(self):
        malformed = [[], {}, {**self.query, 'context': {'balance': 999}},
                     {**self.query, 'history': 'wrong'}, {**self.query, 'question': 'x'},
                     {**self.query, 'evidence': {**self.query['evidence'], 'records': []}},
                     {**self.query, 'evidence': {'source': [], 'text': 'text'}},
                     {**self.query, 'evidence': {'source': 'finance', 'text': 'x'*12_001}}]
        for body in malformed:
            with self.subTest(body=str(body)[:80]):
                self.assertEqual((await self.request(body=body))[0], 400)
        self.assertEqual(self.calls, [])

    async def test_rejects_wrong_route_type_and_oversize_body(self):
        self.assertEqual((await self.request('/other'))[0], 404)
        self.assertEqual((await self.request(method='GET'))[0], 405)
        self.assertEqual((await self.request(headers={**self.headers, 'content-type': 'text/plain'}))[0], 415)
        self.assertEqual((await handle('POST','/v1/generate',self.headers,b'x'*24_001,self.config,self.model))[0], 413)

    async def test_invalid_model_and_paused_configuration_do_not_infer(self):
        self.config['FAMA_AI_MODEL'] = '../../other/provider'
        self.assertEqual((await self.request())[0], 503)
        self.config.pop('FAMA_AI_MODEL')
        self.config['FAMA_AI_GENERATIVE_ENABLED'] = 'false'
        self.assertEqual((await self.request())[1]['state'], 'disabled')
        self.assertEqual(self.calls, [])

    async def test_rejects_hallucinations_execution_claims_and_credentials(self):
        for raw in ['Saldo R$ 999,00.', 'Enviei a cobrança.', TOKEN, {'type': 'tool_use'}, 'x'*64_001]:
            async def model(name, body): return {'response': raw}
            self.assertEqual((await self.request(model=model))[1]['state'], 'invalid_response')
        self.assertEqual(clean_narrative('<think>interno</think>Confira R$ 450,00.', 'R$ 450,00'), 'Confira R$ 450,00.')

    async def test_provider_failure_is_not_retried_or_leaked(self):
        async def failed(name, body):
            self.calls.append(name)
            raise RuntimeError(TOKEN)
        status, result = await self.request(model=failed)
        self.assertEqual(status, 502)
        self.assertNotIn(TOKEN, json.dumps(result))
        self.assertEqual(len(self.calls), 1)

    async def test_timeout_is_bounded(self):
        self.config['FAMA_AI_TIMEOUT_MS'] = '1000'
        async def stalled(name, body): await asyncio.Event().wait()
        status, result = await self.request(model=stalled)
        self.assertEqual(status, 504)
        self.assertEqual(result['failure'], 'timeout')

    async def test_diagnostics_are_synthetic_and_token_cap_is_enforced(self):
        self.assertEqual((await self.request('/v1/connection-test', body={}))[0], 200)
        self.assertEqual(self.calls[0][1]['max_tokens'], 64)
        self.assertNotIn('450', json.dumps(self.calls[0]))
        self.assertEqual((await self.request('/v1/connection-test', body=self.query))[0], 400)
        self.config['FAMA_AI_MAX_TOKENS'] = '999999'
        self.query['maxTokens'] = 999999
        await self.request()
        self.assertEqual(self.calls[-1][1]['max_tokens'], 2048)


if __name__ == '__main__':
    unittest.main()
