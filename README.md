# Rota 10A · by ForumSCP

Guia estático de restaurantes, preparado para publicação no GitHub Pages.

## Estrutura

- `index.html` — apresentação e estrutura da aplicação.
- `src/app.js` — lógica da aplicação.
- `data/restaurantes.json` — base editorial de restaurantes.
- `data/taxonomia.json` — vocabulário controlado usado pelos atributos editoriais.
- `scripts/validate-data.js` — validação local da base.

## Desenvolvimento local

Não abrir `index.html` diretamente do disco, porque a aplicação carrega o JSON por `fetch`. Use um servidor HTTP local, por exemplo:

```bash
python3 -m http.server 8000
```

Depois abrir `http://localhost:8000/`.

## Validar dados

```bash
node scripts/validate-data.js
```

## GitHub Pages

O conteúdo deste diretório pode ser publicado diretamente como site estático. A aplicação lê `data/restaurantes.json` em runtime.

## Publicação automática

O workflow `.github/workflows/pages.yml` publica a raiz do repositório no GitHub Pages sempre que há push para `main`. No GitHub, ativa **Settings → Pages → GitHub Actions** se ainda não estiver ativo.


## Editor de dados

Existe um editor administrativo local em `editor/index.html`. Ele permite carregar `data/restaurantes.json`, pesquisar, adicionar, editar, duplicar, encerrar ou eliminar registos e exportar uma nova versão do JSON.

O editor não é publicado como parte da aplicação pública e não contém credenciais. Os atributos estruturados são editáveis no próprio formulário e são validados antes da exportação. Depois de exportar, substituir o ficheiro em `data/restaurantes.json`, executar `npm run validate` e fazer commit.

Para usar através de um servidor local: `npm run editor` e abrir `http://localhost:8080/editor/`.

## Memória pessoal do utilizador · fase 1

A aplicação mantém um perfil anónimo local em `localStorage`, separado da base editorial.

- `src/profile.js` — memória e sinais pessoais.
- O perfil regista apenas interações úteis para recomendação.
- A base `data/restaurantes.json` continua global e não recebe dados pessoais.
- Nesta fase não há contas nem sincronização entre dispositivos.

Sinais actualmente usados:

- `decide` — pedido de recomendação.
- `another_suggestion` — pedido de alternativa.
- `liked` / `disliked` — opinião explícita sobre uma casa.
- `favorite_added` / `favorite_removed` — sinal derivado do favorito.

As opiniões explícitas e os favoritos alimentam preferências internas sobre cozinhas, ambientes, ocasiões, tipos de casa e preço. O modelo é deliberadamente pequeno nesta primeira fase.

## Decide por mim · fase 2

A recomendação combina duas coisas distintas:

1. **vontade actual** — o que a pessoa pede nesta sessão;
2. **preferência acumulada** — sinais positivos e negativos recolhidos pelo perfil pessoal.

A preferência pessoal tem agora peso próprio no ranking. Uma casa explicitamente marcada como “Não gostei” deixa de voltar a ser recomendada. “Outra sugestão” exclui a casa actual e recalcula a recomendação, em vez de apenas mostrar uma alternativa fixa.

O feedback “Gostei / Não gostei” é reversível e o estado apresentado na ficha corresponde à última opinião explícita.

## V19 · Compacta

A interface foi reorganizada para ecrãs de portátil de 13" e outros ecrãs com pouca altura disponível, sem alterar a base editorial ou o motor de personalização.

Principais alterações:
- cabeçalho mais baixo;
- título duplicado removido da zona principal;
- pesquisa e localização organizadas num bloco compacto;
- GPS integrado na linha da localização;
- mensagens auxiliares de localização deixam de ocupar espaço permanente;
- “Decide por mim” mantém-se como acção principal;
- apresentação inicial (“Boa mesa. Boas escolhas.”) reduzida a um bloco compacto;
- cartões desktop mantêm duas colunas, mas ficam mais baixos e densos;
- a informação secundária continua disponível na ficha completa.

## Decide por mim · fase 3

A preferência pessoal passa a combinar opinião explícita com comportamento repetido.

- “Gostei” e “Não gostei” são sinais fortes e reversíveis.
- Guardar um restaurante é um sinal positivo mais fraco do que um “Gostei”.
- “Outra sugestão” é apenas um sinal comportamental fraco.
- A app só começa a inferir uma rejeição de uma característica depois de pelo menos 3 restaurantes diferentes com essa característica terem sido rejeitados através de “Outra sugestão”.
- As preferências derivadas são recalculadas a partir do histórico, em vez de depender apenas de alterações permanentes de pesos. Isto torna o comportamento mais explicável e reversível.

