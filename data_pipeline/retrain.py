import json
import math
import os
import sys
from datetime import datetime
from urllib.parse import quote_plus

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sklearn.metrics import (
    r2_score,
    mean_absolute_error,
    mean_squared_error,
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, "..", "backend", ".env"))


def build_db_url():
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    user = os.getenv("DB_USER")
    name = os.getenv("DB_NAME")
    if not user or not name:
        raise RuntimeError("ไม่พบ DB_USER / DB_NAME ใน backend/.env")
    password = quote_plus(os.getenv("DB_PASSWORD") or "")
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "3306")
    return f"mysql+pymysql://{quote_plus(user)}:{password}@{host}:{port}/{name}?charset=utf8mb4"


DB_URL = build_db_url()

SOURCE_TABLE = "accidents"
START_YEAR = 2021

# ---------------------------------------------------------------
# โหมดเทียบกับโมเดลหลัก (ใช้เฉพาะตอนสาธิต)
#   python retrain.py --snapshot
# หรือตั้งค่า environment variable RETRAIN_SOURCE=snapshot
# อ่านจากตารางสำเนา train2021_2023 / test2024_2025 เหมือน new_train.ipynb
# ใช้ได้เฉพาะปี 2021-2025 (ไม่รวม 2026)
# โหมดปกติ (ไม่ใส่ flag) อ่านจากตาราง accidents เหมือนเดิมทุกอย่าง
# ---------------------------------------------------------------
SNAPSHOT_MODE = (
    "--snapshot" in sys.argv
    or os.getenv("RETRAIN_SOURCE", "").strip().lower() == "snapshot"
)
SNAPSHOT_TRAIN_TABLE = "train2021_2023"
SNAPSHOT_TEST_TABLE = "test2024_2025"
SNAPSHOT_TRAIN_YEARS = [2021, 2022, 2023]
SNAPSHOT_TEST_YEARS = [2024, 2025]

GROUP_KEYS = [
    "province_code",
    "district_code",
    "subdistrict_code",
    "time_period",
    "day_type",
]

CAT_FEATURES = GROUP_KEYS.copy()
FEATURE_COLS = CAT_FEATURES + ["subdist_total_cases"]

K_DIST = 10
K_SUB = 10

MODEL_DIR = os.path.join(BASE_DIR, "models", "experimental")
os.makedirs(MODEL_DIR, exist_ok=True)

engine = create_engine(DB_URL)


def load_data_snapshot():
    train = pd.read_sql(f"SELECT * FROM `{SNAPSHOT_TRAIN_TABLE}`", engine)
    test = pd.read_sql(f"SELECT * FROM `{SNAPSHOT_TEST_TABLE}`", engine)

    if train.empty or test.empty:
        raise ValueError("Snapshot Train or Test table is empty")

    train_years = SNAPSHOT_TRAIN_YEARS
    test_years = SNAPSHOT_TEST_YEARS

    print("[SNAPSHOT MODE] อ่านจากตารางสำเนา")
    print(f"Train years: {train_years}")
    print(f"Test years: {test_years}")
    print(f"Train rows: {len(train):,}")
    print(f"Test rows: {len(test):,}")

    return (
        train,
        test,
        train_years,
        test_years,
        max(train_years),
        min(test_years),
        max(test_years),
    )


