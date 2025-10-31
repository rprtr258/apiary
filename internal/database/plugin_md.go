package database

import (
	"bytes"
	"context"
	_ "embed"

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
)

const KindMD Kind = "md"

type MDRequest struct {
	Data string `json:"data"`
}

func (MDRequest) Kind() Kind { return KindMD }

type MDResponse struct {
	Data string `json:"data"`
}

func (MDResponse) Kind() Kind { return KindMD }

var pluginMD = plugin{
	EmptyRequest:   MDEmptyRequest,
	enum:           enumElem[Kind]{KindMD, "MD"},
	Perform:        sendMD,
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: (*DB).createHistoryEntryMD,
}

//go:embed default.md
var DefaultMarkdown string

var MDEmptyRequest = MDRequest{DefaultMarkdown}

func (db *DB) createHistoryEntryMD(
	context.Context,
	RequestID,
	Response,
) error {
	return nil // no history for md
}

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

func sendMD(ctx context.Context, request EntryData) (EntryData, error) {
	req := request.(MDRequest)
	var b bytes.Buffer
	if err := m.Convert([]byte(req.Data), &b); err != nil {
		return MDResponse{}, errors.Wrap(err, "convert")
	}

	return MDResponse{b.String()}, nil
}
