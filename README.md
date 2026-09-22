# Vesta — site

> Documentação operacional em português, para uso interno. O site em si é 100% em
> inglês; nada deste arquivo é renderizado para o visitante.

Site do estúdio Vesta: sites e landing pages para negócios fora do Brasil
(principalmente EUA) que compram tráfego pago. Astro estático, CSS puro com design
system próprio, zero framework de UI no cliente, zero script de terceiro até o
visitante pedir o agendador.

Posicionamento: a **home filtra por situação do comprador** (paga tráfego e a página
não converte; site velho perdendo para o concorrente; precisa de uma página para uma
campanha). **Setor só em página interna**, e uma página de setor só existe quando há
pelo menos um caso real publicado — a rota `industries/[slug]` se recusa a construir
sem caso.

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
  content.config.ts      schema do caso: todo número exige ferramenta + data
  layouts/Base.astro     <head>, SEO, JSON-LD, guarda de falha do motion
  components/            Nav, Footer, Logo, Icon, Clocks (fusos ao vivo)
  components/home/       um arquivo por seção da home
  scripts/motion.ts      motor de movimento (portado da CloudMotion)
  scripts/particles.ts   malha de partículas do hero (pointer: fine, pausa fora da tela)
  scripts/tilt.ts        tilt 3D inercial nos cards
  scripts/clocks.ts      relógios São Paulo / NY / Dallas / LA + status do expediente
  scripts/calculator.ts  calculadora de desperdício (modelo e fontes impressos na página)
  scripts/booking.ts     Calendly sob demanda (só carrega ao clicar)
  styles/global.css      design system inteiro + contrato de movimento
  pages/                 index, about, contact, work/, work/[slug], industries/[slug], privacy, 404
scripts/
  verify.mjs             pipeline de verificação (puppeteer-core + Chrome instalado)
  shoot.mjs              captura de página inteira
  measure.mjs            Lighthouse local → measurements.json
  gen-og.mjs             imagens OG renderizadas no Chrome
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