def load_data():
    if SNAPSHOT_MODE:
        return load_data_snapshot()

    required_cols = [
        "day",
        "month",
        "year",
        "province_code",
        "district_code",
        "subdistrict_code",
        "time_period",
        "day_type",
        "deaths",
        "serious_injuries",
        "minor_injuries",
    ]

    df = pd.read_sql(f"SELECT * FROM `{SOURCE_TABLE}`", engine,)

    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(
            f"Missing columns in {SOURCE_TABLE}: {missing}"
        )

    df["year"] = pd.to_numeric(df["year"], errors="coerce")
    df["month"] = pd.to_numeric(df["month"], errors="coerce")

    df = df.dropna(subset=["year", "month"]).copy()

    df["year"] = df["year"].astype(int)
    df["month"] = df["month"].astype(int)

    df = df[(df["year"] >= START_YEAR) & (df["month"].between(1, 12))].copy()

    if df.empty:
        raise ValueError(
            "No valid accident data found from START_YEAR onward"
        )

    available_years = sorted(df["year"].unique())

    if len(available_years) < 3:
        raise ValueError(
            "At least 3 distinct years are required for Train and Test"
        )

    train_years = available_years[:-2]
    test_years = available_years[-2:]

    train = df[df["year"].isin(train_years)].copy()
    test = df[df["year"].isin(test_years)].copy()

    if train.empty or test.empty:
        raise ValueError("Train or Test dataset is empty")

    if set(train["year"]).intersection(set(test["year"])):
        raise ValueError("Train and Test years overlap")

    train_end_year = max(train_years)
    test_start_year = min(test_years)
    latest_year = max(available_years)

    print(f"Available years: {available_years}")
    print(f"Train years: {train_years}")
    print(f"Test years: {test_years}")
    print(f"Train rows: {len(train):,}")
    print(f"Test rows: {len(test):,}")

    return (
        train,
        test,
        train_years,
        test_years,
        train_end_year,
        test_start_year,
        latest_year,
    )

def normalize_codes(df):
    df = df.copy()

    for col, width in [
        ("province_code", 2),
        ("district_code", 4),
        ("subdistrict_code", 6),
    ]:
        numeric = pd.to_numeric(df[col], errors="coerce")

        df[col] = (
            numeric.fillna(0)
            .astype(int)
            .astype(str)
            .str.zfill(width)
            .str.strip()
        )

    for col in [
        "deaths",
        "serious_injuries",
        "minor_injuries",
    ]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    for col in ["time_period", "day_type"]:
        df[col] = (df[col].fillna("Unknown").astype(str).str.strip())

    return df

def add_severity(df):
    df = df.copy()

    df["case_severity_score"] = (
        df["deaths"] * 25
        + df["serious_injuries"] * 15
        + df["minor_injuries"] * 5
        + 5
    )

    return df

def get_year_exposure(df):
    monthly_data = df[["year", "month"]].copy()

    monthly_data["year"] = pd.to_numeric(monthly_data["year"], errors="coerce")
    monthly_data["month"] = pd.to_numeric(monthly_data["month"], errors="coerce")
    monthly_data = monthly_data.dropna(subset=["year", "month"])
    monthly_data = monthly_data[monthly_data["month"].between(1, 12)]

    months_by_year = (monthly_data.drop_duplicates().groupby("year")["month"].nunique())

    exposure = months_by_year.sum() / 12

    if exposure <= 0:
        raise ValueError("Invalid data exposure")

    return exposure

def aggregate_groups(df):
    return (
        df.groupby(GROUP_KEYS, dropna=False)
        .agg(
            sample_size=("case_severity_score", "count"),
            total_severity_score=(
                "case_severity_score", "sum"
            ),
        )
        .reset_index()
    )

def compute_district_prior(df):
    t = df.assign(ws=df["annualized_score"] * df["sample_size"])

    result = (
        t.groupby("district_code")
        .agg(
            ws=("ws", "sum"),
            n=("sample_size", "sum"),
        )
        .reset_index()
    )

    result["district_prior_mean"] = (result["ws"] / result["n"].replace(0, np.nan))

    return result[["district_code", "district_prior_mean"]]

def compute_subdistrict_prior(
    df,
    district_prior,
    k=K_DIST,
):
    t = df.assign(ws=df["annualized_score"] * df["sample_size"])

    result = (
        t.groupby(["subdistrict_code", "district_code"])
        .agg(
            ws=("ws", "sum"),
            sub_n=("sample_size", "sum"),
        )
        .reset_index()
    )

    result["sub_mean"] = (result["ws"] / result["sub_n"].replace(0, np.nan))
    result = result.merge(district_prior, on="district_code", how="left",)
    result["sub_prior"] = (
        result["sub_mean"] * result["sub_n"]
        + result["district_prior_mean"] * k
    ) / (result["sub_n"] + k)

    return result[["subdistrict_code", "sub_prior"]]

