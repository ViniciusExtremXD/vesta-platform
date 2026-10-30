# Vesta — site

> Documentação operacional em português, para uso interno. O site em si é 100% em
> inglês; nada deste arquivo é renderizado para o visitante.

Site da Vesta, com duas frentes sob a mesma marca:

- **Prática Azure (frente principal, apresentação do Vinícius):** administração de
  ambientes Microsoft Azure, redução de custos (FinOps), otimização de ambientes e
  excelência operacional. Toda contratação começa por uma revisão de custos gratuita e
  somente leitura (Reader + Cost Management Reader), lida contra os cinco pilares do Azure
  Well-Architected Framework. Nenhuma economia é prometida: é estimada na revisão e medida
  na própria fatura do cliente depois.
  - **Home (`/`)** é um hub curto: hero, quatro portas (uma por página) e o fecho.
  - **`/azure/`**: problema, serviços, a revisão (pilares) e o método.
  - **`/engagements/`**: as três formas de contratar, FAQ e fecho.
  - **`/about/`**: o Vinícius, e o currículo (seção "Track record", quando confirmado).
- **`/websites/` — estúdio de sites:** design e construção de sites e landing pages de alto
  padrão (o conteúdo que era a home até out/2026, intacto: pacotes, configurador, estudos).
  A Vesta **não** é gestora de tráfego pago.

Público: EUA e internacional, site 100% em inglês.

Direção de arte (definida pelo dono em 2026-09-22): **roxo, branco e preto; tema espaço /
astronomia** (galáxias, estrelas, órbitas — o nome vem do asteroide 4 Vesta). Nada de astrologia.
Visual executivo e refinado; o roxo é sólido, nunca gradiente/brilho em UI. A galáxia do hero é
WebGL próprio (`src/scripts/cosmos.ts`): só anima depois da primeira interação do visitante e
cai para um céu em CSS em renderização por software (Lighthouse/PageSpeed, VMs sem GPU).

---

