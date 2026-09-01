import {useState, useEffect} from "react";
import NavBar from "../components/Navbar";
import FilterBar from "../components/FilterBar";
import SummaryCards from "../components/SummaryCards";
import MapView from "../components/MapView";
import Top10Chart from "../components/Top10Chart";
import HolidayCompareChart from "../components/HolidayCompareChart";

import {
    getSummaryData,
    getHotspotPoints,
    getTop10,
    getHolidayCompareData
} from "../api/apiService";

const Dashboard = () => {
    
    const initialFilters = {
        year: '2025',
        province: '',
        timeRange: '',
        dayType: ''
    };

    const [filters, setFilters] = useState(initialFilters);

    //state เก็บข้อมูลแต่ละส่วน
    const [summaryData, setSummaryData] =  useState(null);
    const [hotspots, setHotspots] =  useState([]);
    const [top10Data, setTop10Data] =  useState([]);
    const [holidayData, setHolidayData] =  useState([]);
    const [loading, setLoading] =  useState(false);

    const isFiltered = Boolean(filters.province || filters.timeRange || filters.dayType);

    //ดึงข้อมูลใหม่ทุกครั้งที่ filters เปลี่ยน
    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                //ดึงข้อมูล 4 ส่วนพร้อมกันเพื่อความเร็ว
                const [summaryRes, HotspotRes, top10Res, holidayRes] = await Promise.all([
                    getSummaryData(filters),
                    getHotspotPoints(filters.year, filters.province),
                    getTop10(filters.year, filters.province),
                    getHolidayCompareData(filters.year, filters.province)
                ]);

                const resData = summaryRes?.data || summaryRes;
                setSummaryData({
                    totalAccidents: resData.total_accidents || 0,
                    totalDeaths: resData.total_deaths || 0,
                    totalInjuries: resData.total_injuries || 0,
                    mostRiskyTime: resData.most_risky_time || "-",
                })

                if (HotspotRes?.success) setHotspots(HotspotRes.data);

                if (top10Res?.success) setTop10Data(top10Res.data);

                if (holidayRes?.success) setHolidayData(holidayRes.data);

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
                    <Top10Chart data={top10Data} loading={loading}/>
                </div>
                <HolidayCompareChart data={holidayData} loading={loading} />
            </main>
        </div>
    );
};

export default Dashboard;