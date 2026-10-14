export interface Base {
  id: string;
  [extra: string]: unknown;
}

export interface Shared extends Base {
  label?: string;
}

export interface Page<Item, Cursor = string> {
  items: Item[];
  next: Cursor | null;
}

export enum Status {
  Active = "active",
  Archived = "archived",
}

export enum Level {
  Low,
  High = 10,
  Higher,
}

export type Tree = {
  value: number;
  children: Tree[];
};

export type Mixed = string | number;
