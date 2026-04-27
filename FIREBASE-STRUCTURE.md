# Estrutura Firebase - JD Ferragens

## Produtos

`produtos/{produtoId}`

```json
{
  "codigo": "ABC123",
  "nome": "Parafuso",
  "quantidade": 10,
  "preco": 2.5,
  "descricao": "Opcional"
}
```

## Solicitacoes

`solicitacoes/{solicitacaoId}`

```json
{
  "id": "solicitacaoId",
  "solicitanteCpf": "00000000000",
  "solicitanteNome": "Nome do usuario",
  "status": "solicitado",
  "statusLabel": "Aguardando separacao",
  "itens": [
    {
      "produtoId": "produtoId",
      "codigo": "ABC123",
      "nome": "Parafuso",
      "quantidade": 2,
      "precoUnitario": 2.5,
      "subtotal": 5
    }
  ],
  "total": 5,
  "quantidadeItens": 2,
  "criadoEm": "2026-04-27T00:00:00.000Z",
  "atualizadoEm": "2026-04-27T00:00:00.000Z"
}
```

Status previstos:

- `solicitado`: pedido criado por usuario com acesso ao sistema.
- `separando`: vendedor/admin iniciou a separacao.
- `pronto_retirar`: separado pelo usuario nivel 1 ou 2.
- `cancelado`: solicitacao cancelada e itens devolvidos ao estoque.

Ao criar uma solicitacao, cada item e baixado de `produtos/{produtoId}/quantidade`.

Ao cancelar uma solicitacao com status `solicitado` ou `separando`, os itens voltam para `produtos/{produtoId}/quantidade`.

Campos adicionais usados no ciclo de separacao:

```json
{
  "separacaoIniciadaPorCpf": "11111111111",
  "separacaoIniciadaPorNome": "Vendedor",
  "separacaoIniciadaEm": "2026-04-27T00:00:00.000Z",
  "separadoPorCpf": "11111111111",
  "separadoPorNome": "Vendedor",
  "prontoEm": "2026-04-27T00:00:00.000Z",
  "canceladoPorCpf": "11111111111",
  "canceladoPorNome": "Vendedor",
  "canceladoEm": "2026-04-27T00:00:00.000Z"
}
```

## Indice do Dashboard do Usuario

`usuariosSolicitacoes/{cpf}/{solicitacaoId}`

Guarda o resumo exibido no dashboard do solicitante, incluindo os itens para abrir o modal sem consultas extras.

O solicitante so pode cancelar enquanto `status === "solicitado"`. Depois que entra em `separando`, apenas vendedor/admin cancela pela tela `solicitacoes`.

## Pedidos Separados Para o PDV

`pdvPedidosSeparados/{solicitacaoId}`

Criado quando o usuario nivel 1 ou 2 clica em `Pronto`.

```json
{
  "id": "solicitacaoId",
  "solicitacaoId": "solicitacaoId",
  "solicitanteCpf": "00000000000",
  "solicitanteNome": "Nome do usuario",
  "itens": [],
  "total": 5,
  "quantidadeItens": 2,
  "status": "aguardando_pagamento",
  "origem": "solicitacao_separada",
  "separadoPorCpf": "11111111111",
  "separadoPorNome": "Operador",
  "criadoEm": "2026-04-27T00:00:00.000Z",
  "atualizadoEm": "2026-04-27T00:00:00.000Z"
}
```

O PDV futuro deve listar este no filtrando `status === "aguardando_pagamento"`.
