from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import shap
import os
import re
import math
from datetime import datetime

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

#โมเดลหลักที่ใช้งานจริง (ตัวเดิม)
DEFAULT_MODEL_ID = 'default'
DEFAULT_MODEL_FILE = os.path.join(BASE_DIR, 'new3_lightgbm_risk_model.pkl')

#โมเดลทดลองที่ retrain.py สร้างไว้ คือไฟล์ lightgbm_<เวอร์ชัน>.joblib
#id ของโมเดลทดลองคือเลขเวอร์ชันในชื่อไฟล์ เช่น 20261022_115633
VERSION_RE = re.compile(r'^\d{8}_\d{6}$')
EXPERIMENTAL_FILE_RE = re.compile(r'^lightgbm_(\d{8}_\d{6})\.joblib$')

class ModelNotFound(Exception):
    pass

def find_experimental_dir():
    """หาโฟลเดอร์ models/experimental (เช็กทุกครั้งที่เรียก เพราะโฟลเดอร์เพิ่งถูกสร้างหลังกดรีเทรนครั้งแรกได้)

    ลำดับที่หา: ตัวแปรแวดล้อม EXPERIMENTAL_MODEL_DIR -> โฟลเดอร์เดียวกับ app.py -> data_pipeline ที่อยู่ระดับบน
    """
    candidates = []
    env_dir = os.environ.get('EXPERIMENTAL_MODEL_DIR')
    if env_dir:
        candidates.append(env_dir)
    candidates += [
        os.path.join(BASE_DIR, 'models', 'experimental'),
        os.path.join(BASE_DIR, '..', 'data_pipeline', 'models', 'experimental'),
        os.path.join(BASE_DIR, 'data_pipeline', 'models', 'experimental'),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return os.path.abspath(c)
    return None

def clean_num(x):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(x) or math.isinf(x) else x

def extract_meta(model_id, pkg):
    """ข้อมูลประกอบโมเดลสำหรับ dropdown (ปีที่ใช้เทรน ค่าวัดผล ฯลฯ) อ่านจากในไฟล์โมเดลเอง"""
    is_default = model_id == DEFAULT_MODEL_ID
    created_at = None
    if not is_default:
        try:
            created_at = datetime.strptime(model_id, '%Y%m%d_%H%M%S').isoformat()
        except ValueError:
            created_at = None

    metrics = pkg.get('metrics')
    return {
        'id': model_id,
        'is_default': is_default,
        'experimental': not is_default,
        'created_at': created_at,
        'train_years': [int(y) for y in list(pkg.get('train_years', []))],
        'test_years': [int(y) for y in list(pkg.get('test_years', []))],
        'metrics': {k: clean_num(v) for k, v in metrics.items()} if metrics else None,
    }

def model_path(model_id):
    if model_id == DEFAULT_MODEL_ID:
        return DEFAULT_MODEL_FILE
    #รับเฉพาะรูปแบบเลขเวอร์ชันเท่านั้น ไม่เอาค่าจากผู้ใช้ไปต่อเป็นพาธไฟล์ตรงๆ
    if not isinstance(model_id, str) or not VERSION_RE.match(model_id):
        raise ModelNotFound(f'model_id ไม่ถูกต้อง: {model_id}')
    exp_dir = find_experimental_dir()
    if exp_dir is None:
        raise ModelNotFound('ไม่พบโฟลเดอร์โมเดลทดลอง')
    return os.path.join(exp_dir, f'lightgbm_{model_id}.joblib')

_package_cache = {}

def load_package(model_id):
    """โหลดโมเดล + ข้อมูลประกอบ + SHAP explainer (โหลดครั้งเดียวแล้วเก็บแคช)"""
    path = model_path(model_id)
    if not os.path.isfile(path):
        raise ModelNotFound(f'ไม่พบไฟล์โมเดล: {model_id}')

    mtime = os.path.getmtime(path)
    cached = _package_cache.get(model_id)
    if cached and cached['mtime'] == mtime:
        return cached

    #โหลด package ที่รวมทุกอย่างไว้
    pkg = joblib.load(path)
    entry = {
        'mtime': mtime,
        'model': pkg['model'],
        'cat_features': pkg['cat_features'],
        'feature_cols': pkg['feature_cols'],
        'categories': pkg['categories'],
        'subdistrict_hist': pkg['subdistrict_hist'],
        'fill_val': pkg['fill_val'],
        'explainer': shap.TreeExplainer(pkg['model']),
        'meta': extract_meta(model_id, pkg),
    }
    _package_cache[model_id] = entry
    return entry

#โหลดโมเดลหลักตอนเริ่มระบบ (เหมือนเดิม ถ้าไฟล์หายจะรู้ตั้งแต่เปิด)
load_package(DEFAULT_MODEL_ID)

DAY_MAPPING = {
    'วันธรรมดา (จ.-ศ.)': 'normal_day',
    'วันเสาร์-อาทิตย์': 'weekend',
    'เทศกาลปีใหม่': 'new_year',
    'เทศกาลสงกรานต์': 'songkran'
}

@app.route('/models', methods=['GET'])
def list_models():
    """รายการโมเดลที่เลือกใช้พยากรณ์ได้: โมเดลหลัก + โมเดลทดลอง (ใหม่สุดขึ้นก่อน)"""
    try:
        models = [load_package(DEFAULT_MODEL_ID)['meta']]

        experimental = []
        exp_dir = find_experimental_dir()
        if exp_dir:
            for name in os.listdir(exp_dir):
                m = EXPERIMENTAL_FILE_RE.match(name)
                if not m:
                    continue
                try:
                    experimental.append(load_package(m.group(1))['meta'])
                except Exception as e:
                    print(f"Skip model file {name}: {e}")
        experimental.sort(key=lambda x: x['id'], reverse=True)

        return jsonify({"success": True, "models": models + experimental})
    except Exception as e:
        print("List Models Error:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        print("Received Data:", data)

        #เลือกโมเดล: ไม่ส่งมา = ใช้โมเดลหลัก
        model_id = data.get('model_id') or DEFAULT_MODEL_ID
        try:
            pkg = load_package(model_id)
        except ModelNotFound as e:
            return jsonify({"success": False, "message": str(e)}), 404

        model = pkg['model']
        cat_features = pkg['cat_features']
        feature_cols = pkg['feature_cols']
        categories = pkg['categories']
        subdistrict_hist = pkg['subdistrict_hist']
        fill_val = pkg['fill_val']
        explainer = pkg['explainer']

        province_code = data.get('province_code')
        district_code = data.get('district_code')
        subdistrict_code = data.get('subdistrict_code')
        time_period = data.get('time_period')

        raw_day_type = data.get('day_type')
        day_type = DAY_MAPPING.get(raw_day_type, raw_day_type)

        #จัดการค่า subdist_total_cases: ถ้าไม่มีค่าส่งมา ใช้ fill_val แทน (ไม่ใช้ 0)
        raw_cases = data.get('subdist_total_cases')
        if raw_cases is None or raw_cases == '':
            subdist_total_cases = fill_val
        else:
            subdist_total_cases = float(raw_cases)

        #ดึงค่า subdist_total_cases จาก subdistrict_hist แทนการนับจาก MySQL
        match = subdistrict_hist[subdistrict_hist['subdistrict_code'] == subdistrict_code]
        if not match.empty:
            subdist_total_cases = float(match['subdist_total_cases'].values[0])
        else:
            subdist_total_cases = fill_val

        row = {
            'province_code': province_code,
            'district_code': district_code,
            'subdistrict_code': subdistrict_code,
            'time_period': time_period,
            'day_type': day_type,
            'subdist_total_cases': subdist_total_cases
        }

        input_data = pd.DataFrame([row])

        #แปลงคอลัมน์ categorical ให้ตรงกับ categories ที่ใช้ตอนเทรน
        for col in cat_features:
            input_data[col] = pd.Categorical(input_data[col], categories=categories[col])

        #จัดเรียงคอลัมน์ตามลำดับที่โมเดลต้องการ
        input_data = input_data[feature_cols]

        #คำนวณผลทำนาย
        score = float(model.predict(input_data)[0])
        #โมเดลต้นไม้แบบถดถอยอาจให้ค่าเกินช่วงคะแนนเล็กน้อย (เช่น 100.79) จึงจำกัดไว้ที่ 0-100 ตามสเกลที่แสดง
        score = min(max(score, 0.0), 100.0)

        #คำนวณ SHAP Values
        shap_vals = explainer(input_data)
        shap_data = []
        for i, col in enumerate(input_data.columns):
            shap_data.append({
                "feature": col,
                "value": round(float(shap_vals.values[0][i]), 2)
            })

        risk_level = "High" if score >= 60 else ("Medium" if score >= 30 else "Low")

        return jsonify({
            "success": True,
            "risk_score": round(score, 2),
            "risk_level": risk_level,
            "shap_values": shap_data,
            "model_id": model_id
        })

    except Exception as e:
        print("Predict Error:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)