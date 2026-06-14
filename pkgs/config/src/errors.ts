export class BoxfileConfigParseError extends Error {
  constructor(public readonly cause: unknown, public readonly rendered: string) {
    super(`Failed to parse boxfiles config\n\n${rendered}`);
    this.name = "BoxfileConfigParseError";
  }
}
