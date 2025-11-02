CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    department_id INT REFERENCES departments(id)
);

INSERT INTO departments (name) VALUES
  ('Engineering'),
  ('HR'),
  ('Sales');

INSERT INTO employees (name, department_id) VALUES
  ('Alice', 1),
  ('Bob', 1),
  ('Carol', 2),
  ('Dave', 3);
