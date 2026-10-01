from pathlib import Path
import subprocess, zipfile, hashlib, json

root = Path(__file__).resolve().parent.parent
subprocess.run(['node', 'scripts/verify-repository.mjs'], cwd=root, check=True)
status = subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True).strip()
if status:
    raise SystemExit('Faça commit das alterações antes de gerar a entrega.')
files = [item for item in subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0') if item]
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
directory = root / 'artifacts'
directory.mkdir(exist_ok=True)
output = directory / f'fama-platform-{commit[:12]}.zip'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for rel in files:
        archive.write(root / rel, arcname='fama-platform/' + rel)
    archive.writestr('fama-platform/EXPORT.json', json.dumps({'commit_sha': commit, 'tracked_files': len(files), 'git_configuration_exported': False}, indent=2) + '\n')
with zipfile.ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Falha na integridade do ZIP.')
digest = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix('.zip.sha256').write_text(digest + '  ' + output.name + '\n')
print(str(output))
