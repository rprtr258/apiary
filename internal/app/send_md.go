package app

import (
	"bytes"

	pikchr "github.com/jchenry/goldmark-pikchr"
	"github.com/pkg/errors"
	img64 "github.com/tenkoh/goldmark-img64"
	mathml "github.com/wyatt915/goldmark-treeblood"
	"github.com/yuin/goldmark"
	emoji "github.com/yuin/goldmark-emoji"
	highlighting "github.com/yuin/goldmark-highlighting/v2"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"go.abhg.dev/goldmark/mermaid"
	"go.abhg.dev/goldmark/toc"

	"github.com/rprtr258/apiary/internal/database"
)

var m = goldmark.New(
	goldmark.WithExtensions(
		extension.GFM,
		extension.Footnote,
		emoji.Emoji,
		extension.Typographer,
		&mermaid.Extender{ // TODO: not working
			RenderMode: mermaid.RenderModeClient,
		},
		highlighting.NewHighlighting(
			highlighting.WithStyle("catppuccin-mocha"),
		),
		mathml.MathML(),
		&toc.Extender{},
		&pikchr.Extender{},
		img64.Img64,
	),
	goldmark.WithParserOptions(
		parser.WithAutoHeadingID(),
	),
)

func sendMarkdown(req database.MarkdownRequest) (database.MarkdownResponse, error) {
	var b bytes.Buffer
	if err := m.Convert([]byte(req.Data), &b); err != nil {
		return database.MarkdownResponse{}, errors.Wrap(err, "convert")
	}

	return database.MarkdownResponse{b.String()}, nil
}
