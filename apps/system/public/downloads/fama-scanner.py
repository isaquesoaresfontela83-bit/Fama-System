"""Fama Scanner experimental: Python 3 + NAPS2 (Windows/macOS/Linux).
Execute: python fama-scanner.py. Stop: Ctrl+C.
Only the configured Fama origin can request scans, with the session code.
"""
import base64
import hmac
import json
import os
import platform
import shutil
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import secrets
import subprocess
import tempfile
import threading
from pathlib import Path

ORIGIN = 'https://famasystem.online'
TOKEN = secrets.token_urlsafe(32)
LOCK = threading.Lock()
SCRIPT = r'''
$ErrorActionPreference = 'Stop'
$manager = New-Object -ComObject WIA.DeviceManager
$device = $null
foreach ($info in $manager.DeviceInfos) {
  if ($info.Type -eq 1) { $device = $info.Connect(); break }
}
if ($null -eq $device) { throw 'Nenhum scanner WIA encontrado. Instale o driver Epson.' }
$item = $device.Items.Item(1)
foreach ($property in $item.Properties) {
  if ($property.PropertyID -eq 6147 -or $property.PropertyID -eq 6148) { $property.Value = 300 }
}
$image = $item.Transfer('{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}')
$image.SaveFile($env:FAMA_SCAN_OUTPUT)
'''

def naps2_command():
    """Use a named Fama profile so the operator selects the actual scanner."""
    if platform.system() == 'Windows':
        for root in [os.environ.get('ProgramFiles', ''), os.environ.get('LOCALAPPDATA', '')]:
            candidate = Path(root) / 'NAPS2' / 'NAPS2.Console.exe'
            if root and candidate.is_file():
                return [str(candidate)]
        executable = shutil.which('NAPS2.Console.exe')
        if executable:
            return [executable]
    if platform.system() == 'Darwin':
        candidate = Path('/Applications/NAPS2.app/Contents/MacOS/NAPS2')
        if candidate.is_file():
            return [str(candidate), 'console']
    executable = shutil.which('naps2')
    if executable:
        return [executable, 'console']
    return None


def connector_status():
    command = naps2_command()
    backend = 'NAPS2' if command else 'WIA' if os.name == 'nt' else None
    return {'platform': platform.system(), 'backend': backend,
            'available': backend is not None,
            'message': 'Conector disponível. A detecção do scanner é feita na captura.' if backend else 'Instale NAPS2 e crie um perfil chamado Fama para o scanner.'}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def reply(self, status, value):
        data = json.dumps(value).encode('utf-8')
        self.send_response(status)
        if self.headers.get('Origin') == ORIGIN:
            self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Vary', 'Origin')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        if self.headers.get('Origin') != ORIGIN or self.path not in ('/scan', '/status'):
            return self.reply(403, {'error': 'Origem não autorizada.'})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'POST')
        self.send_header('Access-Control-Allow-Headers', 'Authorization')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Vary', 'Origin')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_POST(self):
        if self.path not in ('/scan', '/status'):
            return self.reply(404, {'error': 'Rota inexistente.'})
        if self.headers.get('Origin') != ORIGIN or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
            return self.reply(403, {'error': 'Código do conector inválido ou origem não autorizada.'})
        if self.path == '/status':
            return self.reply(200, connector_status())
        command = naps2_command()
        if not command and os.name != 'nt':
            return self.reply(503, {'error': 'Instale NAPS2 neste computador e crie um perfil chamado Fama com o scanner selecionado.'})
        if not LOCK.acquire(blocking=False):
            return self.reply(409, {'error': 'Scanner ocupado. Aguarde a captura atual.'})
        try:
            with tempfile.TemporaryDirectory(prefix='fama-scan-') as folder:
                output = Path(folder) / 'page.jpg'
                env = dict(os.environ, FAMA_SCAN_OUTPUT=str(output))
                args = command + ['-p', 'Fama', '-o', str(output), '--source', 'glass', '--dpi', '300', '-n', '1', '--disableocr'] if command else ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', SCRIPT]
                result = subprocess.run(args, env=env, capture_output=True, timeout=100, **({'creationflags': 0x08000000} if os.name == 'nt' else {}))
                if result.returncode or not output.exists():
                    return self.reply(503, {'error': 'Não foi possível capturar. Verifique conexão, driver, perfil Fama no NAPS2 e se o scanner está ocupado.'})
                if output.stat().st_size > 15 * 1024 * 1024:
                    return self.reply(413, {'error': 'Página muito grande.'})
                raw = output.read_bytes()
                if not raw.startswith(b'\xff\xd8\xff'):
                    return self.reply(503, {'error': 'O driver não retornou JPEG compatível.'})
                self.reply(200, {'image': 'data:image/jpeg;base64,' + base64.b64encode(raw).decode('ascii')})
        except subprocess.TimeoutExpired:
            self.reply(504, {'error': 'Scanner excedeu o tempo de captura. Verifique o equipamento.'})
        except Exception:
            self.reply(503, {'error': 'Falha no conector local. Verifique o driver e tente novamente.'})
        finally:
            LOCK.release()

if __name__ == '__main__':
    print('Fama Scanner — scanner físico Windows/macOS/Linux. Feche com Ctrl+C.')
    print('Configure no NAPS2 um perfil chamado Fama com seu scanner. Windows também aceita WIA sem NAPS2.')
    print('Origem autorizada:', ORIGIN)
    print('Código temporário do conector:', TOKEN)
    server = ThreadingHTTPServer(('127.0.0.1', 17843), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
