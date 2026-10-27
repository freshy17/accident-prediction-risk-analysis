import { useState, useEffect, useRef } from "react";
import { getFilterOptions, getDistrictsByProvinceCode, getRiskPrediction, getSubdistrictsByDistrictCode, getRiskExplanation, getRiskModels } from "../api/apiService";

const DAY_TYPE_MAP = {
  'normal_day': 'วันธรรมดา (จ.-ศ.)',
  'weekend': 'วันหยุดสุดสัปดาห์ (ส.-อา.)',
  'new_year': 'เทศกาลปีใหม่',
  'songkran': 'เทศกาลสงกรานต์'
};
 
const FEATURE_LABELS = {
  province_code: 'จังหวัด',
  district_code: 'อำเภอ',
  subdistrict_code: 'ตำบล',
  time_period: 'ช่วงเวลา',
  day_type: 'ประเภทวัน',
  subdist_total_cases: 'จำนวนอุบัติเหตุสะสมในตำบล',
};

//โมเดลหลักที่ใช้งานจริง (ค่าเริ่มต้นของ dropdown เลือกโมเดล)
const DEFAULT_MODEL_ID = 'default';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

//[2021, 2022, 2023] -> "2021-2023"
const formatYears = (years) => {
  if (!years || years.length === 0) return '-';
  const sorted = [...years].sort((a, b) => a - b);
  return sorted.length === 1 ? String(sorted[0]) : `${sorted[0]}-${sorted[sorted.length - 1]}`;
};

//"2026-10-22T11:56:33" -> "22 ต.ค. 2569 11:56"
const formatModelTime = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
  if (!m) return '';
  return `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543} ${m[4]}:${m[5]}`;
};

//ชื่อที่แสดงใน dropdown
const getModelLabel = (model) => {
  if (!model || model.is_default) return 'โมเดลหลัก (v1)';
  const time = formatModelTime(model.created_at);
  return time ? `โมเดลทดลอง ${time}` : `โมเดลทดลอง ${model.id}`;
};

