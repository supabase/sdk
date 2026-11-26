/** The only option the introspection passes to its SQL builders. */
export type SchemaFilterProps = {
  /**
   * An `IN (…)` or `NOT IN (…)` fragment from `filterByList`, or the empty
   * string for no filter.
   */
  schemaFilter: string;
};
