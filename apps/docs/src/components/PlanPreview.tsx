import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';

const planPreview = `
$ git clone github.com/my/dotfiles && cd dotfiles
$ boxfiles plan workstation.yml

facts
  os.platform       linux
  user.name         kin
  shell.current     zsh

steps
  01 package.git       install
  02 dotfiles.nvim     link
  03 provider-shell    apply

result
  3 actions planned
  0 mutations executed`;

export async function PlanPreview() {
  return (
    <ServerCodeBlock
      code={planPreview}
      lang="bash"
      themes={{ light: 'github-dark', dark: 'github-dark' }}
      codeblock={{
        title: 'plan preview',
        className: 'border-rp-muted/30 bg-rp-base text-rp-text',
        viewportProps: {
          className: 'bg-rp-base text-rp-text',
        },
      }}
    />
  );
}
