import React, {useState, useEffect} from "react";
import NavBar from "../components/Navbar";
import FilterBar from "../components/FilterBar";
import SummaryCards from "../components/SummaryCards";
import MapView from "../components/MapView";
import Top10Chart from "../components/Top10Chart";
import HolidayCompareChart from "../components/HolidayCompareChart";
import { getSummaryData } from "../api/apiService";


const Dashboard = () => {
    
    const initialFilters = {
        year: '2025',
        province: '',
        timeRange: '',
        dayType: ''
    };

    const [filters, setFilters] =  useState(initialFilters);
    const [summaryData, setSummaryData] =  useState(null);
    const [loading, setLoading] =  useState(false);

    const isFiltered = Boolean(filters.province || filters.timeRange || filters.dayType);

    useEffect(() => {
        const fetchSummary = async () => {
            setLoading(true);
            try {
                const response = await getSummaryData(filters);
                console.log("Summary Response จาก Backend:", response);

                const resData = response?.data || response;

                setSummaryData({
                    totalAccidents: resData.total_accidents || 0,
                    totalDeaths: resData.total_deaths || 0,
                    totalInjuries: resData.total_injuries || 0,
                    mostRiskyTime: resData.most_risky_time || "-",
                    riskScore: resData.risk_score || 0,
                    riskLevel: resData.risk_level || "-",
                })
            } catch (error) {
                console.error("Error fetching summary data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [filters]);

    // const mockSummaryData = {
    //     totalAccidents: isFiltered ? 1250 : 45200,
    //     totalDeaths: isFiltered ? 42 : 1850,
    //     totalInjuries: 32100,
    //     mostRiskyTime: '18:00 - 21:00 น.',
    //     riskScore: 82.5,
    //     riskLevel: 'เสี่ยงสูงมาก'
    // };

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
                    <MapView />
                    <Top10Chart />
                </div>
                <HolidayCompareChart />
            </main>
        </div>
    );
};

export default Dashboard;