import os
import sys
import numpy as np
import pandas as pd

# ให้ print ภาษาไทยออกทาง pipe ได้บน Windows 
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ชื่อคอลัมน์ในไฟล์ที่ clean แล้ว -> ชื่อคอลัมน์ในตาราง accidents
COLUMN_MAP = {
    'LATITUDE': 'latitude',
    'LONGITUDE': 'longitude',
    'ผู้เสียชีวิต': 'deaths',
    'ผู้บาดเจ็บสาหัส': 'serious_injuries',
    'ผู้บาดเจ็บเล็กน้อย': 'minor_injuries',
    'รวมจำนวนผู้บาดเจ็บ': 'total_injuries',
    'บริเวณที่เกิดเหตุ': 'location_type',
    'มูลเหตุสันนิษฐาน': 'presumed_cause',
    'ลักษณะการเกิดเหตุ': 'incident_type',
    'สภาพอากาศ': 'weather',
    'รถคันที่1': 'vehicle',
    'สายทาง': 'road_name',
    'ชั่วโมง': 'hour',
    # *** ตรวจชื่อจริงใน MySQL ด้วย (ในรูป Workbench ชื่อถูกตัดเป็น is_dangerouse_...) ***
    'is_dangerous_7days': 'is_dangerouse_7days',
}

RENAME_2026 = {
    'จำนวนผู้เสียชีวิต': 'ผู้เสียชีวิต',
    'จำนวนผู้บาดเจ็บสาหัส': 'ผู้บาดเจ็บสาหัส',
    'จำนวนผู้บาดเจ็บเล็กน้อย': 'ผู้บาดเจ็บเล็กน้อย',
    'บริเวณที่เกิดเหตุ/ลักษณะทาง': 'บริเวณที่เกิดเหตุ',
    'ลักษณะการเกิดอุบัติเหตุ': 'ลักษณะการเกิดเหตุ',
    'หน่วยงาน': 'agency',
}

# ฟังก์ชันจาก notebook (clean_admin.ipynb)
def parse_mixed_dates(val):
    try:
        num = float(val)
        if num > 1000:
            return pd.to_datetime(num, unit='D', origin='1899-12-30')
    except (ValueError, TypeError):
        pass
    return pd.to_datetime(val, dayfirst=True, errors='coerce')


def clean_time_str(val):
    if pd.isna(val):
        return val
    try:
        v = float(val)
        if 0 <= v <= 1:
            total_sec = int(v * 86400)
            return f"{total_sec // 3600:02d}:{(total_sec % 3600) // 60:02d}"
    except ValueError:
        pass
    return str(val).strip()


def get_time_period(hour):
    if pd.isna(hour) or hour < 0:
        return 'ไม่ระบุ'
    elif 0 <= hour < 4:
        return 'ดึก (00:00 - 03:59)'
    elif 4 <= hour < 8:
        return 'เช้ามืด (04:00 - 07:59)'
    elif 8 <= hour < 12:
        return 'เช้า (08:00 - 11:59)'
    elif 12 <= hour < 16:
        return 'บ่าย (12:00 - 15:59)'
    elif 16 <= hour < 20:
        return 'เย็น (16:00 - 19:59)'
    else:
        return 'กลางคืน (20:00 - 23:59)'


def calculate_severity(row):
    if row.get('ผู้เสียชีวิต', 0) >= 1:
        return 'รุนแรงมาก (เสียชีวิต)'
    elif row.get('ผู้บาดเจ็บสาหัส', 0) >= 1:
        return 'รุนแรงปานกลาง (บาดเจ็บสาหัส)'
    else:
        return 'รุนแรงน้อย (บาดเจ็บเล็กน้อย/ทรัพย์สินเสียหาย)'


