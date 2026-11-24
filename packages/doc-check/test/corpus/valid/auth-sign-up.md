---
id: "auth-sign-up"
kind: "method"
category: "auth"
title: "signUp"
symbol: "Auth.AuthClient.signUp(email:password:options:)"
summary: "Creates a user with an email address and a password."
description: |-
  Creates a user with an email address and a password.

  When email confirmation is off, the user is signed in at once.
signature: "func signUp(email: String, password: String, options: SignUpOptions = .init()) async throws -> SignUpResult"
stability: "stable"
deprecated: false
parameters:
  - name: "email"
    location: "argument"
    type: "String"
    required: true
    description: "The user's email address."
  - name: "options"
    location: "argument"
    type: "SignUpOptions"
    required: false
    description: "The user metadata and redirect URL."
    default: ".init()"
    children:
      - name: "redirectTo"
        location: "property"
        type: "URL?"
        required: false
        description: "Where the confirmation link sends the user."
returns:
  type: "SignUpResult"
  description: "The new session, or the user to confirm."
throws:
  - type: "AuthError"
    description: "When the request fails."
examples:
  - id: "example-1"
    title: "Example 1"
    lang: "swift"
    code: |
      let result = try await client.auth.signUp(
        email: "user@example.com",
        password: "secret"
      )
---

Other signatures:

```swift
func signUp(phone: String, password: String, options: SignUpOptions = .init()) async throws -> SignUpResult
```
