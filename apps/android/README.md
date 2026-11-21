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

Os apps incluem navegação externa, seleção de arquivos, permissões de câmera,
microfone e localização, e salvamento de downloads; valide estes fluxos, login,
verificação em duas etapas e impressão/arquivos em um aparelho real antes de
distribuí-los amplamente. Permissões dependem também das políticas do site e
da aprovação do usuário. Downloads `blob:` maiores que 15 MiB precisam de outro
fluxo de exportação.
