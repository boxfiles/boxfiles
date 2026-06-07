type MarkdownAnsiOptions = Parameters<typeof Bun.markdown.ansi>[1];

export type FileTreeEntry = {
  readonly path: string;
  readonly label?: string;
};

type FileTreeNode = {
  readonly name: string;
  readonly children: Map<string, FileTreeNode>;
  label?: string;
};

function createMarkdownAnsiComponents(): Bun.markdown.AnsiTheme {
  return {};
}

export function markdownView(
  content: string,
  options: MarkdownAnsiOptions = createMarkdownAnsiComponents(),
): string {
  return Bun.markdown.ansi(content, options);
}

export function fileTreeView(
  entries: readonly FileTreeEntry[],
  title = "Manifests",
): string {
  if (entries.length === 0) return markdownView("No manifests found.").trimEnd();

  return `${markdownView(`## ${title}`).trimEnd()}\n\n${fileTreeText(entries)}`;
}

function fileTreeText(entries: readonly FileTreeEntry[]): string {
  const root = buildFileTree(entries);
  const lines: string[] = [];
  appendFileTreeLines(lines, root, "");

  return lines.join("\n");
}

function buildFileTree(entries: readonly FileTreeEntry[]): FileTreeNode {
  const root = createFileTreeNode("");

  for (const entry of entries) {
    insertFileTreeEntry(root, entry);
  }

  return root;
}

function insertFileTreeEntry(root: FileTreeNode, entry: FileTreeEntry): void {
  const parts = entry.path.split(/[\\/]/).filter((part) => part.length > 0);
  if (parts.length === 0) return;

  let node = root;

  for (const [index, part] of parts.entries()) {
    node = getOrCreateChildNode(node, part);

    if (index === parts.length - 1) {
      node.label = entry.label ?? part;
    }
  }
}

function getOrCreateChildNode(parent: FileTreeNode, name: string): FileTreeNode {
  const existing = parent.children.get(name);
  if (existing !== undefined) return existing;

  const child = createFileTreeNode(name);
  parent.children.set(name, child);

  return child;
}

function createFileTreeNode(name: string): FileTreeNode {
  return {
    name,
    children: new Map(),
  };
}

function appendFileTreeLines(
  lines: string[],
  node: FileTreeNode,
  prefix: string,
): void {
  const children = [...node.children.values()].sort(compareFileTreeNodes);

  for (const [index, child] of children.entries()) {
    const isLast = index === children.length - 1;
    const connector = isLast ? "└── " : "├── ";
    lines.push(`${prefix}${connector}${formatFileTreeNode(child)}`);

    if (child.children.size === 0) continue;

    appendFileTreeLines(lines, child, `${prefix}${isLast ? "    " : "│   "}`);
  }
}

function compareFileTreeNodes(left: FileTreeNode, right: FileTreeNode): number {
  const leftIsDirectory = left.children.size > 0;
  const rightIsDirectory = right.children.size > 0;

  if (leftIsDirectory !== rightIsDirectory) {
    return leftIsDirectory ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function formatFileTreeNode(node: FileTreeNode): string {
  if (node.children.size > 0) return node.name;

  return node.label ?? node.name;
}