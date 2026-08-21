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

//Mock Data สำหรับเปรียบเทียบ
const defaultMockHolidayData = [
  { name: 'กทม. และปริมณฑล', normal: 120, newYear: 280, songkran: 310 },
  { name: 'ภาคเหนือ', normal: 90, newYear: 230, songkran: 260 },
  { name: 'ภาคตะวันออกเฉียงเหนือ', normal: 110, newYear: 290, songkran: 340 },
  { name: 'ภาคกลาง', normal: 85, newYear: 180, songkran: 210 },
  { name: 'ภาคใต้', normal: 70, newYear: 150, songkran: 170 },
];

function HolidayCompareChart({ data = defaultMockHolidayData}) {
    return (
        <div className='holiday-chart-card'>
            <div className='holiday-chart-header'>
                <Calendar size={20} color='#dc2626'/>
                <h3>กราฟแสดงข้อมูลเปรียบเทียบจำนวนอุบัติเหตุระหว่างช่วงวันปกติ vs หยุดปีใหม่ vs สงกรานต์</h3>
            </div>
            <div className='holiday-chart-wrapper'>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
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
                            // formatter={(value) => {
                            //     if (value === 'normal') return 'วันปกติ';
                            //     if (value === 'newYear') return 'เทศกาลปีใหม่';
                            //     if (value === 'songkran') return 'เทศกาลสงกรานต์';
                            //     return value;
                            // }}
                        />
                        <Bar dataKey="normal" name="วันปกติ" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="newYear" name="เทศกาลปีใหม่" fill="#f97316" radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="songkran" name="เทศกาลสงกรานต์" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={18} />
                    </BarChart>
                </ResponsiveContainer>
           </div>
        </div>
    );
}

export default HolidayCompareChart;