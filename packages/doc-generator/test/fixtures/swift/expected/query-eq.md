---
id: "query-eq"
kind: "method"
category: "Notes"
title: "eq"
symbol: "Notes.Query.eq(_:value:)"
summary: "Matches only notes where `column` equals `value`."
description: "Matches only notes where `column` equals `value`."
signature: "func eq(_ column: String, value: String) -> Query<Phase> where Phase: Filterable"
type_params:
  - "Phase"
stability: "stable"
deprecated: false
parameters:
  - name: "column"
    location: "argument"
    type: "String"
    required: true
    description: "The column to filter on."
  - name: "value"
    location: "argument"
    type: "String"
    required: true
    description: "The value to compare against."
returns:
  type: "Query<Phase>"
  description: "The same query, so calls can be chained."
throws: []
examples: []
---
