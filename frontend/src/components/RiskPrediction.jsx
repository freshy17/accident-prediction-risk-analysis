import { useState, useEffect } from "react";
import { getFilterOptions, getDistrictsByProvinceCode, getRiskPrediction, getSubdistrictsByDistrictCode } from "../api/apiService";

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
    });

    const [districts, setDistricts] = useState([]);
    const [subdistricts, setSubdistricts] = useState([]);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");


    const [formData, setFormData] = useState({
        province_code: '',
        district_code: '',
        subdistrict_code: '',
        timeRange: '',
        dayType: '',
        subdist_total_cases: 0
    });

    const [result, setResult] = useState(null);

    //โหลดตัวเลือกทั้งหมดครั้งเดียวตอนเปิดหน้าเว็บ
    useEffect(() => {
        const fetchInitialOptions = async () => {
            try {
                const response = await getFilterOptions();
                console.log("Filter Options Response:", response); 
                
                // ดึงข้อมูลจาก response เผื่อถูกครอบด้วย data อีกชั้น
                const resultData = response?.data || response; 

                setOptions({
                    provinces: resultData?.provinces || [],
                    timeRanges: resultData?.timeRanges || [],
                    dayTypes: resultData?.dayTypes || [],
                });
            } catch (err) {
                console.error("Error fetching options:", err);
            }
        };
        fetchInitialOptions();
    }, []);

    //โหลดรายชื่ออำเภอทันทีที่เปืดหน้ามาแล้วมีจังหวัดเลือกค้างอยู่
    useEffect(() => {
        const fetchDistrictsOnload = async () => {
            if (!formData.province_code) return;
            try {
                setLoadingDistricts(true);
                const districtData = await getDistrictsByProvinceCode(formData.province_code);
                const list = Array.isArray(districtData) ? districtData : [];
                setDistricts(list);

                //ตรวจสอบว่า district_code ที่ค้างอยู่ใน sessionStorage มีอยู่ในรายชื่ออำเภอนั้นจริงๆไหม
                const savedData = sessionStorage.getItem('risk_form_data');
                if(savedData) {
                    const parsed = JSON.parse(savedData);
                    if(parsed.district_code) {
                        const exists = list.some(d => String(d.district_code) === String(parsed.district_code));
                        if(exists) {
                            setFormData(prev => ({ ...prev, district_code: parsed.district_code}));
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching districts:", err);
            } finally {
                setLoadingDistricts(false);
            }
        };
        fetchDistrictsOnload();
    }, [formData.province_code]);

    const handleChange =  async (e) => {
        const {name, value} = e.target;

        if(name === 'province_code') {
            //ถ้าเปลี่ยนจังหวัด ให้ Reset อำเภอ ตำบล และจำนวนอุบัติเหตุในตำบล
            setFormData(prev => ({
                ...prev,
                province_code: value,
                district_code: '',
                subdistrict_code: '',
                subdist_total_cases: 0
            }));
            setSubdistricts([]);

            if(!value) {
                setDistricts([]);
            } else {
                setLoadingDistricts(true);
                try {
                    const districtData = await getDistrictsByProvinceCode(value);
                    console.log("District Data from API:", districtData);
                    setDistricts(Array.isArray(districtData) ? districtData : []);
                } catch (err) {
                    console.error("Error fetching districts:", err);
                } finally {
                    setLoadingDistricts(false);
                }
            }
        } else if (name === 'district_code') {
            //เปลี่ยนอำเภอ ให้ Reset ตำบล และจำนวนอุบัติเหตุในตำบล แล้วดึงรายชื่อตำบลใหม่
            setFormData(prev => ({
                ...prev,
                district_code: value,
                subdistrict_code: '',
                subdist_total_cases: 0
            }));
            setSubdistricts([]);

            if(!value) {
                setSubdistricts([]);
            } else {
                try {
                    const subData = await getSubdistrictsByDistrictCode(value);
                    setSubdistricts(Array.isArray(subData) ? subData : []);
                } catch (err) {
                    console.error("Error fetching subdistricts:", err);
                } finally {
                    setLoadingSubdistricts(false);
                }
            }
        }
        else if (name === 'subdistrict_code') {
            //เลือกตำบล -> ให้ดึงค่า subdist_total_cases ของตำบลนั้นมาเก็บไว้
            const selectedSub = subdistricts.find(s => String(s.subdistrict_code) === String(value));
            setFormData(prev => ({
                ...prev,
                subdistrict_code: value,
                subdist_total_cases: selectedSub ? Number(selectedSub.subdist_total_cases) : 0
            }));
        }
        else {
            setFormData(prev => ({...prev, [name]: value}));
        }
};
    const handlePredict = async () => {
        if (!formData.district_code || !formData.subdistrict_code || !formData.timeRange || !formData.dayType) {
            alert("กรุณากรอกข้อมูลเงื่อนไขให้ครบถ้วนก่อนทำการพยากรณ์");
            return;
        }
        setLoading(true);
        setError("");

        //แพ็คข้อมูลส่งให้หลังบ้าน
        try {
            const payload = ({
                province_code: formData.province_code,
                district_code: formData.district_code,
                subdistrict_code: formData.subdistrict_code,
                timeRange: formData.timeRange,
                dayType: formData.dayType,
                subdist_total_cases: formData.subdist_total_cases
            })

            const data = await getRiskPrediction(payload);

            if (data.success) {
                //แปลง shap_values จาก API ให้เข้ากับ UI 
                const formattedShap = data.shap_values.map(item => ({
                    label: item.feature,
                    value: item.value,
                    type: item.value >= 0 ? 'positive' : 'negative'
                }));

                let recText = "ระดับความเสี่ยงอยู่ในเกณฑ์ต่ำ ควรขับขี่ด้วยความไม่ประมาทและปฏิบัติตามกฎจราจรในช่วงเวลาที่เลือก";
                if (data.risk_level === 'High') {
                    recText = "ระดับความเสี่ยงสูงมาก! ควรเพิ่มความระมัดระวังในการเดินทางสูงสุดในช่วงเวลาและประเภทวันที่เลือก พร้อมกวดขันวินัยจราจรและตรวจสอบจุดเสี่ยงในพื้นที่";
                } else if (data.risk_level === 'Medium') {
                    recText = "มีความเสี่ยงปานกลาง ควรเพิ่มความระมัดระวังเป็นพิเศษในการขับขี่ตามช่วงเวลาและประเภทวันที่เลือก เพื่อป้องกันอุบัติเหตุในพื้นที่";
                }

                setResult({
                    score: data.risk_score,
                    level: data.risk_level,
                    shapeValues: formattedShap,
                    recommendation: recText
                });
            } else {
                setError(data.message || "เกิดข้อผิดพลาดในการพยากรณ์");
            }
        } catch (error) {
            console.error("Predict failed:", error);
            setError("ไม่สามารถเชื่อมต่อระบบพยากรณ์ได้ กรุณาลองใหม่อีกครั้ง")
        } finally {
            setLoading(false);
        }
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

                {/* ตำบล (แล้วแนบจำนวนอุบัติเหตุในตำบลนั้นๆไปด้วย) */}
                 <div className="form-group">
                    <label className="form-label">ตำบล</label>
                    <select 
                        name="subdistrict_code" 
                        value={formData.subdistrict_code} 
                        onChange={handleChange} 
                        className="form-select"
                        disabled={!formData.district_code || loadingSubdistricts}
                    >
                        {!formData.district_code ? (
                            <option value="">-- กรุณาเลือกอำเภอก่อน --</option>
                        ) : loadingSubdistricts ? (
                            <option value="">(กำลังโหลดตำบล...)</option>
                        ) : subdistricts.length > 0 ? (
                            <>
                                <option value="">-- เลือกตำบล --</option>
                                {subdistricts.map((s) => (
                                    <option key={s.subdistrict_code} value={s.subdistrict_code}>
                                        {s.sub_name_th}
                                    </option>
                                 ))}
                            </>
                        ) : (
                            <option value="">-- ไม่มีข้อมูลตำบล --</option>
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

                <button onClick={handlePredict} disabled={loading} className="btn-predict">
                    🔍 {loading ? '(กำลังประมวลผล...)' : 'Risk Prediction'}
                </button>

                {error && <p style={{ color: 'red', marginTop: '10px', fontSize: '14px' }}>{error}</p>}
            </div>

                {/* ฝั่งขวา แสดงผล */}
                <div className="predict-result-wrapper">
                    {result ? (
                        <>
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
                                            <span className={
                                                result.level === 'High' ? 'risk-level-high' : 
                                                result.level === 'Medium' ? 'risk-level-medium' : 'risk-level-low'
                                            }>
                                                {result.level}
                                            </span>
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
                                                            style={{ width: `${Math.min(Math.abs(item.value) * 5, 100)}%` }}
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
                        </>
                    ) : (
                        <div className="risk-score-card" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        <h3>👈 เลือกเงื่อนไขปัจจัยทางด้านซ้ายแล้วกด "Risk Prediction" เพื่อประเมินความเสี่ยง</h3>
                    </div>
                    )} 
                </div>
        </div>
    );
}

export default RiskPrediction;