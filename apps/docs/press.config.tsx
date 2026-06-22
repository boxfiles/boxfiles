
import { defineConfig } from "fumapress";
import { llmsPlugin } from "fumapress/plugins/llms.txt";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";
import { fumadocsMdx } from "fumapress/adapters/mdx";
import { update } from "fumadocs-core/source";
// don't worry if this file is missing, we will run the dev command later to generate this file
import { docs, providerDocs } from "./.source/server";

const docsSource = update(docs.toFumadocsSource())
  .page((page) => {
    return page;
  })
  .build();

const providerSource = update(providerDocs.toFumadocsSource())
  .page((page) => {
    const name = page.path.split("/")[0]?.replace(/^provider-/, "") ?? page.path;

    return { ...page, slugs: ["builtin", name] };
  })
  .build();


export default defineConfig({
  content: {
    docs: docsSource,
    providerDocs: providerSource,
  },
  site: {
    name: "Boxfiles",
  },
})

  // extend via plugins
  .plugins(flexsearchPlugin(), llmsPlugin())
  // use different content sources
  .adapters(fumadocsMdx());

