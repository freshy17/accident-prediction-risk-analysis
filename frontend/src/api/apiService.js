import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

//ดึงปีทั้งหมดที่มีมา
export const getYearList = async () => {
    try {
        const response = await axios.get(`${BASE_URL}/summaries/years`);
        return response.data;
    } catch (error) {
        console.error("Error in getYearList:", error);
        throw error;
    }
};

//ดึงชื่อจังหวัดทั้งหมด
export const getProvinceList = async () => {
    try {
        const response = await axios.get(`${BASE_URL}/provinces`);
        return response.data;
    } catch (error) {
        console.error("Error in getProvinceList:", error);
        throw error;
    }
};

//ดึงข้อมูลสรุปการ์ด 4 ใบ
export const getSummaryData = async (filters) => {
    try {
        const response = await axios.get(`${BASE_URL}/summaries`, {
        params: filters
    });
    return response.data
    } catch (error) {
        console.error("Error in getSummaryData:", error);
        throw error;
    }
};

//ดึงพิกัดจุดเสี่ยงสำหรับทำแผนที่
export const getHotspotPoints = async (selectedYear, provinceCode) => {
    try {
        const response = await axios.get(`${BASE_URL}/hotspots`, {
            params: { 
                year: selectedYear,
                province_code: provinceCode 
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error in getHotspotPoints:", error);
        throw error;
    }
};

//ดึงข้อมูล Top 10 อันดับพื้นที่เสี่ยง (รองรับทั้งระดับประเทศ และ ระดับอำเภอเมื่อกดเลือกจังหวัด)
export const getTop10 = async (selectedYear, provinceCode) => {
    try {
        const response = await axios.get(`${BASE_URL}/summaries/top10`, {
            params: {
                year: selectedYear,
                province_code: provinceCode
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error in getTop10:", error);
        throw error;
    }
};

//ดึงข้อมูลเปรียบเทียบช่วงวันหยุด (รองรับ filter ตามปี และจังหวัด)
export const getHolidayCompareData = async (selectedYear, provinceCode) => {
    try {
        const response = await axios.get(`${BASE_URL}/summaries/holiday-compare`, {
            params: {
                year: selectedYear,
                province_code: provinceCode
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error in getHolidayCompareData:", error);
        throw error;
    }
};

//ดึงผลการพยากรณ์ความเสี่ยง (สำหรับหน้า Risk Prediction และ SHAP)
export const getRiskPrediction = async (filters) => {
    try {
        const response = await axios.get(`${BASE_URL}/predict`, {
            params: filters
        });
        return response.data;
    } catch (error) {
        console.error("Error in getRiskPrediction:", error);
        throw error
    }
};