def apply_shrinkage(
    df,
    district_prior,
    sub_prior,
    overall_mean,
    k=K_SUB,
):
    df = df.copy()
    df = df.merge(district_prior, on="district_code", how="left",)
    df = df.merge(sub_prior, on="subdistrict_code", how="left",)
    df["district_prior_mean"] = (df["district_prior_mean"].fillna(overall_mean))
    df["sub_prior"] = (df["sub_prior"].fillna(df["district_prior_mean"]))
    df["shrunk_score"] = (
        df["annualized_score"] * df["sample_size"]
        + df["sub_prior"] * k
    ) / (df["sample_size"] + k)

    return df

def to_risk_score(df, q95, min_s):
    df = df.copy()

    if q95 <= min_s:
        df["risk_score"] = 5.0
        return df

    clipped = df["shrunk_score"].clip(upper=q95)

    df["risk_score"] = (
        5 + ((clipped - min_s) / (q95 - min_s)) * 95
    ).round(2)

    return df

def retrain():
    (
        df_train_raw,
        df_test_raw,
        train_years,
        test_years,
        train_end_year,
        test_start_year,
        latest_year,
    ) = load_data()

    df_train_raw = add_severity(normalize_codes(df_train_raw))
    df_test_raw = add_severity(normalize_codes(df_test_raw))

    if SNAPSHOT_MODE:
        # ตารางสำเนาอาจไม่มีคอลัมน์ year/month จึงใช้จำนวนปีตายตัวเหมือน new_train.ipynb
        train_exposure = float(len(train_years))
        test_exposure = float(len(test_years))
    else:
        train_exposure = get_year_exposure(df_train_raw)
        test_exposure = get_year_exposure(df_test_raw)

    df_train_grp = aggregate_groups(df_train_raw)
    df_test_grp = aggregate_groups(df_test_raw)

    df_train_grp["annualized_score"] = (
        df_train_grp["total_severity_score"]
        / train_exposure
    )

    df_test_grp["annualized_score"] = (
        df_test_grp["total_severity_score"]
        / test_exposure
    )

    district_prior = compute_district_prior(df_train_grp)

    overall_mean = (district_prior["district_prior_mean"].mean())

    if pd.isna(overall_mean):
        overall_mean = (df_train_grp["annualized_score"].mean())

    sub_prior = compute_subdistrict_prior(df_train_grp, district_prior,)

    df_train_grp = apply_shrinkage(
        df_train_grp,
        district_prior,
        sub_prior,
        overall_mean,
    )

    df_test_grp = apply_shrinkage(
        df_test_grp,
        district_prior,
        sub_prior,
        overall_mean,
    )

    q95 = df_train_grp["shrunk_score"].quantile(0.95)
    min_s = df_train_grp["shrunk_score"].min()

    df_train_grp = to_risk_score(df_train_grp, q95, min_s)
    df_test_grp = to_risk_score(df_test_grp, q95, min_s)

    subdistrict_hist = (
        df_train_raw.groupby("subdistrict_code")
        .agg(
            subdist_total_cases=(
                "case_severity_score", "count"
            )
        )
        .reset_index()
    )

    df_train_grp = df_train_grp.merge(
        subdistrict_hist,
        on="subdistrict_code",
        how="left",
    )

    df_test_grp = df_test_grp.merge(
        subdistrict_hist,
        on="subdistrict_code",
        how="left",
    )

    fill_val = df_train_grp[
        "subdist_total_cases"
    ].median()

    if pd.isna(fill_val):
        fill_val = 0

    df_train_grp["subdist_total_cases"] = (df_train_grp["subdist_total_cases"].fillna(fill_val))
    df_test_grp["subdist_total_cases"] = (df_test_grp["subdist_total_cases"].fillna(fill_val))

    categories_map = {}

    for col in CAT_FEATURES:
        df_train_grp[col] = (
            df_train_grp[col]
            .fillna("Unknown")
            .astype(str)
            .str.strip()
        )

        df_test_grp[col] = (
            df_test_grp[col]
            .fillna("Unknown")
            .astype(str)
            .str.strip()
        )

        categories = list(pd.unique(df_train_grp[col]))
        categories_map[col] = categories

        mode_values = df_train_grp[col].mode()

        if len(mode_values) == 0:
            raise ValueError(
                f"No Train category available for {col}"
            )

        mode_val = mode_values.iloc[0]

        df_test_grp.loc[~df_test_grp[col].isin(categories), col] = mode_val
        df_train_grp[col] = pd.Categorical(df_train_grp[col], categories=categories,)
        df_test_grp[col] = pd.Categorical(df_test_grp[col], categories=categories,)

    X_train = df_train_grp[FEATURE_COLS]
    y_train = df_train_grp["risk_score"]

    X_test = df_test_grp[FEATURE_COLS]
    y_test = df_test_grp["risk_score"]

    model = lgb.LGBMRegressor(
        n_estimators=300,
        learning_rate=0.03,
        num_leaves=31,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=-1,
    )

    model.fit(
        X_train,
        y_train,
        categorical_feature=CAT_FEATURES,
    )

    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)

    train_r2 = r2_score(y_train, train_pred)

    test_r2 = (
        r2_score(y_test, test_pred)
        if len(y_test) >= 2
        else float("nan")
    )

    test_mae = mean_absolute_error(y_test, test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, test_pred))

    print("\n========== MODEL EVALUATION ==========")
    print(f"Source: {'snapshot tables' if SNAPSHOT_MODE else SOURCE_TABLE}")
    print(f"Train years: {train_years}")
    print(f"Test years: {test_years}")
    print(f"Train exposure: {train_exposure:.2f} years")
    print(f"Test exposure: {test_exposure:.2f} years")
    print(
        f"Train: {len(df_train_raw):,} rows, "
        f"{len(df_train_grp):,} groups"
    )
    print(
        f"Test: {len(df_test_raw):,} rows, "
        f"{len(df_test_grp):,} groups"
    )
    print(f"q95 = {q95}, min_s = {min_s}")
    print(f"Train R2  = {train_r2:.4f}")
    print(f"Test R2   = {test_r2:.4f}")
    print(f"Test MAE  = {test_mae:.4f}")
    print(f"Test RMSE = {test_rmse:.4f}")

    version = datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )

    model_path = os.path.join(
        MODEL_DIR,
        f"lightgbm_{version}.joblib",
    )

    artifact = {
        "model": model,
        "feature_cols": FEATURE_COLS,
        "cat_features": CAT_FEATURES,
        "categories": categories_map,
        "district_prior": district_prior,
        "sub_prior": sub_prior,
        "overall_mean": overall_mean,
        "q95": q95,
        "min_s": min_s,
        "fill_val": fill_val,
        "subdistrict_hist": subdistrict_hist,
        "train_years": train_years,
        "test_years": test_years,
        "train_exposure": train_exposure,
        "test_exposure": test_exposure,
        "metrics": {
            "train_r2": float(train_r2),
            "test_r2": float(test_r2),
            "test_mae": float(test_mae),
            "test_rmse": float(test_rmse),
        },
        "version": version,
        "model_type": "experimental",
        "data_source": "snapshot" if SNAPSHOT_MODE else SOURCE_TABLE,
    }

    joblib.dump(artifact, model_path)

    print(f"\nSaved experimental model: {model_path}")
    print("Retraining experiment completed.")

    def num(x):
        x = float(x)
        return None if math.isnan(x) or math.isinf(x) else x

    summary = {
        "version": version,
        "model_file": os.path.basename(model_path),
        "train_years": [int(y) for y in train_years],
        "test_years": [int(y) for y in test_years],
        "train_rows": int(len(df_train_raw)),
        "test_rows": int(len(df_test_raw)),
        "train_groups": int(len(df_train_grp)),
        "test_groups": int(len(df_test_grp)),
        "train_exposure": num(train_exposure),
        "test_exposure": num(test_exposure),
        "train_r2": num(train_r2),
        "test_r2": num(test_r2),
        "test_mae": num(test_mae),
        "test_rmse": num(test_rmse),
    }
    print("RETRAIN_RESULT_JSON:" + json.dumps(summary, allow_nan=False), flush=True)

    return artifact

if __name__ == "__main__":
    try:
        retrain()
    finally:
        engine.dispose()