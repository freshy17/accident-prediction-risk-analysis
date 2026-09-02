import { AlertTriangle, UserX, Activity, Clock } from "lucide-react";

const SummaryCards = ({ data, loading }) => {
    const safeData = data || {
        totalAccidents: 0,
        totalDeaths: 0,
        totalInjuries: 0,
        mostRiskyTime: '-',
    };

    if (loading) {
        return (
            <div className="summary-grid">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="summary-card" style={{ opacity: 0.6 }}>
                        <p className="card-title">(กำลังโหลด...)</p>
                        <h3 className="card-value">-</h3>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="summary-grid">
            {/* card1: อุบัติเหตุทั้งหมด */}
            <div className="summary-card">
                <div>
                    <p className="card-title">อุบัติเหตุทั้งหมด</p>
                    <h3 className="card-value">
                        {(safeData.totalAccidents || 0).toLocaleString()} <span className="card-unit">ครั้ง</span>
                    </h3>
                </div>
                <div className="card-icon icon-blue">
                    <AlertTriangle size={24}/>
                </div>
            </div>

            {/* card2: ผู้เสียชีวิตทั้งหมด */}
            <div className="summary-card">
                <div>
                    <p className="card-title">ผู้เสียชีวิตทั้งหมด</p>
                    <h3 className="card-value" style={{ color: '#dc2626'}}>
                        {(safeData.totalDeaths || 0).toLocaleString()} <span className="card-unit">ราย</span>
                    </h3>
                </div>
                <div className="card-icon icon-red">
                    <UserX size={24}/>
                </div>
            </div>

            {/* card3: ผู้บาดเจ็บทั้งหมด */}
            <div className="summary-card">
                <div>
                    <p className="card-title">ผู้บาดเจ็บทั้งหมด</p>
                    <h3 className="card-value" style={{ color: '#d97706'}}>
                        {(safeData.totalInjuries || 0).toLocaleString()} <span className="card-unit">ราย</span>
                    </h3>
                </div>
                <div className="card-icon icon-amber">
                    <Activity size={24}/>
                </div>
            </div>

            {/* card4: =ช่วงเวลาที่เสี่ยงที่สุด */}
            <div className="summary-card">
                <div>
                    <p className="card-title">ช่วงเวลาที่เสี่ยงที่สุด</p>
                    <h3 className="card-value" style={{ color: '#9333ea', fontSize: '1.1rem' }}>
                        {safeData.mostRiskyTime || '-'}    
                    </h3>
                </div>
                <div className="card-icon icon-purple">
                    <Clock size={24}/>
                </div>
            </div>
        </div>
    );
};

export default SummaryCards;