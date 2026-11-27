/**
 * The inputs are wrong in a way the person running the generator can fix: a
 * bad config, tool output that cannot be read, two functions with one id.
 * `problems` lists every instance, so one run shows them all.
 */
export class GeneratorError extends Error {
  readonly problems: readonly string[];

  constructor(message: string, problems: readonly string[] = []) {
    super(
      problems.length === 0
        ? message
        : `${message}\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
    this.name = "GeneratorError";
    this.problems = problems;
  }
}
