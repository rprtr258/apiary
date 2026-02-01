# SQLSource

SQLSource allows you to import an entire database schema as a browsable collection of tables, views, and stored procedures.

## Creating a SQLSource

1. Click **File → New Datasource** and select **SQLSource**
2. Configure the database connection
3. Import the schema

## Database Connection

Same connection options as regular SQL requests (see [SQL Queries](/guide/sql)).

## Schema Import

Once connected, Apiary will:
1. Scan the database for all tables, views, and stored procedures
2. Create a collection in the sidebar
3. Populate it with browseable items

## Browsing Schema

### Tree View

The SQLSource appears in the sidebar as a expandable tree:
- **Tables**: List of all tables
- **Views**: List of all views
- **Stored Procedures**: List of all procedures
- **Functions**: List of all functions

### Table Details

Click a table to open it in a table viewer:
- **Structure**: Column names, types, constraints
- **Data**: Browse table data
- **Indexes**: View table indexes
- **Foreign Keys**: View relationship constraints

## Table Viewer

### Data Browsing

Browse table data with:
- **Pagination**: Navigate through rows
- **Filtering**: Filter rows by column values
- **Sorting**: Sort by clicking column headers
- **Search**: Full-text search across the table

### Editing Data

Edit table data directly (with caution):
- **Inline editing**: Double-click cells to edit
- **Row operations**: Add, delete, duplicate rows
- **Bulk edit**: Edit multiple rows at once

### Export Data

Export table data as:
- **CSV**: Comma-separated values
- **JSON**: Array of objects
- **SQL INSERT**: INSERT statements
- **Excel**: XLSX format

## Views and Procedures

### Views

Open views just like tables (read-only).

### Stored Procedures

Execute stored procedures with parameter input.

## Example: Exploring a Database

1. Create a SQLSource connection to your PostgreSQL database
2. Expand the "Tables" section in the sidebar
3. Click the "users" table
4. Browse user data, filter by active status, sort by creation date
5. Export the filtered data as CSV

## Advanced Features

### Schema Changes

Detect schema changes and auto-refresh the collection.

### Query Generation

Generate SQL queries from UI actions:
- **SELECT**: Click "Generate SELECT" for the current filter
- **INSERT**: Click "Generate INSERT" for new rows
- **UPDATE**: Click "Generate UPDATE" for edited rows
- **DELETE**: Click "Generate DELETE" for deleted rows

### Data Relationships

Visualize foreign key relationships between tables.

### Performance Statistics

View table size, row count, and index usage.

## Use Cases

### Database Exploration

Quickly explore unfamiliar databases.

### Data Maintenance

Perform routine data cleanup and updates.

### Schema Documentation

Generate documentation from database schema.

### Data Migration

Prepare data for migration between systems.

## Next Steps

Learn about other datasource types like [HTTPSource](/guide/httpsource).
