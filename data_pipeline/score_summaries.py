import os
import sys
import json
import pandas as pd
import pymysql
from dotenv import load_dotenv

Q95 = 65.0
MIN_SCORE = 5.0
GROUP_KEYS = ["province_code", "district_code", "subdistrict_code",
              "time_period", "day_type", "year"]

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

def get_conn():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        charset="utf8mb4",
    )

def calculate_risk_score(df):
    df = df.copy()
    for col in ["deaths", "serious_injuries", "minor_injuries"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["case_severity_score"] = (df["deaths"] * 25 + df["serious_injuries"] * 15
                                 + df["minor_injuries"] * 5 + 5)
    df["total_injuries"] = df["serious_injuries"] + df["minor_injuries"]

    result = (
        df.groupby(GROUP_KEYS, dropna=False)
        .agg(total_accidents=("year", "count"),
             total_deaths=("deaths", "sum"),
             total_injuries=("total_injuries", "sum"),
             total_severity_score=("case_severity_score", "sum"))
        .reset_index()
    )
    score = result["total_severity_score"].clip(upper=Q95)
    result["risk_score"] = (MIN_SCORE + ((score - MIN_SCORE) / (Q95 - MIN_SCORE)) * 95).round(2)
    result["risk_level"] = result["risk_score"].apply(
        lambda x: "High" if x >= 60 else "Medium" if x >= 30 else "Low")
    return result.drop(columns=["total_severity_score"])

def main():
    if len(sys.argv) < 2:
        print("Error: ระบุปี เช่น python score_summaries.py 2026 [--dry-run]")
        sys.exit(1)
    years = [int(y) for y in sys.argv[1].split(",")]
    dry = "--dry-run" in sys.argv

    conn = get_conn()
    try:
        placeholders = ",".join(["%s"] * len(years))
        df = pd.read_sql(
            f"""SELECT province_code, district_code, subdistrict_code, time_period,
                       day_type, year, deaths, serious_injuries, minor_injuries
                FROM accidents WHERE year IN ({placeholders})
                  AND district_code IS NOT NULL""", conn, params=years)
        if df.empty:
            print(json.dumps({"scored_groups": 0, "years": years}))
            return

        result = calculate_risk_score(df)

        for c in ["province_code", "district_code", "subdistrict_code"]:
            result[c] = result[c].apply(
                lambda v: None if pd.isna(v) else str(int(float(v))))

        if dry:
            result.to_csv("summaries_dryrun.csv", index=False, encoding="utf-8-sig")
            print(f"dry-run: {len(result)} กลุ่ม บันทึกที่ summaries_dryrun.csv")
            return

        cols = ["year", "province_code", "district_code", "subdistrict_code",
                "time_period", "day_type", "total_accidents", "total_deaths",
                "total_injuries", "risk_score", "risk_level"]
        rows = [tuple(None if pd.isna(v) else (v.item() if hasattr(v, "item") else v)
                      for v in r) for r in result[cols].itertuples(index=False, name=None)]

        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM summaries WHERE year IN ({placeholders})", years)
            cur.executemany(
                f"INSERT INTO summaries ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
                rows)
        conn.commit()
        print(json.dumps({"scored_groups": len(rows), "years": years}))
    except Exception as e:
        conn.rollback()
        print(f"Score Error: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()