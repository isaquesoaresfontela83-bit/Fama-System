import { cp, mkdir } from 'node:fs/promises';

for (const [source, destination] of [
    ['public', '.next/standalone/public'],
    ['.next/static', '.next/standalone/.next/static'],
    ['server', '.next/standalone/server'],
    ['drizzle', '.next/standalone/drizzle'],
]) {
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { recursive: true });
}
console.log('Pacote standalone pronto para execução sem o executor de desenvolvimento.');
