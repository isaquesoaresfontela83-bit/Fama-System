# Créditos e origem

A prévia usa liquidGL v3.0.0, © NaughtyDuk, licença MIT. Código fonte: https://github.com/naughtyduk/liquidGL . Commit consultado: `88f681ab7035fd55b04f63edff1841e32c4199e9`. O arquivo LICENSE.liquidGL acompanha esta distribuição. Nenhuma imagem, fonte ou outro asset da demonstração do autor foi utilizado.

O renderer oferece WebGPU/WebGL e amostragem do conteúdo DOM. Nesta prévia, a cadeia inicia no WebGL2 e admite WebGL1. Em navegadores sem GPU é utilizada a implementação própria `software-glass.js`, que calcula um campo de deslocamento a partir das normais de uma lente com cantos arredondados e refrata uma cópia visual do conteúdo por SVG feDisplacementMap. O conteúdo interativo original permanece no DOM acessível; a cópia da lente é inert e aria-hidden.

Liquid Glass é uma tecnologia e linguagem visual da Apple. Esta é uma implementação web independente inspirada nas propriedades ópticas do material, sem alegação de usar o componente nativo da Apple.
