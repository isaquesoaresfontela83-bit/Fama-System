import json
import os
import unittest
from unittest.mock import patch
import asgi_vps


class VpsAiTests(unittest.IsolatedAsyncioTestCase):
    async def request(self, authorization, method='POST', path='/v1/connection-test', enabled='true'):
        sent = []
        async def receive():
            return {'type': 'http.request', 'body': b'{}', 'more_body': False}
        async def send(message):
            sent.append(message)
        configuration = {'FAMA_AI_SERVICE_TOKEN': 'a' * 48, 'FAMA_AI_GENERATIVE_ENABLED': enabled}
        with patch.dict(os.environ, configuration, clear=True):
            with patch('asgi_vps.infer', return_value={'response': 'Conexão com a Fama IA confirmada.'}) as infer:
                await asgi_vps.app({'type': 'http', 'method': method, 'path': path,
                    'headers': [(b'authorization', authorization.encode()), (b'content-type', b'application/json')]}, receive, send)
                return sent[0]['status'], json.loads(sent[1]['body']), infer.call_count

    async def test_authorization_precedes_any_local_model_call(self):
        status, _payload, calls = await self.request('Bearer wrong')
        self.assertEqual((status, calls), (401, 0))

    async def test_status_reports_local_python_and_disabled_model_without_inference(self):
        status, payload, calls = await self.request('Bearer ' + 'a' * 48, method='GET', path='/v1/status', enabled='false')
        self.assertEqual((status, calls), (200, 0))
        self.assertEqual((payload['provider'], payload['state']), ('local-python', 'disabled'))

    async def test_authorized_diagnostic_uses_local_inference(self):
        status, payload, calls = await self.request('Bearer ' + 'a' * 48)
        self.assertEqual((status, calls, payload['state']), (200, 1, 'ready'))


if __name__ == '__main__':
    unittest.main()
