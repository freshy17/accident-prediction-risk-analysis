import { useState, useEffect } from "react";
import { getFilterOptions, getDistrictsByProvinceCode } from "../api/apiService";

const DAY_TYPE_MAP = {
  'normal_day': 'วันธรรมดา (จ.-ศ.)',
  'weekend': 'วันหยุดสุดสัปดาห์ (ส.-อา.)',
  'new_year': 'เทศกาลปีใหม่',
  'songkran': 'เทศกาลสงกรานต์'
};

function RiskPrediction() {
    const [options, setOptions] = useState({
        provinces: [],
        timeRanges: [],
        dayTypes: [],
        weathers: []
    });

    const [districts, setDistricts] = useState([]);
    const [loadingDistricts, setLoadingDistricts] = useState(false);

    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        province_code: '',
        district_code: '',
        timeRange: '',
        dayType: '',
        weather: ''
    });

    //โหลดตัวเลือกหลักทั้งหมดเมื่อหน้าเว็บเริ่มทำงาน
    useEffect(() => {
        const fetchInitialOptions = async () => {
            try {
                const data = await getFilterOptions();
                const provinces = data?.provinces || [];
                const timeRanges = data?.timeRanges || [];
                const dayTypes = data?.dayTypes || [];
                const weathers = data?.weathers || [];

                setOptions({ provinces, timeRanges, dayTypes, weathers });

                //กำหนดค่าเริ่มต้นถ้ามีข้อมูล
                setFormData(prev => ({
                    ...prev,
                    province_code: '',
                    district_code: '',
                    timeRange: '',
                    dayType: '',
                    weather: ''
                }));

            } catch (err) {
                console.error("Error fetching options:", err);
            }
        };
        fetchInitialOptions();
    }, []);

    //ดึงรายชื่ออำเภอใหม่ทุกครั้งที่เลือกจังหวัดใหม่
    useEffect(() => {
        const fetchDistricts = async () => {
            if (!formData.province_code) {
                setDistricts([]);
                setFormData(prev => ({ ...prev, district_code: '' }));
                return;
            }
            try {
                setLoadingDistricts(true);
                const districtData = await getDistrictsByProvinceCode(formData.province_code);
                setDistricts(districtData || []);

                const list = Array.isArray(districtData) ? districtData : [];
                 setDistricts(list);

                setFormData(prev => ({
                ...prev, 
                district_code: ''
            }));
            } catch (err) {
                console.error("Error fetching districts:", err);
            } finally {
                setLoadingDistricts(false);
            }
        };
        fetchDistricts();
    }, [formData.province_code])

    const [result, setResult] = useState({
        score: 78,
        level: 'High',
        shapeValues: [
            { label: 'ช่วงเทศกาลสงกราต์', value: 28, type: 'positive'},
            { label: 'ช่วงเวลาดึก', value: 18, type: 'positive' },
            { label: 'ถนนสายหลัก (4 เลน)', value: 9, type: 'positive' },
            { label: 'สภาพอากาศแห้ง/ปกติ', value: -5, type: 'negative' },
            { label: 'มีไฟส่องสว่างชัดเจน', value: -3, type: 'negative' },
        ],
        recommendation: 'ปัจจัยหลักที่ทำให้ความเสี่ยงสูงคือช่วงเวลาเทศกาลร่วมกับเวลาวิกลกาล ควรตั้งด่านตรวจความเร็วและกวดขันวินัยจราจรอย่างเข้มงวด',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePredict = async () => {
        setLoading(true);
        setTimeout(() => setLoading(false), 500);
    };

    return (
        <div className="risk-prediction-container">
            {/* ฝั่งซ้าย ฟอร์มเลือกปัจจัย */}
            <div className="predict-form-card">
                {/* จังหวัด */}
                <div className="form-group">
                    <label className="form-label">จังหวัด</label>
                    <select 
                        name="province_code" 
                        value={formData.province_code} 
                        onChange={handleChange} 
                        className="form-select"
                    >
                        <option value="">--ทั้งหมด--</option>
                        {options.provinces.map((p) => (
                            <option key={p.province_code} value={p.province_code}>
                                {p.pro_name_th}
                            </option>
                        ))}
                    </select>
                </div>

                {/* อำเภอ */}
                <div className="form-group">
                    <label className="form-label">อำเภอ</label>
                    <select 
                        name="district_code" 
                        value={formData.district_code} 
                        onChange={handleChange} 
                        className="form-select"
                        disabled={!formData.province_code || loadingDistricts}
                    >
                        {!formData.province_code ? (
                            <option value="">-- กรุณาเลือกจังหวัดก่อน --</option>
                        ) : loadingDistricts ? (
                            <option value="">(กำลังโหลดอำเภอ...)</option>
                        ) : districts.length > 0 ? (
                            <>
                                <option value="">--ทั้งหมด--</option>
                                {districts.map((d) => (
                                    <option key={d.district_code} value={d.district_code}>
                                        {d.dis_name_th}
                                    </option>
                                ))}
                            </>
                        ) : (
                            <option value="">-- ไม่มีข้อมูลอำเภอ --</option>
                        )}
                    </select>
                </div>

                {/* ช่วงเวลา */}
               <div className="form-group">
                    <label className="form-label">ช่วงเวลา</label>
                    <select 
                        name="timeRange" 
                        value={formData.timeRange} 
                        onChange={handleChange} 
                        className="form-select"
                    >
                        <option value="">-- เลือกช่วงเวลา --</option>
                        {options.timeRanges.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {/* ประเภทวัน */}
                <div className="form-group">
                    <label className="form-label">ประเภทวัน</label>
                    <select 
                        name="dayType" 
                        value={formData.dayType} 
                        onChange={handleChange} 
                        className="form-select"
                    >
                        <option value="">-- เลือกประเภทวัน --</option>
                        {options.dayTypes.map((d) => (
                            <option key={d} value={d}>
                                {DAY_TYPE_MAP[d] || d}
                            </option>
                        ))}
                    </select>
                </div>

               <div className="form-group">
                    <label className="form-label">สภาพอากาศ</label>
                    <select 
                    name="weather" 
                    value={formData.weather} 
                    onChange={handleChange} 
                    className="form-select"
                >
                        <option value="">-- เลือกสภาพอากาศ --</option>
                        {options.weathers.map((w) => (
                            <option key={w} value={w}>{w}</option>
                        ))}
                    </select>
                </div>

                <button onClick={handlePredict} disabled={loading} className="btn-predict">
                    🔍 {loading ? 'กำลังประมวลผล...' : 'Risk Prediction'}
                </button>
            </div>

                {/* ฝั่งขวา แสดงผล */}
                <div className="predict-result-wrapper">
                    {/* Card 1: Risk Score */}
                    <div className="risk-score-card">
                        <h3 className="risk-score-title">ผลการพยากรณ์ความเสี่ยง</h3>
                        <div className="score-display-group">
                            <div>
                                <span className="text-gray-600 text-sm">Risk Score : </span>
                                <span className="score-text-big">{result.score}/100</span>
                            </div>
                            <div>
                                <span className="text-gray-600 text-sm">ระดับความเสี่ยง : </span>
                                <span className="risk-level-high">{result.level}</span>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: SHAP Value */}
                    <div className="shap-card">
                        <h3 className="shap-title">ปัจจัยที่มีผลต่อการพยากรณ์ (SHAP Values)</h3>
                        <div className="shap-list">
                            {result.shapeValues.map((item, idx) => (
                                <div key={idx} className="shap-item">
                                    <div className="shap-label-side">
                                        <span className={item.type === 'positive' ? 'dot-positive' : 'dot-negative'} />
                                        <span>{item.label}</span>
                                    </div>
                                    <div className="shap-bar-side">
                                        <div className="bar-bg">
                                            <div
                                                className={item.type === 'positive' ? 'bar-fill-positive' : 'bar-fill-negative'}
                                                style={{ width: `${Math.abs(item.value) * 3}%` }}
                                            />
                                        </div>
                                        <span className={item.type === 'positive' ? 'shap-val-pos' : 'shap-val-neg'}>
                                            {item.value > 0 ? `+${item.value}` : item.value}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Card 3: Recommendation */}
                    <div className="recommend-card">
                        <h3 className="recommend-title">ข้อเสนอแนะ</h3>
                        <p className="recommend-text">{result.recommendation}</p>
                    </div>
                </div>
        </div>
    );
}

export default RiskPrediction;