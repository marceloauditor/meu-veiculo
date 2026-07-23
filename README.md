# Meu Veículo — PWA v5.1 RC2

Atualização de instalação no Android:
- manifesto PWA ampliado com identificação, descrição, idioma, orientação vertical e atalhos;
- botão “Instalar aplicativo” exibido quando o navegador disponibiliza a instalação;
- metadados para instalação no Android e iOS;
- service worker v5.0 com fallback de navegação offline e atualização segura dos arquivos principais;
- correção da versão interna do app, que ainda estava identificada como 4.8;
- nenhuma alteração no Firebase, Firestore, localStorage ou estrutura dos dados.

# Histórico da versão v4.10

Novos gráficos:
- consumo médio geral por ano (linha);
- custo geral diário por ano (linha);
- gastos mensais sem rótulos sobre as barras;
- evolução do hodômetro (linha);
- participação do custo diário anual (anel).

O indicador da tela inicial passou a se chamar “Distância percorrida entre os dois últimos abastecimentos”. Não houve alteração no Firebase nem na estrutura dos dados.

Correção do custo diário:
- no período selecionado, divide o custo líquido por todos os dias corridos entre a data inicial e a final, incluindo ambas as datas;
- exemplo: 01/01 a 31/01 corresponde a 31 dias;
- nenhuma alteração na estrutura de dados ou no Firebase.

Atualização visual profissional:
- interface escura em azul-marinho, com cartões e hierarquia visual aprimorada;
- valores dos gráficos em vermelho, sem contorno;
- ícones PNG para instalação, atalho, aba do navegador e tela inicial;
- foto do desenvolvedor reduzida na tela Sobre;
- preservação integral da estrutura de dados, Firebase e localStorage.

## Versão 3.14

- Indicadores de último consumo e última distância.
- Abastecimento por preço/litro + valor total, com litros calculados.
- Tipo inferido internamente pela categoria.
- Hodômetro atual iniciado pelo último hodômetro.
- Gráficos com rótulos adaptativos.

# Meu Veículo v3.14

Aplicativo PWA para controle de combustível, manutenção e despesas administrativas de veículos.

Desenvolvedor: Marcelo Ribeiro  
Criação: julho de 2026  
Contato: marcelo.auditortl@gmail.com


Atualização v3.13: foto do desenvolvedor na tela Sobre e menu “Lançar” abreviado para melhor visualização.

Atualização v3.13: relatório de custos por categoria com participação, valor, custo por km e custo por dia; total de gastos, receitas como dedução e custo líquido.
