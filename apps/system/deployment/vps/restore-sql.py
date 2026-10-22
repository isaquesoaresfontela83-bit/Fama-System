"""Import an owner-supplied SQL backup into a new file; never overwrite a live DB."""
import os
from pathlib import Path
import sqlite3
import sys
import tempfile

source, destination = map(Path, sys.argv[1:3])
if destination.exists():
    raise SystemExit('O banco de destino já existe. Escolha um arquivo novo.')
destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
descriptor, temporary = tempfile.mkstemp(prefix='.restore-', suffix='.sqlite', dir=destination.parent)
os.close(descriptor)
try:
    connection = sqlite3.connect(temporary)
    connection.set_authorizer(lambda action, one, two, _database, _context:
        sqlite3.SQLITE_DENY if action in {sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH}
        or (action == sqlite3.SQLITE_FUNCTION and str(two).lower() in {'load_extension', 'readfile', 'writefile'})
        else sqlite3.SQLITE_OK)
    connection.executescript(source.read_text(encoding='utf-8'))
    if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise ValueError('O backup não passou pela verificação de integridade.')
    if connection.execute('PRAGMA foreign_key_check').fetchall():
        raise ValueError('O backup contém referências inválidas.')
    connection.close()
    os.chmod(temporary, 0o600)
    # Hard-link publication is atomic and fails if another process creates the destination.
    os.link(temporary, destination)
    print('Backup importado em um arquivo novo; integridade e referências verificadas.')
finally:
    Path(temporary).unlink(missing_ok=True)
