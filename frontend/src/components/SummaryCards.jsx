import React from "react";
import { AlertTriangle, UserX, Activity, Clock, ShieldAlert } from "lucide-react";

const SummaryCards = ({ isFiltered, data }) => {
    const safeData = data || {
        totalAccidents: 0,
        totalDeaths: 0,
        totalInjuries: 0,
        mostRiskyTime: '-',
        riskScore: 0,
        riskLevel: '-'
    };

    return (
        <div className="summary-grid">
            {/* card1: อุบัติเหตุทั้งหมด */}
            <div className="summary-card">
                <div>
                    <p className="card-title">อุบัติเหตุทั้งหมด</p>
                    <h3 className="card-value">
                        {safeData.totalAccidents?.toLocaleString()} <span className="card-unit">ครั้ง</span>
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
                        {safeData.totalDeaths?.toLocaleString()} <span className="card-unit">ราย</span>
                    </h3>
                </div>
                <div className="card-icon icon-red">
                    <UserX size={24}/>
                </div>
            </div>

            {/* card3: ผู้บาดเจ็บทั้งหมด & Risk Score */}
            <div className="summary-card">
                <div>
                    <p className="card-title">
                        {isFiltered ? 'Risk Score' : 'ผู้บาดเจ็บทั้งหมด'}
                    </p>
                    <h3 className="card-value" style={{ color: '#d97706'}}>
                        {isFiltered ? (
                            <>{safeData.riskScore} <span className="card-unit">/ 100</span></>
                        ) : (
                            <>{safeData.totalInjuries.toLocaleString()} <span className="card-unit">ราย</span></>
                        )}
                    </h3>
                </div>
                <div className="card-icon icon-amber">
                    <Activity size={24}/>
                </div>
            </div>

            {/* card4: =ช่วงเวลาที่เสี่ยงที่สุด ฿ ระดับความเสี่ยง */}
            <div className="summary-card">
                <div>
                    <p className="card-title">
                        {isFiltered ? 'ระดับความเสี่ยง' : 'ช่วงเวลาที่เสี่ยงที่สุด'}
                    </p>
                    {isFiltered ? (
                        <span className="risk-badge">
                            {safeData.riskLevel}
                        </span>
                    ) : (
                        <h3 className="card-value" style={{ color: '#9333ea' }}>
                            {safeData.mostRiskyTime}    
                        </h3>
                    )}
                </div>
                <div className="card-icon icon-purple">
                    {isFiltered ? <ShieldAlert size={24} /> : <Clock size={24}/>}
                </div>
            </div>
        </div>
    );
};

export default SummaryCards;