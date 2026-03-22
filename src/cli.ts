export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const [name, inlineValue] = token.slice(2).split("=", 2);
    if (!name) {
      continue;
    }

    if (inlineValue !== undefined) {
      flags[name] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (nextToken && !nextToken.startsWith("--")) {
      flags[name] = nextToken;
      index += 1;
      continue;
    }

    flags[name] = true;
  }

  return { positionals, flags };
}

export function readStringFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === "string" ? value : undefined;
}

export function readBooleanFlag(args: ParsedArgs, name: string): boolean {
  return args.flags[name] === true;
}

export function readNumberFlag(args: ParsedArgs, name: string): number | undefined {
  const value = readStringFlag(args, name);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected --${name} to be a number.`);
  }

  return parsed;
}
