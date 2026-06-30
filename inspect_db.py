import sqlite3
import os

db_path = "backend/warehouse.db"
if not os.path.exists(db_path):
    print("Database file not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- plants table ---")
cursor.execute("SELECT code, name, typeof(code) FROM plants;")
for r in cursor.fetchall():
    print(r)

print("--- storage_locations table ---")
cursor.execute("SELECT code, plant_code, name, typeof(plant_code) FROM storage_locations LIMIT 5;")
for r in cursor.fetchall():
    print(r)

conn.close()
