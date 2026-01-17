package database

import (
	"context"
	"database/sql"
	"fmt"
	"slices"
	"strings"

	"github.com/pkg/errors"
	"github.com/rprtr258/fun"
	"github.com/rs/zerolog/log"
)

type TableInfo struct {
	Name      string `json:"name"`
	RowCount  int64  `json:"rowCount"`
	SizeBytes int64  `json:"sizeBytes"`
}

type ColumnInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Nullable     bool   `json:"nullable"`
	DefaultValue string `json:"defaultValue"`
}

type ConstraintInfo struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Definition string `json:"definition"`
}

type IndexInfo struct {
	Name       string `json:"name"`
	Definition string `json:"definition"`
}

type ForeignKey struct {
	Column string `json:"column"`
	Table  string `json:"table"`
	To     string `json:"to"`
}

type TableSchema struct {
	Columns     []ColumnInfo     `json:"columns"`
	Constraints []ConstraintInfo `json:"constraints"`
	ForeignKeys []ForeignKey     `json:"foreign_keys"`
	Indexes     []IndexInfo      `json:"indexes"`
}

const KindSQLSource Kind = "sql-source"

type SQLSourceRequest struct {
	Database Database `json:"database"`
	DSN      string   `json:"dsn"`
}

func (SQLSourceRequest) Kind() Kind { return KindSQLSource }

var pluginSQLSource = plugin{
	EmptyRequest:   SQLSourceEmptyRequest,
	enum:           enumElem[Kind]{KindSQLSource, "SQLSource"},
	Perform:        nil, // TODO: see PerformSQLSource handler
	create:         (*DB).create,
	update:         (*DB).update,
	createResponse: (*DB).createResponseSQLSource,
}

var SQLSourceEmptyRequest = SQLSourceRequest{DBPostgres, ""}

func ListTables(ctx context.Context, db Database, dsn string) ([]TableInfo, error) {
	var tables []TableInfo

	switch db {
	case DBPostgres:
		conn, err := sql.Open("postgres", dsn)
		if err != nil {
			return nil, errors.Wrap(err, "connect to postgres")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return nil, errors.Wrap(err, "ping postgres")
		}

		// Get tables with size and row count
		rows, err := conn.QueryContext(ctx, `
			SELECT
				t.tablename,
				COALESCE(s.n_live_tup, 0) as row_count,
				pg_total_relation_size(t.schemaname || '.' || t.tablename) as size_bytes
			FROM pg_catalog.pg_tables t
			LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname AND t.schemaname = s.schemaname
			WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
			ORDER BY size_bytes DESC
		`)
		if err != nil {
			return nil, errors.Wrap(err, "query postgres tables")
		}
		defer rows.Close()

		for rows.Next() {
			var info TableInfo
			if err := rows.Scan(&info.Name, &info.RowCount, &info.SizeBytes); err != nil {
				return nil, errors.Wrap(err, "scan postgres table info")
			}
			tables = append(tables, info)
		}
	case DBMySQL:
		conn, err := sql.Open("mysql", dsn)
		if err != nil {
			return nil, errors.Wrap(err, "connect to mysql")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return nil, errors.Wrap(err, "ping mysql")
		}

		// Get current database name
		var dbName string
		if err := conn.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&dbName); err != nil {
			return nil, errors.Wrap(err, "get mysql database name")
		}

		rows, err := conn.QueryContext(ctx, `
			SELECT
				table_name,
				table_rows,
				data_length + index_length
			FROM information_schema.TABLES
			WHERE table_schema = ?
			ORDER BY (data_length + index_length) DESC
		`, dbName)
		if err != nil {
			return nil, errors.Wrap(err, "query mysql tables")
		}
		defer rows.Close()

		for rows.Next() {
			var info TableInfo
			if err := rows.Scan(&info.Name, &info.RowCount, &info.SizeBytes); err != nil {
				return nil, errors.Wrap(err, "scan mysql table info")
			}
			tables = append(tables, info)
		}
	case DBSQLite:
		conn, err := sql.Open("sqlite", dsn)
		if err != nil {
			return nil, errors.Wrap(err, "connect to sqlite")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return nil, errors.Wrap(err, "ping sqlite")
		}

		// Get table names
		tableRows, err := conn.QueryContext(ctx, "SELECT name FROM sqlite_master WHERE type='table'")
		if err != nil {
			return nil, errors.Wrap(err, "query sqlite tables")
		}
		defer tableRows.Close()

		for tableRows.Next() {
			var table string
			if err := tableRows.Scan(&table); err != nil {
				return nil, errors.Wrap(err, "scan sqlite table name")
			}

			// Approximate size (rough estimate)
			colRows, err := conn.Query(fmt.Sprintf(`PRAGMA table_info(%s)`, table))
			if err != nil {
				return nil, errors.Wrap(err, "query sqlite table columns")
			}
			defer colRows.Close()

			var cols []string
			for colRows.Next() {
				var cid int
				var name, ctype string
				var notnull int
				var dflt sql.NullString
				var pk int
				if err := colRows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
					return nil, errors.Wrap(err, "scan sqlite column info")
				}
				cols = append(cols, name)
			}
			colRows.Close()

			lengthParts := fun.Map[string](func(c string) string {
				return fmt.Sprintf(`COALESCE(LENGTH("%s"),0)`, c)
			}, cols...)
			lengthExpr := strings.Join(lengthParts, " + ")

			var rowCount sql.NullInt64
			var sizeBytes sql.NullInt64
			sizeQuery := fmt.Sprintf(
				`SELECT COUNT(*) AS rows, SUM(%s) AS payload FROM "%s"`,
				lengthExpr, table,
			)
			if err := conn.QueryRowContext(ctx, sizeQuery, table).Scan(&rowCount, &sizeBytes); err != nil {
				log.Error().Err(err).Msgf("Failed to get size for table %s", table)
			}

			tables = append(tables, TableInfo{Name: table, RowCount: rowCount.Int64, SizeBytes: sizeBytes.Int64})
		}

		// Sort by size descending
		slices.SortFunc(tables, func(i, j TableInfo) int {
			return -int(i.SizeBytes - j.SizeBytes)
		})
	case DBClickhouse:
		conn, err := sql.Open("clickhouse", dsn)
		if err != nil {
			return nil, errors.Wrap(err, "connect to clickhouse")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return nil, errors.Wrap(err, "ping clickhouse")
		}

		rows, err := conn.QueryContext(ctx, `
			SELECT
				name,
				total_rows,
				total_bytes
			FROM system.tables
			WHERE database = currentDatabase()
			ORDER BY total_bytes DESC
		`)
		if err != nil {
			return nil, errors.Wrap(err, "query clickhouse tables")
		}
		defer rows.Close()

		for rows.Next() {
			var info TableInfo
			if err := rows.Scan(&info.Name, &info.RowCount, &info.SizeBytes); err != nil {
				return nil, errors.Wrap(err, "scan clickhouse table info")
			}
			tables = append(tables, info)
		}
	default:
		return nil, errors.Errorf("unsupported database for table listing: %s", db)
	}

	return tables, nil
}

