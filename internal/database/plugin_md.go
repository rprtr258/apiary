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
	EmptyRequest:       MDEmptyRequest,
	enum:               enumElem[Kind]{KindMD, "MD"},
	Perform:            sendMD,
	create:             (*DB).createMD,
	list:               (*DB).listMDRequests,
	update:             (*DB).updateMD,
	createHistoryEntry: (*DB).createHistoryEntryMD,
}

//go:embed default.md
var DefaultMarkdown string

var MDEmptyRequest = MDRequest{DefaultMarkdown}

func (db *DB) createMD(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(MDRequest)
	_, err := db.db.ExecContext(ctx, `INSERT INTO request_md (id, data) VALUES ($1, $2)`, id, req.Data)
	return errors.Wrap(err, "insert md request")
}

func (db *DB) listMDRequests(ctx context.Context) ([]Request, error) {
	var reqs []struct {
		ID string `db:"id"`
		MDRequest
	}
	if err := db.db.SelectContext(ctx, &reqs, `SELECT * FROM request_md`); err != nil {
		return nil, errors.Wrapf(err, "query md requests")
	}

	res := make([]Request, 0, len(reqs))
	for _, req := range reqs {
		res = append(res, Request{
			ID:      RequestID(req.ID),
			Data:    req.MDRequest,
			History: nil,
		})
	}
	return res, nil
}

func (db *DB) updateMD(ctx context.Context, id RequestID, request EntryData) error {
	req := request.(MDRequest)
	_, err := db.db.ExecContext(ctx,
		`UPDATE request_md
			SET data = $2
			WHERE id = $1`,
		id,
		req.Data,
	)
	return err
}

func (db *DB) createHistoryEntryMD(
	context.Context,
	RequestID, int,
	EntryData,
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
