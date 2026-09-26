# from flask import Flask, request, jsonify
# from flask_cors import CORS
# import joblib
# import pandas as pd
# import shap
# import os

# app = Flask(__name__)
# CORS(app)

# BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# #โหลด Model และ Encoders ที่ใช้สำหรัยโมเดลใหม่
# model = joblib.load(os.path.join(BASE_DIR, 'new_lightgbm_risk_model.pkl'))
# time_encoder = joblib.load(os.path.join(BASE_DIR, 'time_type.pkl'))
# day_encoder = joblib.load(os.path.join(BASE_DIR, 'day_type.pkl'))

# explainer = shap.TreeExplainer(model)

# #Map คำภาษาไทยจากหน้าเว็บ React ให้ตรงกับ Key ภาษาอังกฤษ
# DAY_MAPPING = {
#     'วันธรรมดา (จ.-ศ.)': 'normal_day',
#     'วันเสาร์-อาทิตย์': 'weekend',
#     'เทศกาลปีใหม่': 'new_year',
#     'เทศกาลสงกรานต์': 'songkran'
# }

# @app.route('/predict', methods=['POST'])
# def predict():
#     try:
#         data = request.json
#         print("Received Data:", data)
        
#         province_code = data.get('province_code')
#         district_code = data.get('district_code')
#         subdistrict_code = data.get('subdistrict_code')
#         time_period = data.get('time_period')
#         subdist_total_cases = float(data.get('subdist_total_cases', 0))
        
#         raw_day_type = data.get('day_type')
#         day_type = DAY_MAPPING.get(raw_day_type, raw_day_type)

#         #สร้าง DataFrame ให้ตรงกับโครงสร้างคอลัมน์ใหม่ที่ใช้เทรน
#         input_data = pd.DataFrame({
#             'province_code': [province_code],
#             'district_code': [district_code],
#             'subdistrict_code': [subdistrict_code],
#             'time_period': pd.Categorical([time_period], dtype=time_encoder),
#             'day_type': pd.Categorical([day_type], dtype=day_encoder),
#             'subdist_total_cases': [subdist_total_cases]
#         })

#         #จัดเรียงลำดับคอลัมน์ตามที่โมเดล LightGBM บังคับไว้ (ดึงจากตัวโมเดลโดยตรง)
#         if hasattr(model, 'feature_name_'):
#             input_data = input_data[model.feature_name_]
            
#         #คำนวณผลทำนาย
#         score = float(model.predict(input_data)[0])

#         #คำนวณ SHAP Values
#         shap_vals = explainer(input_data)
#         shap_data = []
#         for i, col in enumerate(input_data.columns):
#             shap_data.append({
#                 "feature": col,
#                 "value": round(float(shap_vals.values[0][i]), 2)
#             })

#         risk_level = "High" if score >= 60 else ("Medium" if score >= 30 else "Low")

#         return jsonify({
#             "success": True,
#             "risk_score": round(score, 2),
#             "risk_level": risk_level,
#             "shap_values": shap_data
#         })

#     except Exception as e:
#         print("Predict Error:", str(e))
#         return jsonify({"success": False, "error": str(e)}), 500

# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=8001, debug=True)

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import shap
import os

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

#โหลด package ที่รวมทุกอย่างไว้
model_package = joblib.load(os.path.join(BASE_DIR, 'new_lightgbm_risk_model.pkl'))

model = model_package['model']
cat_features = model_package['cat_features']
feature_cols = model_package['feature_cols']
categories = model_package['categories']
q95 = model_package['q95']
min_s = model_package['min_s']
fill_val = model_package['fill_val']

explainer = shap.TreeExplainer(model)

DAY_MAPPING = {
    'วันธรรมดา (จ.-ศ.)': 'normal_day',
    'วันเสาร์-อาทิตย์': 'weekend',
    'เทศกาลปีใหม่': 'new_year',
    'เทศกาลสงกรานต์': 'songkran'
}

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        print("Received Data:", data)
        
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

        #⚠️ ต้องเช็คให้ชัวร์ว่ามีการ scale ค่านี้ตอนเทรนหรือไม่ (ดูจาก notebook)
        #ถ้ามี อาจจะต้องทำแบบนี้ก่อนใส่เข้าโมเดล:
        # subdist_total_cases = min(subdist_total_cases, q95)  # clip ที่ q95
        # subdist_total_cases = (subdist_total_cases - min_s) / (q95 - min_s)  # normalize

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
            "shap_values": shap_data
        })

    except Exception as e:
        print("Predict Error:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)