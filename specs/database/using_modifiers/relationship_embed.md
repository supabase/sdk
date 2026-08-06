# Embed Related Rows

Select columns from a related table within the same query, using PostgREST's resource embedding (spread) notation, instead of issuing a separate request per relationship.

## Behavior

A related table is named as a nested selection: `select("*, related_table(col1, col2)")`. The server resolves the relationship via the database's foreign keys and returns the related rows nested under the relationship name in each result row.

- **Join direction:** by default PostgREST infers whether the embed is a to-one or to-many relationship from the foreign key direction and shapes the nested result accordingly (object vs. array). This can be made explicit with `!inner` (inner join — parent rows with no match are excluded) or `!left` (left join — parent rows are kept with a `null`/empty nested result).
- **Ambiguous relationships:** when more than one foreign key path connects two tables, the relationship must be disambiguated by naming the constraint or a hint, e.g. `related_table!fk_name(...)`.
- **Aliasing:** an embed can be renamed in the result with `alias:related_table(...)`, and the same relationship can be embedded more than once under different aliases (e.g. to apply different filters to each).
- **Nesting:** embeds can be chained arbitrarily deep — a related table's own related tables can be embedded within it, subject to the server's configured embedding depth limit.

Filters, ordering, and column selection modifiers can be applied within a nested embed's own selection, scoped to that relationship only (they do not affect the parent selection).

## Prerequisites

The embedded relationship must be backed by an actual foreign key (or a PostgREST-configured view/computed relationship) that PostgREST can discover; there is no way to embed an arbitrary unrelated table.

## Notes

- Embedding does not change how many top-level rows are returned — it only nests additional data onto each one (except with `!inner`, which can reduce the top-level row count).
- Deeply nested or high-fanout embeds can be significantly more expensive than the equivalent client-side joins across separate queries; this capability does not impose or guarantee any particular performance characteristic.

## Related

- [Query Table or View](database.query.from_table)
- [Select Rows](database.query.select)
