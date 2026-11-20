# Prévia óptica — 15.23.7

https://watersystem.online/previa-liquidglass

Protótipo independente em tema escuro e fundo sem imagem. Há lentes WebGL com refração, interação fluida e reflexos por liquidGL, e uma lente demonstrativa arrastável sobre conteúdo real. A alternativa sem GPU usa um campo de deslocamento SVG calculado a partir das normais de uma lente arredondada, com ampliação e espessura ajustável. A camada visual clonada é inert e aria-hidden, e não substitui os controles acessíveis da página.

O Liquid Glass nativo da Apple não é distribuído neste projeto: esta é uma implementação web independente. Créditos e licença MIT em NOTICE.md e LICENSE.liquidGL. Nenhum asset de demonstração de terceiros foi incluído.

O caminho público da prévia e seus recursos são interceptados pela extensão de três módulos `optical-preview-main/core/resources.mjs`, sobre `pricing-main.mjs`. O System preservou integralmente seus 137 módulos anteriores (SHA-256 `c52fde31b423b0d1646073763da2c06df54ec81180ac225698a82968e11cba35`); Control preservou seus 70 módulos (SHA-256 `91f8806f02fdc478705d3dcbacb29715c860966c67e45d7712d4c0162ba1c8cd`). Bindings 41/29 herdados. A página principal mantém a apresentação anterior; nenhum registro ou regra de cadastro pago foi alterado. A prévia usa valores demonstrativos atuais e encaminha a contratação ao checkout original.

## Publicação verificada

- System: versão Worker `de9665a0-fefa-44bd-ab5c-ed648b3a53f4`, deployment `3e32037e-5ef9-4494-ae7b-26236cfe1d7e`.
- Control: versão Worker `c1ed30b3-75d2-4828-aa42-de63eec13338`, deployment `36e5bafc-5dd9-4792-8928-c8412f7454bc`.

A primeira leitura imediatamente após os uploads retornou o erro transitório Cloudflare 10222. As publicações estavam ativas; nova leitura confirmou os três módulos adicionados e todos os hashes preservados. Não foi necessário republicar.

## Validação

`node --test features/liquid-preview/preview.test.mjs`: 3 testes aprovados. Sintaxe dos scripts aprovada. Navegador em produção: alternativa SVG, arraste, mudança real da refração sobre letras/números, controle de espessura, ciclo anual e links de checkout. O navegador de testes não disponibilizou WebGL; o caminho GPU não foi executado nesse ambiente. Não houve teste em telefone físico nem criação de cobrança. Layout responsivo implementado para tela estreita. Conteúdo da prévia não indexável; scripts locais e proteção CSP específica; nenhuma alteração na CSP dos demais caminhos.
