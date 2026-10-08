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

     This file is normative. It states what an SDK does, in the present tense, for every
     SDK at once. It never names an SDK or describes what any SDK does today: that is a
     snapshot, it rots the day one SDK changes, and it tells an implementer nothing about
     what to build. Kinds of SDK are fine ("SDKs that hold a session"), instances are not
     ("supabase-js"). When a named SDK diverges from this file, open an issue in that SDK's
     repository citing this file, and leave this file alone.

     Every sentence is precise enough that two implementers would build the same thing.
     Name the input, the exact server answer (HTTP status, error_code, and the message when
     it carries meaning), the form a check accepts, and the body a response carries.
     "Malformed", "invalid", "clear", "appropriate", and "handles" are the signs of a
     sentence that names none of those.

     The service's behavior is not this file's subject. A sentence about the service earns
     its place only as the premise of what the SDK does, in the same sentence as the
     obligation: "the body is an empty object, so the SDK returns nothing". What the service
     does beyond that is linked, never described: the guide on supabase.com/docs when one
     covers it, otherwise the handler. An SDK implementer who wants to know what a delete
     removes reads the guide, not this file.

     Before opening a PR, apply four tests to every sentence:
     1. Removal: delete it if an implementer could reconstruct it from the linked API spec.
        If only the API section is left, the feature does not need a spec file.
     2. Snapshot: delete it if it names an SDK or describes what SDKs do today. If it
        described a divergence, that becomes an issue in the SDK's repository instead.
     3. Precision: rewrite it if two implementers could read it and build different things.
     4. Service: delete it if it describes the service and removing it changes nothing
        about what the SDK does. If a reader would still need the fact, link the guide or
        the handler in its place.
     Then search specs/ for the same wording in sibling files: specs copy from each other,
     and a fix to one is a fix to all of them. -->

## API

<!-- Link the canonical API spec and list the operations this feature maps to. For /token
     variants, note the grant_type discriminator. Remove this section if the feature makes
     no HTTP call.

     When the API spec is wrong or incomplete for an operation, say so in one line, as a
     fact, and link the handler in the service's source. Do not describe the wire here. Put
     the condition that retires the line in an HTML comment directly below it, of the form
     "Delete the paragraph above once <service>#<issue> corrects the entry:" followed by the
     issue URL, so the reader sees a fact and the next editor sees when to delete it. Never
     write the condition into the prose ("until it is corrected"): it is noise to the reader
     and it undermines the sentence it hangs off. Fix the API spec upstream, then delete
     the line and its comment together. -->

Spec: [https://github.com/supabase/auth/blob/master/openapi.yaml](https://github.com/supabase/auth/blob/master/openapi.yaml)

- `METHOD /path`

## Behavior

<!-- Required. What the SDK layer adds, in SDK-neutral terms. Typical content:
     - defaults the SDK fills in, such as the current session's access token
     - state the SDK keeps or changes, such as the stored session or a key cache
     - how the SDK reshapes the response
     - what must happen before or after this call, across capabilities
     - partial-update rules the SDK's request type has to preserve, such as absent
       versus empty
     - server behavior the SDK has to handle and the API spec does not show: a status
       code that differs from the API spec, a filter the API spec does not list, a silent
       no-op the SDK may pre-empt
     - trade-offs an implementer should weigh, such as a network round trip on every call

     A check the SDK makes before the wire is defined under Errors, not here.

     Not here: field-by-field request or response descriptions, status code tables, error
     code catalogs, what the service does beyond the premise of an SDK obligation,
     language-specific function signatures, or what any named SDK does today. -->

## Prerequisites

<!-- Optional. State or configuration that must be true before the call, when the API spec
     does not make it obvious. Remove this section if there is none. -->

## Errors

<!-- Optional. Only errors the API spec does not cover or that the SDK treats specially:
     checks the SDK makes before the wire, errors it maps or retries. Link the API spec for
     the rest. A check before the wire states the input it applies to, the form it accepts,
     the error the SDK raises (its own argument error, never the server error type), and
     the server answer it pre-empts, with status and error_code, so a reader knows what the
     check saves them from. Remove this section if there are none. -->

- `error_code`: when the SDK sees it and what it does with it
- A check before the wire: the input, the form it accepts, the error raised, and the server answer it pre-empts

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
