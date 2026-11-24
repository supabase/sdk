---
id: "notes-client-run-all"
kind: "method"
category: "notes"
title: "run_all"
symbol: "notes.client.run_all"
summary: "Calls `callback` once for each value."
description: "Calls `callback` once for each value."
signature: "def run_all[*Ts, **P](callback: Callable[P, None], *values: *Ts) -> None"
type_params:
  - "Ts"
  - "P"
stability: "stable"
deprecated: false
parameters:
  - name: "callback"
    location: "argument"
    type: "Callable[P, None]"
    required: true
  - name: "values"
    location: "argument"
    type: "*Ts"
    required: false
    variadic: true
throws: []
examples: []
---
