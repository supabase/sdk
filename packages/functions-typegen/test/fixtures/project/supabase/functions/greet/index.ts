import type {
  Level,
  Mixed,
  Page,
  Shared,
  Status,
  Tree,
} from "@shared/types.ts";

interface Address {
  street: string;
  zip: string | undefined;
  readonly country?: "SE" | "NO";
}

type Tags = ReadonlyArray<string>;

export type RequestBody = {
  name: string;
  age?: number | null;
  tags: Tags;
  address: Address;
  addresses: Address[];
  status: Status;
  level: Level;
  meta: Record<string, unknown>;
  flags: Record<"a" | "b", boolean>;
  partial: Partial<Address>;
  shared: Shared;
  pair: [string, number];
  mixed: Mixed;
  nested: { deep: { flag: boolean } };
  loose: object;
  yes: true;
  bool: true | false;
  count: 1 | 2;
  when: Date;
  compute(): void;
} & { extra: string };

export interface ResponseBody extends Shared {
  greeting: string;
  page: Page<Tree>;
  paged: Page<number, number>;
  tree: Tree;
  self: RequestBody;
}

export default {
  fetch: async (request: Request): Promise<Response> => {
    const body = (await request.json()) as RequestBody;
    return Response.json({ greeting: `Hello ${body.name}` });
  },
};
