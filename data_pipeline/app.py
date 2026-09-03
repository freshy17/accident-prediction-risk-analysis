from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import shap
import os

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

#โหลด Model และ Encoders ทั้งหมดให้ครบ
model = joblib.load(os.path.join(BASE_DIR, 'lightgbm_native_model.pkl'))
weather_encoder = joblib.load(os.path.join(BASE_DIR, 'weather_type.pkl'))
time_encoder = joblib.load(os.path.join(BASE_DIR, 'time_type.pkl'))
day_encoder = joblib.load(os.path.join(BASE_DIR, 'day_type.pkl'))

explainer = shap.TreeExplainer(model)

#Map คำภาษาไทยจากหน้าเว็บ React ให้ตรงกับ Key ภาษาอังกฤษ
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

        lat = float(data['latitude'])
        lng = float(data['longitude'])
        weather = data['weather']
        time_period = data['timeRange']
        
        raw_day_type = data['dayType']
        day_type = DAY_MAPPING.get(raw_day_type, raw_day_type)

        #สร้าง DataFrame เริ่มต้น
        input_data = pd.DataFrame({
            'latitude': [lat],
            'longitude': [lng],
            'weather': pd.Categorical([weather], dtype=weather_encoder),
            'time_period': pd.Categorical([time_period], dtype=time_encoder),
            'day_type': pd.Categorical([day_type], dtype=day_encoder)
        })

        #จัดเรียงลำดับคอลัมน์ตามที่โมเดล LightGBM บังคับไว้ (ดึงจากตัวโมเดลโดยตรง)
        if hasattr(model, 'feature_name_'):
            input_data = input_data[model.feature_name_]

        #คำนวณผลทำนาย
        score = float(model.predict(input_data)[0])

        #คำนวณ SHAP Values
        shap_vals = explainer(input_data)
        shap_data = [
            {"feature": "latitude", "value": round(float(shap_vals.values[0][0]), 2)},
            {"feature": "longitude", "value": round(float(shap_vals.values[0][1]), 2)},
            {"feature": weather, "value": round(float(shap_vals.values[0][2]), 2)},
            {"feature": time_period, "value": round(float(shap_vals.values[0][3]), 2)},
            {"feature": raw_day_type, "value": round(float(shap_vals.values[0][4]), 2)},
        ]

        risk_level = "High" if score >= 70 else ("Medium" if score >= 40 else "Low")

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