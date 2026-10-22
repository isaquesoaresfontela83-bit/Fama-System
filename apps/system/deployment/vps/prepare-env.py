"""Create private configuration placeholders once, without printing secrets."""
from pathlib import Path
import os
import secrets

directory = Path(__file__).resolve().parent
for name in ['.env', 'system.env', 'control.env']:
    path = directory / name
    if path.exists():
        print(f'{name}: configuração existente preservada.')
        continue
    lines = (directory / (name + '.example')).read_text().splitlines()
    result = []
    for line in lines:
        if line.endswith('=GENERATE'):
            line = line.removesuffix('GENERATE') + secrets.token_hex(32)
        result.append(line)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        stream.write('\n'.join(result) + '\n')
    print(f'{name}: criado com acesso privado. Preencha as configurações atuais antes de instalar.')
