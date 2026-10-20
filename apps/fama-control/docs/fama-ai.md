# Fama IA interna

Veja [FAMA_IA.md](FAMA_IA.md) para a documentação atual. O núcleo próprio consulta os registros autorizados, prepara cadastros, calcula valores informados e organiza prioridades. O núcleo funciona sem API externa. O Workers AI pode acrescentar sugestões quando configurada no servidor.

Na central, **Voz e modelo local** prepara downloads separados para ditado e conversa. Os modelos abertos são executados no dispositivo, com perguntas e áudio mantidos localmente durante a inferência. O núcleo consulta o próprio servidor Fama para receber os dados autorizados. A transcrição deve ser revisada antes do envio. Cadastros e ações são confirmados nos formulários do sistema.

O Control administra nome, boas-vindas, funções disponíveis e respostas personalizadas. Essas preferências reduzem acesso e não concedem permissões a um usuário. A prévia usa dados de demonstração. Conversas são descartadas ao sair da tela ou trocar o escopo.
