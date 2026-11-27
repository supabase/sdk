---
id: "array-decode"
kind: "method"
category: "Notes"
title: "decode"
symbol: "Swift.Array.decode(as:decoder:)"
summary: "Decodes every note into another type."
description: "Decodes every note into another type."
signature: "func decode<T>(as type: T.Type = T.self, decoder: JSONDecoder? = nil) throws -> [T] where T: Decodable, Element == Note"
type_params:
  - "Element"
  - "T"
stability: "stable"
deprecated: false
parameters:
  - name: "as"
    location: "argument"
    type: "T.Type"
    required: false
    description: "The type to decode each note into."
    default: "T.self"
  - name: "decoder"
    location: "argument"
    type: "JSONDecoder?"
    required: false
    description: "The decoder to use. When `nil`, `Foundation.JSONDecoder.notes()`."
    default: "nil"
returns:
  type: "[T]"
  description: "One value for each note."
throws:
  - description: "The decoding error of the first note that does not fit `type`."
examples: []
---
