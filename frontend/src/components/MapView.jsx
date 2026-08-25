import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// แก้ปัญหาไอคอนหมุดของ Leaflet ไม่ยอมแสดงผลใน React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

const THAILAND_CENTER = [13.736717, 100.523186];

//สั่งซูมแผนที่ไปยังจุดที่เลือก
function MapFlyTo({ lat, lng, zoom }) {
    const map = useMap();
    
    useEffect(() => {
        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
            map.flyTo([lat, lng], zoom, { duration: 1.2 });
        }
    }, [lat, lng, zoom, map]);

    return null;
}

function MapView({ filters }) {
   
    const [hotspots, setHotspots] = useState([]);
    // const [districts, setDistricts] = useState([]);
    const [mapCenter, setMapCenter] = useState(THAILAND_CENTER);
    const [mapZoom, setMapZoom] = useState(5);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchHotspots();
    }, [filters]);

    const fetchHotspots = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams(filters || {}).toString();

            // const res = await fetch(`http://localhost:5000/api/districts-risk?${queryParams}`);
            const res = await fetch(`http://localhost:5000/api/hotspots?${queryParams}`);
            const data = await res.json();

            if (data.success && data.data && data.data.length > 0) {
                setHotspots(data.data);

                const selectedProv = filters?.province_code || filters?.province;
                const hasSelectedProvince = selectedProv && selectedProv !== '' && selectedProv !== 'ทั้งหมด';

                // ซูมเข้าไปเมื่อกดเลือกจังหวัด
                if (data.data.length > 0 && hasSelectedProvince) {
                    const firstPoint = data.data[0];
                    
                    // ดักจับ lat/lng latitude/longitude
                    const targetLat = parseFloat(firstPoint.lat || firstPoint.latitude);
                    const targetLng = parseFloat(firstPoint.lng || firstPoint.longitude);

                    if(!isNaN(targetLat) && !isNaN(targetLng)) {
                        setMapCenter([targetLat, targetLng]);
                        setMapZoom(9); //ซูมระดับจังหวัด
                    }
                } else {
                        // setDistricts([avgLat, avgLng]);
                        setMapCenter(THAILAND_CENTER);
                        setMapZoom(5); //ภาพรวมทั้งประเทศ
                    }
                }    
        } catch (error) {
            console.error("Error fetching map hotspots:", error);
        } finally {
            setLoading(false);
        }
    };
    
    const getMarkerColor = (score, level) => {
        if (level === 'high' || score >= 8) return '#dc2626';
        if (level === 'medium' || score >= 3) return '#f97316';
        return '#eab308';
    }; 

    return (
        <div className="map-card">
            <div className="map-header">
                <MapPin size={20} color="#dc2626"/>
                <h3>แผนที่แสดงจุดเสี่ยงอุบัติเหตุ</h3>
                {loading && <span className="loading-text">(กำลังโหลดข้อมูล...)</span>}
            </div>

            <div className="map-container-wrapper">
                <MapContainer
                    center={THAILAND_CENTER}
                    zoom={5}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <MapFlyTo lat={mapCenter[0]} lng={mapCenter[1]} zoom={mapZoom} />

                    {hotspots.map((item, idx) => {

                        // แปลงค่าให้เป็น Float เผื่อ API ส่งมาเป็น String
                        const lat = parseFloat(item.lat || item.latitude);
                        const lng = parseFloat(item.lng || item.longitude);

                        // ถ้าไม่มีพิกัด หรือพิกัดไม่ใช่ตัวเลขให้ข้าม
                        if (isNaN(lat) || isNaN(lng)) return null;

                        const score = Number(item.risk_score) || 0;
                        const color = getMarkerColor(score, item.risk_level);

                        return (
                            <CircleMarker
                                key={item.hotspot_id || idx} 
                                center={[lat, lng]}
                                radius={8}
                                pathOptions={{
                                    color: color,
                                    fillColor: color,
                                    fillOpacity: 0.8,
                                    weight: 2
                                }}
                            >
                                {/* Popup แสดงรายละเอียด */}
                                <Popup>
                                    <div className="popup-content">
                                        <h4 className="popup-title">
                                             จังหวัด{item.province_name || '-'} 
                                        </h4>
                                        <div className="popup-details">
                                            <div className="popup-row">
                                                <span>Risk Score</span>
                                                <strong style={{ color: color }}>
                                                    {Number(item.risk_score).toFixed(2)} /100
                                                </strong>
                                            </div>
                                            <div className="popup-row">
                                                <span>ตัวอย่างเคส:</span>
                                                <strong>{item.sample_size || 0} เคส</strong>
                                            </div>
                                            <div className="popup-row popup-factor">
                                                <span>ปัจจัยหลัก:</span>
                                                <strong>{item.top_factors}</strong>
                                            </div>

                                            {item.sample_size < 5 && (
                                                <div className="popup-warning">
                                                    ⚠️ คำนวณจาก ตย. {item.sample_size} เคส (แม่นยำต่ำ)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
}

export default MapView;