// Formats staged files with oxfmt and stages the result. Run by pre-commit,
// which picks the runtime (Node or bun) and passes the oxfmt launcher path.
//
// Paths come from git NUL-delimited and are passed on as argument arrays,
// never through a shell, so names with spaces, glob characters or non-ASCII
// characters reach oxfmt and git exactly as staged.
import { spawnSync } from "node:child_process";

const oxfmt = process.argv[2];

function git(...args) {
  const result = spawnSync("git", ["--literal-pathspecs", ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function paths(output) {
  return output.split("\0").filter(Boolean);
}

// `./` keeps oxfmt from reading a name that starts with `-` as an option, or
// one that starts with `!` as an exclude pattern.
function runOxfmt(args, files, stdout) {
  const result = spawnSync(
    process.execPath,
    [
      oxfmt,
      "--no-error-on-unmatched-pattern",
      ...args,
      ...files.map((file) => `./${file}`),
    ],
    { stdio: ["ignore", stdout, "inherit"] },
  );
  return result.status ?? 1;
}

const staged = paths(
  git("diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"),
);

// A file with unstaged changes is only checked: formatting it and adding it
// again would also stage the changes that were deliberately left out.
const partial = new Set(paths(git("diff", "--name-only", "-z")));
const toFormat = staged.filter((file) => !partial.has(file));
const toCheck = staged.filter((file) => partial.has(file));

// Never call oxfmt without files: with no paths it formats the whole directory.
if (toFormat.length > 0) {
  if (runOxfmt([], toFormat, "ignore") !== 0) {
    process.exit(1);
  }
  git("add", "--", ...toFormat);
}

if (toCheck.length > 0 && runOxfmt(["--check"], toCheck, "inherit") !== 0) {
  console.error(
    "pre-commit: the files above are partly staged and not formatted.",
  );
  console.error(
    "Run `bun run format` at the repo root, stage the result, and commit again.",
  );
  process.exit(1);
}
