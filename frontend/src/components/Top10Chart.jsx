import React from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { BarChart3 } from "lucide-react";

//Mock Data 10 อันดับจุดเสี่ยง/จังหวัด
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

function Top10Chart({ data = defaultMockTop10 }) {
    return (
        <div className="chart-card">
            <div className="chart-header">
                <BarChart3 size={20} color="#dc2626"/>
                <h3>Top 10 จังหวัดที่เกิดอุบัติเหตุสูงสุด</h3>
            </div>

            <div className="chart-container-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5}}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#64748b" fontSize={12} />
                        <YAxis
                            type="category"
                            dataKey="name"
                            stroke="#334155"
                            fontSize={13}
                            tickLine={false}
                            width={80}
                        >
                        </YAxis>
                        <Tooltip
                            formatter={(value) => [`${value} ครั้ง`, 'จำนวนอุบัติเหตุ']}
                            contentStyle={{ background: '#1e293b', borderRadius: '0.5rem', color: '#fff', border: 'none'}}
                            itemStyle={{ color: '#f8fafc'}}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                            ))} 
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default Top10Chart;