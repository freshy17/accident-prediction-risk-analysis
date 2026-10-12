import os
import sys
from collections import Counter

import pandas as pd
import pymysql
from dotenv import load_dotenv

from geo_assign import GeoAssigner

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 20000

conn = pymysql.connect(
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME"),
    charset="utf8mb4",
)
df = pd.read_sql(
    """SELECT latitude, longitude, district_code, subdistrict_code
       FROM accidents
       WHERE year BETWEEN 2021 AND 2025
         AND district_code IS NOT NULL AND subdistrict_code IS NOT NULL
         AND latitude IS NOT NULL AND longitude IS NOT NULL
       ORDER BY RAND() LIMIT %s""",
    conn, params=[N],
)
conn.close()

g = GeoAssigner()
r = g.assign(df["latitude"].values, df["longitude"].values)


def norm(v):
    return None if v is None or pd.isna(v) else str(int(float(v)))


true_d = df["district_code"].map(norm)
true_s = df["subdistrict_code"].map(norm)
pred_d = pd.Series(r["district_code"])
pred_s = pd.Series(r["subdistrict_code"])
method = pd.Series(r["geo_method"])

print("========== ผลวัด point-in-polygon ==========")
print("ตัวอย่าง:", len(df), "แถว")
print("วิธีที่จับคู่ได้:", dict(Counter(r["geo_method"])))
print(f"ระดับอำเภอ: {(true_d == pred_d).mean() * 100:.2f} %")
print(f"ระดับตำบล : {(true_s == pred_s).mean() * 100:.2f} %")
print("--- เฉพาะแถวที่ตกใน polygon จริง ---")
m = method == "polygon"
print(f"อำเภอ: {(true_d[m] == pred_d[m]).mean() * 100:.2f} %  ตำบล: {(true_s[m] == pred_s[m]).mean() * 100:.2f} %")