# Aplicativos Android de teste

O projeto gera dois aplicativos separados que abrem os sistemas em produção por HTTPS:
`online.watersystem.app` e `online.watersystem.control`. Eles precisam de internet.
As alterações do site aparecem automaticamente, sem atualizar o aplicativo.

Requisitos: JDK 17, Android SDK 35 e Gradle 8.11.1. Execute, nesta pasta,
`gradle :app:assembleSystemDebug :app:assembleControlDebug`. O workflow Android
gera e verifica os dois APKs de teste, assinados com a chave temporária de debug
do ambiente de compilação. Essa chave não é uma chave de distribuição: uma nova
compilação de teste pode exigir remover a anterior antes de instalar. Para uma
versão pública ou atualizações assinadas continuamente, configure uma chave de
assinatura privada e permanente fora do repositório.

## Preparação para versões assinadas

O Gradle aceita uma chave privada controlada pelo proprietário, fornecida ao
ambiente de compilação por estas quatro variáveis (preencha todas ou nenhuma):

- `WATER_ANDROID_KEYSTORE`: caminho absoluto do arquivo do keystore;
- `WATER_ANDROID_KEYSTORE_PASSWORD`: senha do keystore;
- `WATER_ANDROID_KEY_ALIAS`: alias da chave;
- `WATER_ANDROID_KEY_PASSWORD`: senha da chave.

Com as variáveis configuradas, execute `gradle :app:assembleSystemRelease
:app:assembleControlRelease :app:bundleSystemRelease :app:bundleControlRelease`.
Cada produto terá seu APK e seu pacote AAB assinados. Sem as variáveis, o Gradle
gera artefatos de release sem assinatura; não os distribua como instaláveis.
Guarde a chave e as senhas em um local seguro que o proprietário controle; não as
coloque no repositório, nos logs, nem em arquivos de configuração versionados.
Para permitir atualizações, preserve a mesma chave de assinatura para cada app
e aumente `versionCode` a cada distribuição. Uma instalação anterior assinada
com outra chave, incluindo os APKs de teste atuais, precisará ser removida antes
da primeira instalação da versão assinada de distribuição.

O workflow testa a assinatura de ambos os formatos com uma chave descartável,
gerada somente no ambiente de teste; ela nunca é publicada como artefato nem
serve para distribuição. A chave definitiva deve ser criada e guardada para o
proprietário antes de gerar uma versão destinada ao público.

Os apps incluem navegação externa, seleção de arquivos, permissões de câmera,
microfone e localização, e salvamento de downloads; valide estes fluxos, login,
verificação em duas etapas e impressão/arquivos em um aparelho real antes de
distribuí-los amplamente. Permissões dependem também das políticas do site e
da aprovação do usuário. Downloads `blob:` maiores que 15 MiB precisam de outro
fluxo de exportação.
