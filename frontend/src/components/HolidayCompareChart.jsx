import { useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Calendar } from 'lucide-react';
import { getHolidayCompareData } from '../api/apiService';

//Mock Data สำรอง
const defaultMockHolidayData = [
  { name: 'กทม. และปริมณฑล', normal: 120, newYear: 280, songkran: 310 },
  { name: 'ภาคเหนือ', normal: 90, newYear: 230, songkran: 260 },
  { name: 'ภาคตะวันออกเฉียงเหนือ', normal: 110, newYear: 290, songkran: 340 },
  { name: 'ภาคกลาง', normal: 85, newYear: 180, songkran: 210 },
  { name: 'ภาคใต้', normal: 70, newYear: 150, songkran: 170 },
];

function HolidayCompareChart({ filters = {}, provinceName = ''}) {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(false);

    const hasSelectedProvince = Boolean(filters.province);
    const yearText = filters?.year ? ` (ปี ${filters.year})` : '';

    const title = hasSelectedProvince
        ? `กราฟแสดงข้อมูลเปรียบเทียบจำนวนอุบัติเหตุระหว่างช่วงวันปกติ VS หยุดปีใหม่ VS สงกรานต์ ในจังหวัด${provinceName}${yearText}`
        : `กราฟแสดงข้อมูลเปรียบเทียบจำนวนอุบัติเหตุระหว่างช่วงวันปกติ VS หยุดปีใหม่ VS สงกรานต์${yearText}`;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {

                //เรียกใช้ API 
                const response = await getHolidayCompareData(filters.year, filters.province);
                const list = response?.data || response || [];

                if (Array.isArray(list) && list.length > 0) {
                    const formattedData = list.map(item => ({
                        name: item.name || 'ไม่ระบุ',
                        normal: Number(item.normal || 0),  
                        newYear: Number(item.newYear || 0),  
                        songkran: Number(item.songkran || 0),  
                    }));
                    setChartData(formattedData);
                } else {
                    setChartData(hasSelectedProvince ? [] : defaultMockHolidayData);
                }
            } catch (error) {
                console.error("Error fetching HolidayCompare data:", error);
                setChartData(hasSelectedProvince ? [] : defaultMockHolidayData);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filters.year, filters.province]);

    return (
        <div className='holiday-chart-card'>
            <div className='holiday-chart-header'>
                <Calendar size={20} color='#dc2626'/>
                <h3>{title}</h3>
            </div>
            <div className='holiday-chart-wrapper'>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b'}}>(กำลังโหลดข้อมูล...)</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top:20, right: 30, left: 0, bottom: 10}}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke='#64748b' fontSize={12} tickLine={false} />
                        <YAxis stroke='#64748b' fontSize={12} />
                        <Tooltip
                            formatter={(value) => [`${value} ครั้ง`, '']}
                            contentStyle={{ background: '#1e293b', borderRadius: '0.5rem', color: '#fff', border: 'none'}}
                            itemStyle={{ color: '#f8fafc'}}
                        />
                        <Legend
                            wrapperStyle={{ paddingTop: '15px' }}
                            payload={[
                                { value: 'วันปกติ', type: 'rect', color: '#94a3b8' },
                                { value: 'เทศกาลปีใหม่', type: 'rect', color: '#f97316' },
                                { value: 'เทศกาลสงกรานต์', type: 'rect', color: '#dc2626' }
                            ]}  
                        />
                        <Bar dataKey="normal" name="วันปกติ" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="newYear" name="เทศกาลปีใหม่" fill="#f97316" radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="songkran" name="เทศกาลสงกรานต์" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={18} />
                    </BarChart>
                </ResponsiveContainer>
                )}
           </div>
        </div>
    );
}

export default HolidayCompareChart;