O perfil continua exclusivamente local (`localStorage`) nesta fase.

## Decide por mim · fase 3

O comportamento foi separado em três sinais:

- `suggestion_requested`: pedir outra sugestão é exploração e não é interpretado como rejeição;
- `alternative_chosen`: quando a pessoa escolhe explicitamente uma alternativa, a app aprende que essa alternativa tinha valor acrescentado face à primeira;
- `liked` / `disliked`: continuam a ser as opiniões explícitas e mais fortes.

Nas comparações entre restaurantes, a aprendizagem só atribui evidência positiva a características que a alternativa escolhida tem e a primeira não tinha. A primeira opção não recebe uma penalização automática.

## Personal v4 · exploração, escolha e opinião

O perfil pessoal distingue agora quatro tipos de sinal:

- **Exploração** — abrir fichas, pedir outra sugestão, experimentar filtros ou navegar não altera preferências.
- **Escolha relativa** — seleccionar uma alternativa pode fornecer evidência positiva sobre características que diferenciam a opção escolhida da anterior; uma ocorrência isolada não altera o perfil.
- **Opinião explícita** — “Gostei” / “Não gostei” é o sinal mais forte.
- **Contexto** — os eventos de decisão guardam o contexto da sessão (por exemplo, os desejos escolhidos no “Decide por mim”), sem o confundir com uma preferência permanente.

A aprendizagem é deliberadamente lenta: a app procura padrões repetidos, em vez de transformar uma exploração ocasional numa conclusão sobre o utilizador.

## Decide por mim · Personal V5

O ranking passou a usar a preferência pessoal de forma dependente da evidência. O pedido actual (por exemplo, peixe ou petiscos), proximidade e qualidade editorial continuam a ter prioridade. A preferência aprendida só ganha peso proporcionalmente à confiança acumulada.

Assim, o histórico não funciona como uma classificação global dos restaurantes: serve para desempatar e ordenar melhor as opções que já respondem ao que o utilizador pediu.


## Decide por mim · fase 6

A recomendação passa a guardar uma explicação interna simples: correspondência com o pedido actual, proximidade e, quando existe evidência suficiente, características que já demonstraram afinidade com o utilizador. Esta explicação serve para tornar o ranking testável e afinável; não é apresentada como uma pontuação ao utilizador.


## Decide por mim · fase 8

O perfil pessoal passa a distinguir preferência geral de preferência dependente do contexto. Uma opinião explícita dada depois de uma decisão no “Decide por mim” pode reforçar uma característica naquele contexto (por exemplo, quando o utilizador pediu peixe), sem transformar automaticamente essa preferência numa regra global. O contexto tem peso moderado e só entra quando existe evidência explícita.

## Personal V10 · testes de comportamento

A versão inclui uma pequena suíte de testes do perfil pessoal. Ela verifica explicitamente que exploração não altera preferências, que uma escolha relativa isolada não basta, que escolhas repetidas geram apenas evidência fraca, e que opiniões explícitas têm precedência.

Executar:

```bash
npm run test:profile
```


## Personal V11 · perfis de teste

A versão acrescenta cenários controlados para verificar o comportamento do motor de preferência sem depender da interface. Os testes também verificam que duas opiniões contextuais ainda não saturam a confiança do perfil. São usados quatro perfis: explorador, tradicional, preferência contextual por peixe/casual e utilizador que escolhe repetidamente uma alternativa.

Os testes verificam que:
- exploração continua neutra;
- opiniões explícitas conseguem separar preferências positivas e negativas;
- preferências contextuais podem alterar a ordem no contexto correspondente;
- escolhas relativas repetidas criam apenas evidência fraca;
- perfis diferentes produzem ordens diferentes.

Executar:

```bash
npm run test:scenarios
```

## V12 · Arena de teste do ranking pessoal

A V12 acrescenta `scripts/test-real-ranking.js`, que executa cenários com os 318 restaurantes reais e quatro perfis fictícios: explorador, tradicional, peixe/casual e contemporâneo.

O teste compara pedidos `Tanto faz`, `Peixe`, `Petiscos`, `Contemporâneo` e `Clássico` e guarda o relatório completo em `scripts/real-ranking-report.json`.

