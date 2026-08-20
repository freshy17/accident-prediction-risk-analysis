import React, {useState} from "react";
import NavBar from "../components/Navbar";
import FilterBar from "../components/FilterBar";
import SummaryCards from "../components/SummaryCards";
import MapView from "../components/MapView";
import Top10Chart from "../components/Top10Chart";
import HolidayCompareChart from "../components/็HolidayCompareChart";

const Dashboard = () => {
    const mockYears = [{ year: '2024'}, { year: '2023' }];
    const mockProvinces = [
        {code: '10', name_th: 'กรุงเทพมหานคร'},
        {code: '50', name_th: 'เชียงใหม่'},
        {code: '40', name_th: 'ขอนแก่น'},
    ];

    const initialFilters = {
        year: '2024',
        province: '',
        timeRange: '',
        dayType: ''
    };

    const [filters, setFilters] =  useState(initialFilters);
    const isFiltered = Boolean(filters.province || filters.timeRange || filters.dayType);

    const mockSummaryData = {
        totalAccidents: isFiltered ? 1250 : 45200,
        totalDeaths: isFiltered ? 42 : 1850,
        totalInjuries: 32100,
        mostRiskyTime: '18:00 - 21:00 น.',
        riskScore: 82.5,
        riskLevel: 'เสี่ยงสูงมาก'
    };

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
                    yearList={mockYears}
                    provinceList={mockProvinces}
                    onReset={handleReset}
                />
                <SummaryCards isFiltered={isFiltered} data={mockSummaryData}/>
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