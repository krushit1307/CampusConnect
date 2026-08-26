#!/bin/bash
for file in supabase/schema.sql supabase/migrations/*.sql; do
  awk '
    BEGIN { IGNORECASE = 1 }
    /CREATE TABLE/ || /ALTER TABLE/ {
      for(i=1; i<=NF; i++) {
        if ($i == "TABLE") {
          table=$(i+1);
          gsub(/[^a-zA-Z0-9_.]/, "", table);
        }
      }
    }
    /REFERENCES/ {
      if ($0 ~ /profiles/ || $0 ~ /auth\.users/) {
        print table, $0
      }
    }
  ' "$file"
done
