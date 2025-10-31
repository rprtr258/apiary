package database

import (
	"context"

	"github.com/rprtr258/fun"
)

type Kind string
type plugin struct {
	EmptyRequest       EntryData
	enum               enumElem[Kind]
	Perform            func(context.Context, EntryData) (EntryData, error)
	create             func(*DB, context.Context, RequestID, EntryData) error
	list               func(*DB, context.Context) ([]Request, error)
	update             func(*DB, context.Context, RequestID, EntryData) error
	createHistoryEntry func(*DB, context.Context, RequestID, int, EntryData) error
}

var Plugins = map[Kind]plugin{
	KindHTTP:      pluginHTTP,
	KindSQL:       pluginSQL,
	KindJQ:        pluginJQ,
	KindMD:        pluginMD,
	KindRedis:     pluginRedis,
	KindGRPC:      pluginGRPC,
	KindSQLSource: pluginSQLSource,
}

var AllKinds = func() []enumElem[Kind] {
	return fun.MapToSlice(Plugins, func(_ Kind, plugin plugin) enumElem[Kind] {
		return plugin.enum
	})
}()
