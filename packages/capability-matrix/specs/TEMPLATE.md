# Feature Name

<!-- File naming: specs/{area}/{group_namespace}/{method_stem}.md, mirroring the three
     segments of the feature id, e.g. auth.mfa.challenge → specs/auth/mfa/challenge.md.
     The validator and the site only see files at that depth, and only when the id exists
     in capabilities/{area}.yaml.

     This file is optional. Structured metadata (id, name, description, group) lives in
     capabilities/{area}.yaml, and for most features that is all an implementer needs.

     This file is additive. The API spec linked below is the source of truth for the wire:
     paths, request and response shapes, status codes, and error codes. This file adds only
     what an implementer cannot get from the API spec: what the SDK layer does between the
     app and the wire, and what would surprise someone who has read the API spec and
     nothing else. If a sentence restates the API spec, delete it and link.

     Before opening a PR, apply the removal test: delete every sentence an implementer could
     reconstruct from the linked API spec. If only the API section is left, the feature does
     not need a spec file. -->

## API

<!-- Link the canonical API spec and list the operations this feature maps to. For /token
     variants, note the grant_type discriminator. Remove this section if the feature makes
     no HTTP call.

     When the API spec is wrong or incomplete for an operation, say so in one line and link
     the handler in the service's source. Do not describe the wire here. Fix the API spec
     upstream, then delete the pointer. -->

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `METHOD /path`

## Behavior

<!-- Required. What the SDK layer adds, in SDK-neutral terms. Typical content:
     - defaults the SDK fills in, such as the current session's access token
     - state the SDK keeps or changes, such as the stored session or a key cache
     - validation worth doing before the wire, such as id shape or "nothing to update"
     - how SDKs conventionally reshape the response
     - what must happen before or after this call, across capabilities
     - partial-update rules the SDK's request type has to preserve, such as absent
       versus empty
     - server behavior that surprises: a silent no-op, a status code that differs from
       the API spec, a filter the API spec does not list
     - trade-offs an implementer should weigh, such as a network round trip on every call

     Not here: field-by-field request or response descriptions, status code tables, error
     code catalogs, what the service does internally, or language-specific function
     signatures. Implementations vary across SDKs. -->

## Prerequisites

<!-- Optional. State or configuration that must be true before the call, when the API spec
     does not make it obvious. Remove this section if there is none. -->

## Errors

<!-- Optional. Only errors the API spec does not cover or that the SDK treats specially:
     client-side validation errors, errors an SDK maps or retries. Link the API spec for
     the rest. Remove this section if there are none. -->

- `error_code`: when the SDK sees it and what it does with it

## Notes

<!-- Optional. Only what fits none of the sections above. The usual case is a platform
     constraint, worded so a maintainer can tell when `not_applicable` is the right
     compliance status. Remove this section if there is none. -->

## Related

<!-- Optional. Link related capabilities by relative path when they have a spec file.
     Otherwise name them in plain text with their id. A bare id is not a link target and
     renders as a broken link. Remove this section if there are none. -->

- [Feature Name](../<group_namespace>/<method_stem>.md): why it is related
- Feature Name (`area.group.method`): why it is related
