type MarkdownAnsiOptions = Parameters<typeof Bun.markdown.ansi>[1];
function createMarkdownAnsiComponents(): Bun.markdown.AnsiTheme {
  return {};
}

export function markdownView(
  content: string,
  options: MarkdownAnsiOptions = createMarkdownAnsiComponents(),
): string {
  return Bun.markdown.ansi(content, options);
}

