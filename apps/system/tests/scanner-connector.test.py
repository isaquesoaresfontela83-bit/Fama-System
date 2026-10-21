import importlib.util
import json
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('scanner', Path(__file__).parents[1] / 'public/downloads/fama-scanner.py')
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)

class ScannerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = scanner.ThreadingHTTPServer(('127.0.0.1', 0), scanner.Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
    def request(self, path='/scan', origin=scanner.ORIGIN, token=scanner.TOKEN):
        req = urllib.request.Request(f'http://127.0.0.1:{self.server.server_port}{path}', method='POST', headers={'Origin': origin, 'Authorization': 'Bearer ' + token})
        try:
            return urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:
            return error
    def test_forbidden_origin(self):
        result = self.request(origin='https://example.com')
        self.assertEqual(result.status, 403)
        self.assertIsNone(result.headers.get('Access-Control-Allow-Origin'))
    def test_status_requires_code(self):
        self.assertEqual(self.request('/status', token='wrong').status, 403)
    def test_status_does_not_claim_hardware_detected(self):
        with patch.object(scanner, 'naps2_command', return_value=['naps2', 'console']):
            result = json.load(self.request('/status'))
            self.assertEqual(result['backend'], 'NAPS2')
            self.assertIn('captura', result['message'])
    def test_naps2_scan(self):
        def run(args, **kwargs):
            self.assertEqual(args[:2], ['naps2', 'console'])
            self.assertEqual(args[args.index('-p') + 1], 'Fama')
            self.assertIn('--disableocr', args)
            Path(kwargs['env']['FAMA_SCAN_OUTPUT']).write_bytes(b'\xff\xd8\xff\xd9')
            return SimpleNamespace(returncode=0)
        with patch.object(scanner, 'naps2_command', return_value=['naps2', 'console']), patch.object(scanner.subprocess, 'run', side_effect=run):
            result = self.request()
            self.assertEqual(result.status, 200)
            self.assertTrue(json.load(result)['image'].startswith('data:image/jpeg;base64,'))
    def test_busy(self):
        with patch.object(scanner, 'naps2_command', return_value=['naps2', 'console']):
            scanner.LOCK.acquire()
            try:
                self.assertEqual(self.request().status, 409)
            finally:
                scanner.LOCK.release()
    def test_timeout(self):
        with patch.object(scanner, 'naps2_command', return_value=['naps2', 'console']), patch.object(scanner.subprocess, 'run', side_effect=scanner.subprocess.TimeoutExpired('naps2', 100)):
            self.assertEqual(self.request().status, 504)
            self.assertFalse(scanner.LOCK.locked())
    def test_linux_detection(self):
        with patch.object(scanner.platform, 'system', return_value='Linux'), patch.object(scanner.shutil, 'which', return_value='/usr/bin/naps2'):
            self.assertEqual(scanner.naps2_command(), ['/usr/bin/naps2', 'console'])
    def test_mac_detection(self):
        with patch.object(scanner.platform, 'system', return_value='Darwin'), patch.object(scanner.Path, 'is_file', return_value=True):
            self.assertEqual(scanner.naps2_command(), ['/Applications/NAPS2.app/Contents/MacOS/NAPS2', 'console'])

if __name__ == '__main__':
    unittest.main()
