# SQL Queries

Apiary supports querying various SQL databases with a unified interface, including SQLite, PostgreSQL, ClickHouse, and more.

## Creating a SQL Request

1. Click **File → New Request** and select **SQL**
2. Configure the database connection
3. Write your SQL query

## Database Connection

### Connection Types

Supported database types:
- **SQLite**: Local SQLite database files
- **PostgreSQL**: PostgreSQL servers
- **ClickHouse**: ClickHouse columnar database
- **MySQL**: MySQL/MariaDB servers
- **SQL Server**: Microsoft SQL Server

### Connection String

Enter the connection string (DSN) for your database:

| Database | Example DSN |
|----------|-------------|
| SQLite | `file:data.db` |
| PostgreSQL | `postgres://user:pass@localhost:5432/dbname` |
| ClickHouse | `tcp://localhost:9000?database=default` |
| MySQL | `user:pass@tcp(localhost:3306)/dbname` |

### Advanced Connection Options

Click the gear icon next to the connection string to configure:
- **Read-only**: Prevent accidental modifications
- **Timeout**: Query timeout in seconds
- **SSL/TLS**: Secure connection settings
- **Connection Pooling**: Pool size and settings

## Writing Queries

### SQL Editor

The SQL editor provides:
- Syntax highlighting for SQL
- Auto-completion based on database schema
- Query formatting with `Ctrl+Shift+F`
- Multiple query execution (separate queries with `;`)

### Query Languages

In addition to raw SQL, Apiary supports:
- **PRQL**: Pipelined Relational Query Language
- **PQL**: Proprietary query languages via plugins

Select your query language from the dropdown next to the editor.

### Query Parameters

Use prepared statements with parameters to prevent SQL injection:

```sql
SELECT * FROM users WHERE id = ? AND status = ?
```

Add parameter values in the parameters tab.

## Performing Queries

Click the **Perform** button or press `Ctrl+Enter`. The results will appear in the right panel.

## Results Display

### Table View

Query results are displayed as interactive tables:

- **Sorting**: Click column headers to sort
- **Filtering**: Use the filter bar above the table
- **Pagination**: Navigate through large result sets
- **Column Resizing**: Drag column borders to resize
- **Column Reordering**: Drag column headers to reorder

### Export Options

Export query results as:
- **CSV**: Comma-separated values
- **JSON**: Array of objects
- **SQL INSERT**: INSERT statements for the data
- **Clipboard**: Copy selected cells or entire table

### Multiple Result Sets

If your query returns multiple result sets (e.g., multiple SELECT statements), use the tabs at the bottom of the results panel to switch between them.

## SQLSource Integration

Import an entire database schema as a **SQLSource** to browse tables, views, and stored procedures without writing queries.

## Example: Querying SQLite

1. Create a new SQL request
2. Select **SQLite** as database type
3. Enter `file:example.db` as connection string
4. Write your query:
```sql
SELECT id, name, email FROM users WHERE active = 1 ORDER BY created_at DESC;
```
5. Click **Perform**

## Example: Using Query Parameters

1. Write a parameterized query:
```sql
SELECT * FROM products WHERE category = ? AND price > ?;
```
2. Switch to the **Parameters** tab
3. Add two parameters:
   - `electronics` (string)
   - `100` (number)
4. Click **Perform**

## Advanced Features

### Query History

Apiary keeps a history of all executed queries. Access it via **View → Query History**.

### Query Templates

Save commonly used queries as templates for quick reuse.

### Transaction Support

Enable transaction mode to execute multiple queries within a single transaction.

## Performance Tips

- Use **Explain** button to see query execution plan
- Enable **Query timeout** to prevent long-running queries
- Use **Read-only** connections for production databases
- Limit result sets with `LIMIT` clauses

## Next Steps

- Learn about [SQLSource](/guide/sqlsource) for browsing database schemas
- Explore [JQ transformations](/guide/jq) for processing query results as JSON