func DescribeTable(ctx context.Context, db Database, dsn, tableName string) (TableSchema, error) {
	schema := TableSchema{
		Columns:     []ColumnInfo{},
		Constraints: []ConstraintInfo{},
		ForeignKeys: []ForeignKey{},
		Indexes:     []IndexInfo{},
	}

	switch db {
	case DBPostgres:
		conn, err := sql.Open("postgres", dsn)
		if err != nil {
			return schema, errors.Wrap(err, "connect to postgres")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return schema, errors.Wrap(err, "ping postgres")
		}

		// Get columns
		colRows, err := conn.QueryContext(ctx, `
			SELECT
				column_name,
				data_type,
				is_nullable = 'YES',
				column_default
			FROM information_schema.columns
			WHERE table_name = $1 AND table_schema NOT IN ('pg_catalog', 'information_schema')
			ORDER BY ordinal_position
		`, tableName)
		if err != nil {
			return schema, errors.Wrap(err, "query postgres columns")
		}
		defer colRows.Close()

		for colRows.Next() {
			var col ColumnInfo
			var nullable bool
			var defaultVal sql.NullString
			if err := colRows.Scan(&col.Name, &col.Type, &nullable, &defaultVal); err != nil {
				return schema, errors.Wrap(err, "scan postgres column")
			}
			col.Nullable = nullable
			col.DefaultValue = defaultVal.String
			schema.Columns = append(schema.Columns, col)
		}

		// Get constraints
		conRows, err := conn.QueryContext(ctx, `
			SELECT
				con.conname,
				CASE con.contype
					WHEN 'p' THEN 'PRIMARY KEY'
					WHEN 'u' THEN 'UNIQUE'
					WHEN 'f' THEN 'FOREIGN KEY'
					WHEN 'c' THEN 'CHECK'
					ELSE 'UNKNOWN'
				END,
				pg_get_constraintdef(con.oid)
			FROM pg_constraint con
			JOIN pg_class rel ON rel.oid = con.conrelid
			JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
			WHERE rel.relname = $1 AND nsp.nspname NOT IN ('pg_catalog', 'information_schema')
		`, tableName)
		if err != nil {
			return schema, errors.Wrap(err, "query postgres constraints")
		}
		defer conRows.Close()

		for conRows.Next() {
			var con ConstraintInfo
			if err := conRows.Scan(&con.Name, &con.Type, &con.Definition); err != nil {
				return schema, errors.Wrap(err, "scan postgres constraint")
			}
			schema.Constraints = append(schema.Constraints, con)
		}

		// Get indexes
		idxRows, err := conn.QueryContext(ctx, `
			SELECT idx.indexname, pg_get_indexdef(idx.indexrelid)
			FROM pg_indexes idx
			WHERE idx.tablename = $1 AND idx.schemaname NOT IN ('pg_catalog', 'information_schema')
		`, tableName)
		if err != nil {
			return schema, errors.Wrap(err, "query postgres indexes")
		}
		defer idxRows.Close()

		for idxRows.Next() {
			var idx IndexInfo
			if err := idxRows.Scan(&idx.Name, &idx.Definition); err != nil {
				return schema, errors.Wrap(err, "scan postgres index")
			}
			schema.Indexes = append(schema.Indexes, idx)
		}

		// Parse foreign keys from constraints
		for _, con := range schema.Constraints {
			if con.Type == "FOREIGN KEY" {
				// Parse "FOREIGN KEY (from) REFERENCES toTable(to)"
				parts := strings.Split(con.Definition, "REFERENCES")
				if len(parts) == 2 {
					fromPart := strings.Trim(strings.TrimSpace(parts[0]), "FOREIGN KEY ()")
					refPart := strings.TrimSpace(parts[1])
					refParts := strings.Split(refPart, "(")
					if len(refParts) == 2 {
						toTable := strings.TrimSpace(refParts[0])
						to := strings.Trim(strings.TrimSpace(refParts[1]), ")")
						schema.ForeignKeys = append(schema.ForeignKeys, ForeignKey{
							Column: fromPart,
							Table:  toTable,
							To:     to,
						})
					}
				}
			}
		}

		return schema, nil
	case DBMySQL:
		conn, err := sql.Open("mysql", dsn)
		if err != nil {
			return schema, errors.Wrap(err, "connect to mysql")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return schema, errors.Wrap(err, "ping mysql")
		}

		// Get columns
		colRows, err := conn.QueryContext(ctx, `
			SELECT
				column_name,
				column_type,
				is_nullable = 'YES',
				column_default
			FROM information_schema.columns
			WHERE table_name = ? AND table_schema = DATABASE()
			ORDER BY ordinal_position
		`, tableName)
		if err != nil {
			return schema, errors.Wrap(err, "query mysql columns")
		}
		defer colRows.Close()

		for colRows.Next() {
			var col ColumnInfo
			var nullable bool
			var defaultVal sql.NullString
			if err := colRows.Scan(&col.Name, &col.Type, &nullable, &defaultVal); err != nil {
				return schema, errors.Wrap(err, "scan mysql column")
			}
			col.Nullable = nullable
			col.DefaultValue = defaultVal.String
			schema.Columns = append(schema.Columns, col)
		}

		// Get constraints (simplified - key_column_usage)
		conRows, err := conn.QueryContext(ctx, `
			SELECT
				constraint_name,
				column_name
			FROM information_schema.key_column_usage
			WHERE table_name = ? AND table_schema = DATABASE() AND constraint_name = 'PRIMARY'
		`, tableName)
		if err == nil {
			defer conRows.Close()
			for conRows.Next() {
				var con ConstraintInfo
				var col string
				if err := conRows.Scan(&con.Name, &col); err != nil {
					continue
				}
				con.Type = "PRIMARY KEY"
				con.Definition = fmt.Sprintf("PRIMARY KEY (%s)", col)
				schema.Constraints = append(schema.Constraints, con)
			}
		}

		return schema, nil
	case DBSQLite:
		conn, err := sql.Open("sqlite", dsn)
		if err != nil {
			return schema, errors.Wrap(err, "connect to sqlite")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return schema, errors.Wrap(err, "ping sqlite")
		}

		// Get columns
		{
			colRows, err := conn.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(`%s`)", tableName))
			if err != nil {
				return schema, errors.Wrap(err, "query sqlite columns")
			}
			defer colRows.Close()

			for colRows.Next() {
				var cid int
				var name, typ string
				var notnull, pk bool
				var defaultVal sql.NullString
				if err := colRows.Scan(&cid, &name, &typ, &notnull, &defaultVal, &pk); err != nil {
					return schema, errors.Wrap(err, "scan sqlite column")
				}
				schema.Columns = append(schema.Columns, ColumnInfo{
					Name:         name,
					Type:         typ,
					Nullable:     !notnull,
					DefaultValue: defaultVal.String,
				})
				if pk {
					schema.Constraints = append(schema.Constraints, ConstraintInfo{
						Name:       "PRIMARY KEY",
						Type:       "PRIMARY KEY",
						Definition: fmt.Sprintf("PRIMARY KEY (%s)", name),
					})
				}
			}
		}
		// Get indexes
		{
			colRows, err := conn.QueryContext(ctx, `
				SELECT name, sql
				FROM sqlite_master
				WHERE type = 'index' AND tbl_name = ?
				ORDER BY name
			`, tableName)
			if err != nil {
				return schema, errors.Wrap(err, "query sqlite indexes")
			}
			defer colRows.Close()

			for colRows.Next() {
				var name string
				var sql sql.NullString
				if err := colRows.Scan(&name, &sql); err != nil {
					return schema, errors.Wrap(err, "scan sqlite index")
				}
				schema.Indexes = append(schema.Indexes, IndexInfo{
					Name:       name,
					Definition: sql.String,
				})
			}
		}

		// Get foreign keys
		fkRows, err := conn.QueryContext(ctx, fmt.Sprintf("PRAGMA foreign_key_list(%s)", tableName))
		if err != nil {
			return schema, errors.Wrap(err, "query sqlite foreign keys")
		}
		defer fkRows.Close()
		for fkRows.Next() {
			var id, seq int
			var refTable, from, to, onUpdate, onDelete, match string
			if err := fkRows.Scan(&id, &seq, &refTable, &from, &to, &onUpdate, &onDelete, &match); err != nil {
				continue
			}
			schema.ForeignKeys = append(schema.ForeignKeys, ForeignKey{
				Column: from,
				Table:  refTable,
				To:     to,
			})
		}

		return schema, nil
	case DBClickhouse:
		conn, err := sql.Open("clickhouse", dsn)
		if err != nil {
			return schema, errors.Wrap(err, "connect to clickhouse")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return schema, errors.Wrap(err, "ping clickhouse")
		}

		// Get columns
		colRows, err := conn.QueryContext(ctx, `
			SELECT
				name,
				type,
				default_kind != '',
				default_expression
			FROM system.columns
			WHERE database = currentDatabase() AND table = ?
		`, tableName)
		if err != nil {
			return schema, errors.Wrap(err, "query clickhouse columns")
		}
		defer colRows.Close()

		for colRows.Next() {
			var col ColumnInfo
			var hasDefault bool
			var defaultVal string
			if err := colRows.Scan(&col.Name, &col.Type, &hasDefault, &defaultVal); err != nil {
				return schema, errors.Wrap(err, "scan clickhouse column")
			}
			col.Nullable = strings.Contains(col.Type, "Nullable")
			if hasDefault {
				col.DefaultValue = defaultVal
			}
			schema.Columns = append(schema.Columns, col)
		}

		return schema, nil
	default:
		return schema, errors.Errorf("unsupported database for schema description: %s", db)
	}
}