## Rodar

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # gera dist/
npm run preview
```

No Git Bash, o build com base path (GitHub Pages) precisa de `MSYS_NO_PATHCONV=1`:

```bash
MSYS_NO_PATHCONV=1 BASE_PATH=/vesta-platform npm run build
```

`node_modules/`, `dist/`, `.astro/` e `.verify/` são junctions para
`C:\DevCache\mackenzie\...\vesta-platform\` — fora do OneDrive e de caminho curto.
Se um `npm install` substituir a junction de `node_modules` por pasta real, o build
quebra em `dist/.prerender` ("Cannot find package"). Mova a pasta de volta para o
DevCache e recrie a junction (`cmd /c mklink /J node_modules <destino>`).

---

## Verificação (obrigatória antes de entregar)

```bash
npm run build
npm run verify                        # todas as rotas, 1440 e 390, reduced-motion emulado
node scripts/verify.mjs --routes=/    # só a home
node scripts/verify.mjs --keep        # deixa o Chrome aberto
```

Falha se qualquer um for falso: zero elemento preso invisível; zero erro de console e
zero requisição quebrada; zero overflow horizontal; toda revelação disparou;
**cobertura de animação 100%** (elemento a elemento); **contraste AA** de todo texto,
resolvendo o fundo real; curva de entrada gradual medida quadro a quadro; **com
JavaScript desligado nada fica invisível**. Screenshots e `report.json` em `.verify/`.

Medir a própria velocidade (o hero exibe a nota, datada):

```bash
npm run build && npm run measure && npm run build
```

`scripts/measure.mjs` roda o Lighthouse local (emulação mobile, throttling simulado,
mediana de 3 execuções) e grava `src/data/measurements.json`. Com `performance: null`
o widget do hero não renderiza.

Imagens de Open Graph (`public/og/`): `npm run og`.

---

## Estrutura

```
src/
  data/site.ts           fonte única de todo texto e número. `confirmed: false` não renderiza
  data/measurements.json nota Lighthouse deste site, escrita por scripts/measure.mjs
  content/cases/         casos (Content Collection). Arquivo com "_" é rascunho e não builda
  layouts/Base.astro     <head>, SEO, JSON-LD, guarda de falha do motion
  styles/global.css      design system (void/night/starlight/violet/lilac) + contrato de movimento
  scripts/motion.ts      motor: revelações, um único loop de scroll (addFrame), magnético
  scripts/cosmos.ts      galáxia e céu estrelado (WebGL2, sem biblioteca)
  components/            Nav, Footer, StickyBar, Logo, Cosmos, ConceptPlate (+Before/Layers), Gauge, Odometer
  components/home/       uma seção por arquivo (Hero … Finale). Hero, SpecBand, Problem, Services,
                         Faq e Finale recebem os dados por props: padrão = estúdio de sites;
                         a home passa os dados `cloud*` de site.ts
  components/cloud/      seções só da prática Azure: CostPlate (palco do hero, ilustração),
                         Doors (as portas da home; uma porta só = "próxima página"),
                         Pillars (#review), Method, Engagements (`bare` sem cabeçalho),
                         Record (currículo, em /about/)
  components/work/       trabalho, estudo de conceito e template de caso
  components/ui/         SplitText, SectionLabel, Arrow, WaGlyph
  pages/                 index (hub), azure, engagements, websites (estúdio), about, contact,
                         work/, work/concept-NN, work/[slug], industries/[slug], privacy, 404
scripts/
  verify.mjs             gate de qualidade (1440/390/360/320, sem JS, contraste, vocabulário de IA)
  snap.mjs               captura de qualquer URL (seção, rolagem, quadros de animação)
  shoot.mjs              captura de página inteira
  measure.mjs            Lighthouse local → measurements.json
  gen-og.mjs             imagens OG · gen-portrait.mjs: retrato em P&B
```

## Regras que o código impõe

- **Nada invisível sem JS.** Reveals vivem em atributos `data-*`; o CSS falha aberto
  via `html.motion-failed`, `html.motion-reduced` e `<noscript>`.
- **Nenhum número sem origem.** Métricas de caso exigem `tool` e `measured`. As
  estatísticas de pesquisa na home têm fonte, ano e link. A nota de velocidade do
  próprio site vem de medição datada.
- **Nenhuma página de setor sem caso.** `getStaticPaths` filtra por casos confirmados.
- **`prefers-reduced-motion` do sistema é ignorado de propósito.** O controle é o
  botão no rodapé (`html.motion-reduced`, salvo em `localStorage` como `vesta-motion`).

## Transições entre páginas (ida e volta)

View Transitions entre documentos (`global.css` §11 + script inline no `<head>` do
`Base.astro`). **Ida** (porta, link para página mais funda): a página nova entra como uma
folha vinda da direita, com a borda lilás, e a anterior afunda no espaço. **Volta** (botão
voltar, logo, página mais rasa): a folha sai pela direita e a de baixo sobe. A porta clicada
e o cabeçalho da página de destino compartilham o nome `page-head`: o card cresce até virar
o cabeçalho e encolhe de volta na volta. Nav e barra fixa do mobile ficam paradas.

- Direção: `traverse` compara índices do histórico; o resto compara profundidade do caminho.
  Fica em `html[data-vt]` durante a transição.
- Todo cabeçalho de página tem `id="page-head"` + `data-vt-head`, e a página passa
  `expect="page-head"` ao `Base` (a home passa `expect="start"`, as portas): o primeiro render
  espera esse elemento, senão o morph não acha o par.
- Nome de transição é único por página: o script tira o nome do cabeçalho quando nomeia uma
  porta. Elemento que alarga a viewport no mobile (ex.: transform que vaza) **aborta** a
  transição ("Viewport size changed"): conter com `overflow-x: clip` na seção.
- Navegadores sem suporte simplesmente navegam. Motion desligado corta sem animação.

## Currículo (seção "Track record", em /about/)

`record` em `src/data/site.ts` guarda experiências e certificações. Tudo nasce com
`confirmed: false` e **nada renderiza** até haver ao menos um item confirmado — o site nunca
mostra histórico vazio ou inventado.

1. Para cada cargo do LinkedIn: preencha `role`, `company`, `period` ('2023–present') e
   `highlights` (resultados checáveis; número só com origem). `confirmed: true`.
2. Certificações já listadas (AZ-900, AZ-104, AZ-305, FinOps Certified Practitioner): marque
   `confirmed: true` só nas que existem, com `year` e `url` (link público do Microsoft Learn
   / Credly). Adicione outras no mesmo formato.

## Publicar um caso

1. Copie `src/content/cases/_example.md` para `<slug>.md`.
2. Preencha problema, solução, e cada métrica com ferramenta e data de medição.
3. Obtenha autorização escrita do cliente para nome e URL.
4. `confirmed: true`. A página `/work/<slug>/` e, se for o primeiro caso do setor, a
   página `/industries/<setor>/` passam a existir no próximo build.

## Deploy

GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`). Em domínio próprio:
definir a variável de repositório `SITE_URL` (ex.: `https://vesta.systems`), adicionar
`public/CNAME` e apontar o DNS. O `BASE_PATH` fica vazio automaticamente.
