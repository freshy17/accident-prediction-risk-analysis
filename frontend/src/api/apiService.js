import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

//ดึงปีทั้งหมดที่มีมา
export const getYearList = async () => {
    const response = await axios.get(`${BASE_URL}/summaries/years`);
    return response.data;
};

//ดึงข้อมูลสรุปการ์ด 4 ใบ
export const getSummaryData = async (selectedYear, provinceCode) => {
    const response = await axios.get(`${BASE_URL}/summaries`, {
        params: {
            year: selectedYear,
            province_code: provinceCode
        }
    });
    return response.data;
};

//ดึงพิกัดจุดเสี่ยงสำหรับทำแผนที่
export const getHotspotPoints = async (selectedYear) => {
    const response = await axios.get(`${BASE_URL}/hotspots`, {
        params: { year: selectedYear }
    });
    return response.data;
};

//ดึงข้อมูล 10 อันดับพื้นที่เสี่ยง
export const getTop10 = async (selectedYear, provinceCode) => {
    const response = await axios.get(`${BASE_URL}/summaries/top10`, {
        params: {
            year: selectedYear,
            province_code: provinceCode
        }
    });
    return response.data;
};
