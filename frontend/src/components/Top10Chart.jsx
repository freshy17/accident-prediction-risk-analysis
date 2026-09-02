import { useState, useEffect} from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { BarChart3 } from "lucide-react";
import { getTop10 } from "../api/apiService";

//Mock Data สำรอง (จะทำงานทันทีหาก API ไม่พร้อมส่งข้อมูล)
const defaultMockTop10 = [
    { name: 'กรุงเทพ', count: 145 },
    { name: 'เชียงใหม่', count: 98 },
    { name: 'ชลบุรี', count: 86 },
    { name: 'นครราชสีมา', count: 74 },
    { name: 'ภูเก็ต', count: 65 },
    { name: 'ขอนแก่น', count: 58 },
    { name: 'สงขลา', count: 52 },
    { name: 'สุราษฎร์ธานี', count: 47 },
    { name: 'นนทบุรี', count: 41 },
    { name: 'ปทุมธานี', count: 36 },
];

//ไล่ระดับสีแท่งกราฟจากเสี่ยงมากไปน้อย
const BAR_COLORS = [
    '#dc2626', '#e11d48', '#ea580c', '#f97316', '#f59e0b',
    '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6'
];

const CustomBar = (props) => {
    const { fill, x, y, width, height, index } = props;
    const barColor = BAR_COLORS[index % BAR_COLORS.length];

    return (
        <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={barColor}
            rx={6} // โค้งมนฝั่งขวา
            ry={6}
        />
    );
};

function Top10Chart({ filters }) {
    const [chartData, setChartData] = useState(defaultMockTop10);
    const [loading, setLoading] = useState(false);

    //ตรวจสอบสถานะของการเลือกจังหวัด
    const hasSelectedProvince = Boolean(filters?.province);
    const provinceName = filters?.province_name || "";

    const yearText = filters?.year ? ` (ปี ${filters.year})` : '';

    const title = hasSelectedProvince
        ? `Top 10 อำเภอที่เกิดอุบัติเหตุสูงสุดในจังหวัด${provinceName} ${yearText}`
        : `Top 10 จังหวัดที่เกิดอุบัติเหตุสูงสุด${yearText}`;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                //เรียกใช้ API 
                const response = await getTop10(filters.year, filters.province);
                console.log("Data from Backend Top10:", response);

                const list = response?.data?.data || response?.data || response || [];
                if (Array.isArray(list) && list.length > 0 ) {
                    const formattedData = list.map(item => ({
                        name: item.name || 'ไม่ระบุ',
                        count: Number(item.total || 0) //แปลง string ให้เป็น Number
                    })) ;
                    setChartData(formattedData);
                } else {
                    //เลือกจังหวัดแล้วแต่ยังไม่มีข้อมูลที่ส่งมาจาก Backend ให้คืนค่าเป็นอาร์เรย์ว่าง
                    setChartData(hasSelectedProvince ? [] : defaultMockTop10);
                }
            } catch (error) {
                console.error("Error fetching Top10 Data:", error);
                setChartData(hasSelectedProvince ? [] : defaultMockTop10);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [filters.year, filters.province])

    return (
        <div className="chart-card">
            <div className="chart-header">
                <BarChart3 size={20} color="#dc2626"/>
                <h3>{title}</h3>
                {loading && <span className="loading-text">(กำลังโหลด...)</span>}
            </div>

            <div className="chart-container-wrapper" style={{ height: '320px', width: '100% '}}>
                {chartData.length === 0 && !loading ? (
                    <div className="no-data" style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
                        ไม่พบข้อมูลอุบัติเหตุในช่วงเวลาที่เลือก
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5}}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#64748b" fontSize={12} />
                        <YAxis
                            type="category"
                            dataKey="name"
                            stroke="#334155"
                            fontSize={12}
                            tickLine={false}
                            width={80}
                        />
                        <Tooltip
                            formatter={(value) => [`${value} ครั้ง`, 'จำนวนอุบัติเหตุ']}
                            contentStyle={{ background: '#1e293b', borderRadius: '0.5rem', color: '#fff', border: 'none'}}
                            itemStyle={{ color: '#f8fafc'}}
                        />
                        <Bar
                            dataKey="count"
                            barSize={18}
                            shape={<CustomBar />}
                        />
                    </BarChart>
                </ResponsiveContainer>
                )} 
            </div>
        </div>
    );
}

export default Top10Chart;