def process_cleansing_pipeline(df):
    df = df.rename(columns=RENAME_2026)
    df['LATITUDE'] = pd.to_numeric(df['LATITUDE'], errors='coerce')
    df['LONGITUDE'] = pd.to_numeric(df['LONGITUDE'], errors='coerce')
    valid_lat = (df['LATITUDE'] >= 5.0) & (df['LATITUDE'] <= 21.0)
    valid_long = (df['LONGITUDE'] >= 97.0) & (df['LONGITUDE'] <= 106.0)
    df = df[valid_lat & valid_long].copy()

    df = df.drop_duplicates()

    if df.empty:  # ไม่เหลือแถวที่พิกัดถูกต้อง
        return df

    numeric_cols = [
        'ผู้เสียชีวิต', 'ผู้บาดเจ็บสาหัส', 'ผู้บาดเจ็บเล็กน้อย', 'รวมจำนวนผู้บาดเจ็บ'
    ]
    for col in numeric_cols:
        if col in df.columns:
            # to_numeric ก่อน กันกรณีมีข้อความปนในคอลัมน์ตัวเลข
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)

    text_cols = ['บริเวณที่เกิดเหตุ', 'มูลเหตุสันนิษฐาน', 'ลักษณะการเกิดเหตุ', 'สภาพอากาศ', 'จังหวัด', 'รถคันที่1', 'สายทาง']
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].fillna('ไม่ระบุ').astype(str).str.strip()

    if 'มูลเหตุสันนิษฐาน' in df.columns:
        df['มูลเหตุสันนิษฐาน'] = df['มูลเหตุสันนิษฐาน'].replace({
            "ขับขี่ย้อนศร": "ขับรถย้อนศร",
            "ขับชิดซ้ายมากเกินไป": "ขับรถชิดซ้ายมากเกินไป",
            "ขับรถกระชั้นชิด": "ขับรถตามกระชั้นชิด",
            "ฝ่าฝืนสัญญาณไฟ / เครื่องหมายจราจร": "ฝ่าฝืนสัญญาณไฟ/เครื่องหมายจราจร",
            "มึนเมาจากแอลกอฮอล์": "เมาสุรา",
            "เบรคกะทันหัน": "เบรกกะทันหัน",
            "เบรคกระทันหัน": "เบรกกะทันหัน",
            "เบครกระทันหัน": "เบรกกะทันหัน",
            "อุปกรณ์ยานพาหนะบกพร่อง (ระบุ)": "อุปกรณ์ยานพาหนะบกพร่อง"
        })

    if 'เวลา' in df.columns:
        df['เวลา'] = df['เวลา'].apply(clean_time_str)
        df['ชั่วโมง'] = df['เวลา'].astype(str).str.extract(r'^(\d{1,2}):')[0]
        df['ชั่วโมง'] = pd.to_numeric(df['ชั่วโมง'], errors='coerce').fillna(-1).astype(int)

    # if 'วันที่เกิดเหตุ' in df.columns:
    #     df['วันที่เกิดเหตุ'] = df['วันที่เกิดเหตุ'].apply(parse_mixed_dates)
    #     df['year'] = df['วันที่เกิดเหตุ'].dt.year
    #     df['month'] = df['วันที่เกิดเหตุ'].dt.month
    #     df['day'] = df['วันที่เกิดเหตุ'].dt.day
    #     df['dayofweek'] = df['วันที่เกิดเหตุ'].dt.dayofweek
    #     df['is_weekend'] = df['dayofweek'].isin([5, 6]).astype(int)

    if 'วันที่เกิดเหตุ' in df.columns:
        df['วันที่เกิดเหตุ'] = df['วันที่เกิดเหตุ'].apply(parse_mixed_dates)
        df = df[df['วันที่เกิดเหตุ'].notna()].copy()
        if df.empty:
            return df
        df['year'] = df['วันที่เกิดเหตุ'].dt.year.astype(int)
        df['month'] = df['วันที่เกิดเหตุ'].dt.month.astype(int)
        df['day'] = df['วันที่เกิดเหตุ'].dt.day.astype(int)
        df['dayofweek'] = df['วันที่เกิดเหตุ'].dt.dayofweek
        df['is_weekend'] = df['dayofweek'].isin([5, 6]).astype(int)

    if 'ชั่วโมง' in df.columns:
        df['time_period'] = df['ชั่วโมง'].apply(get_time_period)

    df['severity_level'] = df.apply(calculate_severity, axis=1)

    if 'วันที่เกิดเหตุ' in df.columns:
        df['is_new_year'] = df['วันที่เกิดเหตุ'].apply(
            lambda d: 1 if pd.notna(d) and ((d.month == 12 and d.day >= 29) or (d.month == 1 and d.day <= 4)) else 0
        )
        df['is_songkran'] = df['วันที่เกิดเหตุ'].apply(
            lambda d: 1 if pd.notna(d) and (d.month == 4 and 11 <= d.day <= 17) else 0
        )
        df['is_dangerous_7days'] = ((df['is_new_year'] == 1) | (df['is_songkran'] == 1)).astype(int)

    drop_cols = [
        'ACC_CODE', 'สายทางหน่วยงาน', 'KM', 'รหัสสายทาง',
        'วันที่เกิดเหตุ', 'เวลา', 'วันที่รายงาน', 'เวลาที่รายงาน',
        'รถและคนที่เกิดเหตุ', 'รถที่เกิดเหตุ', 'dayofweek',
        'รถจักรยานยนต์', 'รถสามล้อเครื่อง', 'รถยนต์นั่งส่วนบุคคล', 'รถตู้',
        'รถปิคอัพโดยสาร', 'รถโดยสารมากกว่า4ล้อ', 'รถปิคอัพบรรทุก4ล้อ',
        'รถบรรทุก6ล้อ', 'รถบรรทุกไม่เกิน10ล้อ', 'รถบรรทุกมากกว่า10ล้อ',
        'รถอีแต๋น', 'รถอื่นๆ', 'คนเดินเท้า'
    ]

    df_cleaned = df.drop(columns=[col for col in drop_cols if col in df.columns])
    return df_cleaned

# ส่วนเพิ่มใหม่: แปลงให้เข้ากับตาราง accidents
def to_db_schema(df):
    df = df.rename(columns=COLUMN_MAP)

    if 'day_type' not in df.columns and 'is_new_year' in df.columns:
        df['day_type'] = np.select(
            [df['is_new_year'] == 1, df['is_songkran'] == 1, df['is_weekend'] == 1],
            ['new_year', 'songkran', 'weekend'],
            default='normal_day'
        )
    return df

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Error: กรุณาระบุ Path File Input และ Output ให้ครบถ้วน")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        print("Error: ไม่พบไฟล์ Input")
        sys.exit(1)

    try:
        raw_df = pd.read_csv(input_path, encoding="utf-8-sig", low_memory=False)

        missing = [c for c in ('LATITUDE', 'LONGITUDE') if c not in raw_df.columns]
        if missing:
            print(f"Error: ไฟล์ขาดคอลัมน์ {', '.join(missing)}")
            sys.exit(1)

        cleaned_df = to_db_schema(process_cleansing_pipeline(raw_df))
        cleaned_df.to_csv(output_path, index=False, encoding="utf-8-sig")
        print(f"Cleansing Successfully! ({len(cleaned_df)} rows)")
    except Exception as e:
        print(f"Processing Error: {e}")
        sys.exit(1)