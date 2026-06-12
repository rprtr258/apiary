import {marked} from "marked";
import sanitizeHtml from "sanitize-html";
import type {MDRequest, MDResponse} from "@/types/models.ts";
import txt from "./default.md" with {type: "text"};

export const DefaultMarkdown: MDRequest = {data: txt};

export async function sendMD(request: MDRequest): Promise<MDResponse> {
  const html = await marked.parse(request.data, {
    gfm: true,
    extensions: {
      childTokens: {},
      renderers: {
  // pikchr "github.com/jchenry/goldmark-pikchr"
  // img64 "github.com/tenkoh/goldmark-img64"
  // mathml "github.com/wyatt915/goldmark-treeblood"
  // emoji "github.com/yuin/goldmark-emoji"
  // highlighting "github.com/yuin/goldmark-highlighting/v2"
  // "go.abhg.dev/goldmark/mermaid"
  // "go.abhg.dev/goldmark/toc"
        // extension.Footnote,
        // emoji.Emoji,
        // extension.Typographer,
        // &mermaid.Extender{ // TODO: not working
        //   RenderMode: mermaid.RenderModeClient,
        // },
        // highlighting.NewHighlighting(
        //   highlighting.WithStyle("catppuccin-mocha"),
        // ),
        // mathml.MathML(),
        // &toc.Extender{},
        // &pikchr.Extender{},
        // img64.Img64,
      },
    },
  });
  const sanitized = sanitizeHtml(html);
  return {data: sanitized};
}
