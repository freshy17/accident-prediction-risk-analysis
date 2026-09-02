import {useState, useEffect} from "react";
import NavBar from "../components/Navbar";
import FilterBar from "../components/FilterBar";
import SummaryCards from "../components/SummaryCards";
import MapView from "../components/MapView";
import Top10Chart from "../components/Top10Chart";
import HolidayCompareChart from "../components/HolidayCompareChart";
import RiskPrediction from "../components/RiskPrediction";

import {
    getSummaryData,
    getHotspotPoints,
    getTop10,
    getHolidayCompareData,
    getProvinceList
} from "../api/apiService";

const Dashboard = () => {

    const [activeTab, setActiveTab] = useState('dashboard');
    
    const initialFilters = {
        year: '2025',
        province: '',
        timeRange: '',
        dayType: ''
    };

    const [filters, setFilters] = useState(initialFilters);

    //state เก็บข้อมูลแต่ละส่วน
    const [provincesList, setProvincesList] = useState([]);
    const [summaryData, setSummaryData] =  useState(null);
    const [hotspots, setHotspots] =  useState([]);
    const [top10Data, setTop10Data] =  useState([]);
    const [holidayData, setHolidayData] =  useState([]);
    const [loading, setLoading] =  useState(false);

    useEffect(() => {
        const fetchProvinces = async () => {
            try {
                const res = await getProvinceList();
                const list = res?.data || res || [];
                setProvincesList(list);
            } catch (err) {
                console.error("Error fetching provinces:", err);
            }
        }
        fetchProvinces();
    }, []);

    //หาชื่อจังหวัดตาม province_code ที่ถูกเลือกใน Filter
    const selectedProvinceObj = provincesList.find(
        (p) => String(p.province_code || p.code  || '').trim() === String(filters.province || '').trim() 
    );
    const selectedProvinceName = selectedProvinceObj
        ? (selectedProvinceObj.pro_name_th || selectedProvinceObj.province_name ||selectedProvinceObj.name || '')
        : '';

    const isFiltered = Boolean(filters.province || filters.timeRange || filters.dayType);

    //ดึงข้อมูลใหม่ทุกครั้งที่ filters เปลี่ยน
    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {

                //ดึงข้อมูล 4 ส่วนพร้อมกันเพื่อความเร็ว
                const [summaryRes, hotspotRes, top10Res, holidayRes] = await Promise.all([
                    getSummaryData(filters).catch(err => { console.error("Summary API Error:", err); return null; }),
                    getHotspotPoints(filters.year, filters.province).catch(err => { console.error("Hotspot API Error:", err); return null; }),
                    getTop10(filters.year, filters.province).catch(err => { console.error("Top10 API Error:", err); return null; }),
                    getHolidayCompareData(filters.year, filters.province).catch(err => { console.error("Holiday API Error (404):", err); return null; })
                ]);

                const resData = summaryRes?.data || summaryRes;
                    if (resData) {
                        setSummaryData({
                            totalAccidents: resData.total_accidents || 0,
                            totalDeaths: resData.total_deaths || 0,
                            totalInjuries: resData.total_injuries || 0,
                            mostRiskyTime: resData.most_risky_time || "-",
                    });
                }

                if (hotspotRes) {
                    setHotspots(hotspotRes.data || hotspotRes);
                }

                if (top10Res) {
                    const data = top10Res.data?.data || top10Res.data || top10Res;
                    setTop10Data(data);
                }

                if (holidayRes) {
                    setHolidayData(holidayRes.data || holidayRes);
                }

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [filters]);

    const handleReset = () => {
        setFilters(initialFilters);
    };

    return (
        <div>
            <NavBar />
            <main className="dashboard-container">
                {/* Tap Bar สลับ Dashboard กับ Risk Prediction */}
                <div style={{ 
                    display: 'flex', 
                    width: '100%', 
                    marginBottom: '1.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    }}>
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            border: activeTab === 'dashboard' ? '1px solid #475569' : '1px solid #cbd5e1',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'dashboard' ? '#475569' : '#ffffff',
                            color: activeTab === 'dashboard' ? '#ffffff' : '#475569',
                            boxShadow: activeTab === 'dashboard' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('prediction')}
                        style={{
                           flex: 1,
                            padding: '12px 16px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            border: activeTab === 'prediction' ? '1px solid #475569' : '1px solid #cbd5e1',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'prediction' ? '#475569' : '#ffffff',
                            color: activeTab === 'prediction' ? '#ffffff' : '#475569',
                            boxShadow: activeTab === 'prediction' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Risk Prediction
                    </button>
                </div>
                
                {/* เงื่อนไขการสลับหน้าตาม Tap ที่เลือก */}
                {activeTab === 'dashboard' ? (
                    <>
                        <FilterBar
                            filters={filters}
                            setFilters={setFilters}
                            onReset={handleReset}
                        />
                        <SummaryCards 
                            isFiltered={isFiltered}
                            data={summaryData}
                            loading={loading}
                        />
                        <div className="dashboard-grid">
                            {/* ส่งข้อมูลลง Components เพื่อนำไปวาดหมุดและกราฟ */}
                            <MapView filters={filters} data={hotspots} loading={loading} />
                            <Top10Chart data={top10Data} filters={filters} loading={loading}/>
                        </div>
                        <HolidayCompareChart 
                            data={holidayData} 
                            filters={filters} 
                            provinceName={selectedProvinceName} 
                            loading={loading} 
                        />
                    </>
                ) : (
                    <RiskPrediction />
                )}
            </main>
        </div>
    );
};

export default Dashboard;