//รายละเอียดใต้ dropdown (ปีที่ใช้เทรน/ทดสอบ และค่าวัดผล) ให้ผู้ใช้เปรียบเทียบได้
const getModelDetail = (model) => {
  if (!model || model.is_default) return 'โมเดลที่ใช้งานจริงของระบบ';
  const parts = [
    `เทรนด้วยปี ${formatYears(model.train_years)}`,
    `ทดสอบด้วยปี ${formatYears(model.test_years)}`,
  ];
  const metrics = model.metrics;
  if (metrics && metrics.test_r2 != null) parts.push(`Test R² ${metrics.test_r2.toFixed(4)}`);
  if (metrics && metrics.test_mae != null) parts.push(`MAE ${metrics.test_mae.toFixed(2)}`);
  return parts.join(' · ');
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

    //ค่าที่ผู้ใช้เลือกในฟอร์ม  
    const [formData, setFormData] = useState({
        province_code: '',
        district_code: '',
        subdistrict_code: '',
        timeRange: '',
        dayType: '',
        subdist_total_cases: 0
    });

    const [result, setResult] = useState(null);

    //รายการโมเดลที่เลือกได้ และโมเดลที่เลือกอยู่
    const [models, setModels] = useState([]);
    const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
    
    //ข้อสนอแนะที่ AI สร้าง
    const [explanation, setExplanation] = useState('');
    const [explaining, setExplaining] = useState(false);
    const explainReqId = useRef(0);

const fetchExplanation = async (data) => {
    const reqId = ++explainReqId.current;
    setExplanation('');
    setExplaining(true);
    try {
        const provinceName = options.provinces.find(p => String(p.province_code) === String(formData.province_code))?.pro_name_th;
        const districtName = districts.find(d => String(d.district_code) === String(formData.district_code))?.dis_name_th;
        const subdistrictName = subdistricts.find(s => String(s.subdistrict_code) === String(formData.subdistrict_code))?.sub_name_th;

        const res = await getRiskExplanation({
            province_code: formData.province_code,
            province_name: provinceName,
            district_code: formData.district_code,
            district_name: districtName,
            subdistrict_code: formData.subdistrict_code,
            subdistrict_name: subdistrictName,
            time_period: formData.timeRange,
            day_type: formData.dayType,
            subdist_total_cases: formData.subdist_total_cases,
            risk_score: data.risk_score,
            risk_level: data.risk_level,
            shap_values: data.shap_values
        });
        if (reqId === explainReqId.current && res.success) setExplanation(res.explanation);
    } catch (err) {
        console.error("Explain failed:", err);
    } finally {
        if (reqId === explainReqId.current) setExplaining(false);
    }
};

    //โหลดรายการโมเดลทั้งหมดที่มี 
    const loadModels = async () => {
        try {
            const res = await getRiskModels();
            if (res?.success && Array.isArray(res.models)) {
                setModels(res.models);
                //ถ้าโมเดลที่เลือกค้างไว้ถูกลบไปแล้ว ให้กลับไปใช้โมเดลหลัก
                setSelectedModelId(prev => res.models.some(m => m.id === prev) ? prev : DEFAULT_MODEL_ID);
            }
        } catch (err) {
            console.error("Error fetching models:", err);
        }
    };

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
        loadModels();
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
                setLoadingSubdistricts(true);
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
                subdist_total_cases: formData.subdist_total_cases,
                model_id: selectedModelId
            })

            const data = await getRiskPrediction(payload);

            if (data.success) {
                //แปลง shap_values จาก API ให้เข้ากับ UI
                const formattedShap = data.shap_values
                    .map(item => ({
                        label: FEATURE_LABELS[item.feature] ?? item.feature, // ?? item.feature คือถ้ามีปัจจัยใหม่ที่ยังไม่ได้กำหนดไว้ ให้แสดงชื่อเดิมแทนที่จะเป็นค่าว่าง
                        value: item.value,
                        type: item.value >= 0 ? 'positive' : 'negative'
                    }))
                    .sort((a, b) => {
                        //สีแดง (บวก) ขึ้นก่อนสีเขียว (ลบ)
                        if (a.type !== b.type) return a.type === 'positive' ? -1 : 1;
                        //ในกลุ่มเดียวกัน เรียงตามขนาดค่าจากมากไปน้อย
                        return Math.abs(b.value) - Math.abs(a.value);
                    });

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
                    recommendation: recText,
                    //เก็บชื่อโมเดลที่ใช้ทำนายครั้งนี้ไว้แสดงในผลลัพธ์
                    modelLabel: getModelLabel(models.find(m => m.id === selectedModelId))
                });
                fetchExplanation(data);
            } else {
                setError(data.message || "เกิดข้อผิดพลาดในการพยากรณ์");
            }
        } catch (error) {
            console.error("Predict failed:", error);
            if (error.response?.status === 404) {
                //โมเดลที่เลือกไม่มีอยู่แล้ว ให้โหลดรายการใหม่
                setError("ไม่พบโมเดลที่เลือก (อาจถูกลบไปแล้ว) กรุณาเลือกโมเดลใหม่");
                loadModels();
            } else {
                setError("ไม่สามารถเชื่อมต่อระบบพยากรณ์ได้ กรุณาลองใหม่อีกครั้ง")
            }
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

                {/* เลือกโมเดลที่ใช้พยากรณ์ (โมเดลหลัก หรือโมเดลทดลองที่รีเทรนไว้) */}
                <div className="form-group">
                    <label className="form-label">โมเดลที่ใช้พยากรณ์</label>
                    <select
                        name="model_id"
                        value={selectedModelId}
                        onChange={(e) => setSelectedModelId(e.target.value)}
                        onFocus={loadModels}
                        className="form-select"
                    >
                        {models.length === 0 ? (
                            <option value={DEFAULT_MODEL_ID}>{getModelLabel(null)}</option>
                        ) : (
                            models.map((m) => (
                                <option key={m.id} value={m.id}>{getModelLabel(m)}</option>
                            ))
                        )}
                    </select>
                    <p className="model-detail">
                        {getModelDetail(models.find(m => m.id === selectedModelId))}
                    </p>
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
                                <div className="result-model-note">
                                    ผลจาก: {result.modelLabel}
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
                                <h3 className="recommend-title">ข้อเสนอแนะในการป้องกัน</h3>
                                {explaining ? (
                                    <p className="recommend-text">กำลังสร้างข้อเสนอแนะจาก AI...</p>
                                ) : explanation ? (
                                    <div className="recommend-text">
                                        {explanation.split('\n').map((line, i) => {
                                            const t = line.trim();
                                            if (!t) return null;
                                            return <div key={i} style={{ marginBottom: 6 }}>{t}</div>;
                                        })}
                                    </div>
                                ) : (
                                    <p className="recommend-text">{result.recommendation}</p>
                                )}
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
