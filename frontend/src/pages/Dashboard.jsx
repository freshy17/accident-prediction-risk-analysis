import {useState, useEffect} from "react";
import NavBar from "../components/Navbar";
import FilterBar from "../components/FilterBar";
import SummaryCards from "../components/SummaryCards";
import MapView from "../components/MapView";
import Top10Chart from "../components/Top10Chart";
import HolidayCompareChart from "../components/HolidayCompareChart";
import RiskPrediction from "../components/RiskPrediction";
import AdminLogin from "../components/AdminLogin";
import AdminUpload from "../components/AdminUpload";

import {
    getSummaryData,
    getHotspotPoints,
    getTop10,
    getHolidayCompareData,
    getProvinceList
} from "../api/apiService";

const Dashboard = () => {

    //จำแท็บที่เปิดอยู่ไว้ใน sessionStorage เพื่อให้รีเฟรชแล้วอยู่หน้าเดิม
    const [activeTab, setActiveTab] = useState(() => {
        const saved = sessionStorage.getItem('activeTab') || 'dashboard';
        //หน้า upload ต้องมี token ถ้าไม่มีให้กลับหน้าแรก
        if (saved === 'upload' && !sessionStorage.getItem('adminToken')) return 'dashboard';
        return saved;
    });
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
        () => !!sessionStorage.getItem('adminToken')
    );

    useEffect(() => {
        sessionStorage.setItem('activeTab', activeTab);
    }, [activeTab]);

    const initialFilters = {
        year: '',
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
        if (!filters.year) return;
        let cancelled = false;

        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const [summaryRes, hotspotRes, top10Res, holidayRes] = await Promise.all([
                    getSummaryData(filters).catch(err => { console.error("Summary API Error:", err); return null; }),
                    getHotspotPoints(filters.year, filters.province).catch(err => { console.error("Hotspot API Error:", err); return null; }),
                    getTop10(filters.year, filters.province).catch(err => { console.error("Top10 API Error:", err); return null; }),
                    getHolidayCompareData(filters.year, filters.province).catch(err => { console.error("Holiday API Error:", err); return null; })
                ]);
                if (cancelled) return;

                const resData = summaryRes?.data || summaryRes;
                if (resData) {
                    setSummaryData({
                        totalAccidents: resData.total_accidents || 0,
                        totalDeaths: resData.total_deaths || 0,
                        totalInjuries: resData.total_injuries || 0,
                        mostRiskyTime: resData.most_risky_time || "-",
                    });
                }
                if (hotspotRes) setHotspots(hotspotRes.data || hotspotRes);
                if (top10Res) setTop10Data(top10Res.data?.data || top10Res.data || top10Res);
                if (holidayRes) setHolidayData(holidayRes.data || holidayRes);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchDashboardData();
        return () => { cancelled = true; };
    }, [filters]);

    const handleReset = () => {
        setFilters(initialFilters);
    };

    const handleLoginSuccess = () => {
        alert('เข้าสู่ระบบแอดมินสำเร็จ:)')
        setIsAdminLoggedIn(true);
        setActiveTab('upload');
    };

    const handleTabChange = (tab) => {
        if (activeTab === 'upload' && tab !== 'upload') {
            sessionStorage.removeItem('adminToken');
            sessionStorage.removeItem('adminRole');
            setIsAdminLoggedIn(false);
        }
        setActiveTab(tab);
    };

    const tabStyle = (name) => ({
        flex: 1,
        padding: '12px 16px',
        fontWeight: 'bold',
        fontSize: '1rem',
        border: activeTab === name ? '1px solid #475569' : '1px solid #cbd5e1',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: activeTab === name ? '#475569' : '#ffffff',
        color: activeTab === name ? '#ffffff' : '#475569',
        boxShadow: activeTab === name ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
        transition: 'all 0.2s'
    });

    return (
        <div>
            <NavBar onAdminClick={() => setIsLoginOpen(true)} />

            <main className="dashboard-container">
                {/* Tab Bar สลับ Dashboard กับ Risk Prediction */}
                <div style={{
                    display: 'flex',
                    width: '100%',
                    marginBottom: '1.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    overflow: 'hidden',
                }}>
                    <button onClick={() => handleTabChange('dashboard')} style={tabStyle('dashboard')}>
                        Dashboard
                    </button>
                    <button onClick={() => handleTabChange('prediction')} style={tabStyle('prediction')}>
                        Risk Prediction
                    </button>
                </div>

                {activeTab === 'dashboard' && (
                    <div>
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
                            <MapView filters={filters} data={hotspots} loading={loading} />
                            <Top10Chart data={top10Data} filters={filters} loading={loading}/>
                        </div>
                        <HolidayCompareChart
                            data={holidayData}
                            filters={filters}
                            provinceName={selectedProvinceName}
                            loading={loading}
                        />
                    </div>
                )}

                {activeTab === 'prediction' && <RiskPrediction />}

                {activeTab === 'upload' && isAdminLoggedIn && <AdminUpload />}

                <AdminLogin
                    isOpen={isLoginOpen}
                    onClose={() => setIsLoginOpen(false)}
                    onLoginSuccess={handleLoginSuccess}
                />
            </main>
        </div>
    );
};

export default Dashboard;