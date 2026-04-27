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

- `solicitado`: pedido criado pelo usuario nivel 3.
- `separando`: reservado para evolucao futura.
- `pronto_retirar`: separado pelo usuario nivel 1 ou 2.
- `cancelado`: reservado para cancelamento futuro.

## Indice do Dashboard do Usuario

`usuariosSolicitacoes/{cpf}/{solicitacaoId}`

Guarda o resumo exibido no dashboard do solicitante, incluindo os itens para abrir o modal sem consultas extras.

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