Resultado do ensaio: 14 combinações perfil/pedido produziram um top-10 diferente do perfil explorador. Isto confirma que a personalização já altera o ranking real, mas também mostra que a intensidade deve continuar a ser calibrada antes de considerarmos o motor final.

## V13 · Calibração da confiança pessoal

A V13 não acrescenta novas funcionalidades ao utilizador. Corrige a calibração interna do perfil:

- uma opinião sobre uma casa conta como **uma evidência**, mesmo que a casa tenha muitos atributos;
- repetir a mesma opinião sobre a mesma casa não aumenta artificialmente a confiança;
- `Gostei` e `Não gostei` aumentam a confiança da mesma forma — muda o sinal, não a certeza;
- escolhas relativas continuam a valer menos do que opiniões explícitas;
- a influência máxima do histórico pessoal mantém-se em 20% do ranking.

`test-calibration.js` testa 0, 1, 2, 3, 5 e 10 evidências independentes com restaurantes reais e confirma que a confiança evolui 0 → 0,1 → 0,2 → 0,3 → 0,5 → 1.

## V14 · Ensaio com perfis humanos plausíveis

A V14 acrescenta `scripts/test-human-profiles.js`, usando os 318 restaurantes reais para testar cinco comportamentos que devem manter-se estáveis:

- exploração sem opinião não altera o perfil;
- um perfil tradicional passa a favorecer casas clássicas depois de opiniões explícitas em restaurantes distintos;
- uma preferência de peixe expressa no contexto "peixe" reforça esse contexto sem se tornar automaticamente uma preferência universal;
- uma mudança posterior de opinião substitui a opinião anterior;
- escolher alternativas repetidamente produz apenas evidência fraca e nunca transforma as primeiras opções em rejeições.

Resultado: 5/5 verificações OK. Este ensaio não altera o algoritmo; serve como teste de comportamento antes de acrescentar novas regras ao motor.

## V15 · Teste de situações reais de uso

A V15 acrescenta `scripts/test-use-cases.js`, uma bateria de 10 situações de utilização do «Decide por mim». O objectivo não é medir uma pontuação, mas verificar invariantes editoriais: o pedido actual continua a mandar; exploração não ensina; «Não gostei» exclui a casa; «Outra sugestão» não é rejeição; escolhas relativas são fracas; contexto não se universaliza; e favoritos não substituem opinião explícita.

Resultado: 10/10 situações passaram com os 318 restaurantes reais. O relatório fica em `scripts/use-cases-report.json`.


## V16 · Aprendizagem sem formulário

A V16 transforma o feedback numa pequena conversa depois de uma recomendação do «Decide por mim». Em vez de apresentar um formulário ou pedir várias características, a aplicação pergunta simplesmente «Acertei?». «Gostei» e «Não gostei» continuam a ser os únicos sinais explícitos fortes. Depois da resposta, mostra uma confirmação curta e explica implicitamente que a resposta será usada nas próximas escolhas.

A exploração normal continua neutra: abrir fichas, pesquisar e pedir alternativas não cria preferência.

## V17 · Tratamento visual

A V17 mantém o motor de recomendação, a memória pessoal e a base de dados sem alterações funcionais. Foi aplicado apenas um tratamento visual da interface, com o objectivo de dar à Rota 10A uma linguagem mais sofisticada, limpa e coerente.

Principais alterações visuais:
- identidade `Rota 10A` no cabeçalho;
- paleta verde profundo, marfim e dourado mantida como base;
- cabeçalho, pesquisa e «Decide por mim» refinados;
- separadores e cartões com hierarquia visual mais discreta;
- área de filtros organizada num bloco visual único;
- nomenclatura da aplicação ajustada de «sítios» para «restaurantes»;
- tipografia, espaçamento, bordas e sombras refinados;
- sem alteração da lógica de recomendação ou aprendizagem.

Esta é uma evolução **visual da V17**, não uma nova versão do motor.

## V17 · Pronto para piloto

A V17 não acrescenta uma nova regra de aprendizagem. Acrescenta apenas um teste de prontidão para evitar continuar a afinar o motor sem necessidade.

`test-pilot.js` verifica a integridade dos testes de comportamento, calibração, perfis humanos, cenários reais e ranking com os 318 restaurantes. O resultado fica em `scripts/pilot-readiness-report.json`.

A decisão de produto nesta fase é deliberada: **o motor fica congelado durante o piloto**. Primeiro recolhem-se utilizações reais; só depois se altera uma regra se houver evidência de que o comportamento está errado.

Executar tudo com:

```bash
npm run test:all
```