func CountRows(ctx context.Context, db Database, dsn, tableName string) (int64, error) {
	var count int64
	switch db {
	case DBPostgres:
		conn, err := sql.Open("postgres", dsn)
		if err != nil {
			return 0, errors.Wrap(err, "connect to postgres")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return 0, errors.Wrap(err, "ping postgres")
		}

		query := fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)
		if err := conn.QueryRowContext(ctx, query).Scan(&count); err != nil {
			return 0, errors.Wrap(err, "count postgres rows")
		}
	case DBMySQL:
		conn, err := sql.Open("mysql", dsn)
		if err != nil {
			return 0, errors.Wrap(err, "connect to mysql")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return 0, errors.Wrap(err, "ping mysql")
		}

		query := fmt.Sprintf("SELECT COUNT(*) FROM `%s`", tableName)
		if err := conn.QueryRowContext(ctx, query).Scan(&count); err != nil {
			return 0, errors.Wrap(err, "count mysql rows")
		}
	case DBSQLite:
		conn, err := sql.Open("sqlite", dsn)
		if err != nil {
			return 0, errors.Wrap(err, "connect to sqlite")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return 0, errors.Wrap(err, "ping sqlite")
		}

		query := fmt.Sprintf("SELECT COUNT(*) FROM `%s`", tableName)
		if err := conn.QueryRowContext(ctx, query).Scan(&count); err != nil {
			return 0, errors.Wrap(err, "count sqlite rows")
		}
	case DBClickhouse:
		conn, err := sql.Open("clickhouse", dsn)
		if err != nil {
			return 0, errors.Wrap(err, "connect to clickhouse")
		}
		defer conn.Close()

		if err := conn.PingContext(ctx); err != nil {
			return 0, errors.Wrap(err, "ping clickhouse")
		}

		query := fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)
		if err := conn.QueryRowContext(ctx, query).Scan(&count); err != nil {
			return 0, errors.Wrap(err, "count clickhouse rows")
		}
	default:
		return 0, errors.Errorf("unsupported database for row count: %s", db)
	}

	return count, nil
}

func (db *DB) createResponseSQLSource(
	context.Context,
	RequestID,
	Response,
) error {
	return nil // no history for sql source
}
