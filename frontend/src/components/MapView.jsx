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

// Mock Data พิกัดจุดเสี่ยงสำหรับทดสอบ
// const defaultMockAccidents = [
//   { id: 1, lat: 13.7563, lng: 100.5018, location: 'ถนนสุขุมวิท กรุงเทพฯ', deaths: 2, injuries: 5, severity: 'high' },
//   { id: 2, lat: 18.7883, lng: 98.9853, location: 'ถนนซุปเปอร์ไฮเวย์ เชียงใหม่', deaths: 0, injuries: 3, severity: 'medium' },
//   { id: 3, lat: 7.8804, lng: 98.3923, location: 'ถนนเทพกระษัตรี ภูเก็ต', deaths: 1, injuries: 1, severity: 'high' },
//   { id: 4, lat: 14.9707, lng: 102.0882, location: 'ถนนมิตรภาพ นครราชสีมา', deaths: 0, injuries: 2, severity: 'low' },
// ];

const THAILAND_CENTER = [13.736717, 100.523186];

// Helper สั่งซูมแผนที่ไปยังจุดที่เลือก
function MapFlyTo({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom, { duration: 1.5});
        }
    }, [center, zoom, map]);
    return null;
}

function MapView({ filters }) {
   
    const [hotspots, setHotspots] = useState([]);
    const [selectedPoint, setSelectedPoint] = useState(null);
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
            const res = await fetch(`http://localhost:5000/api/hotspots?${queryParams}`);
            const data = await res.json();

            if (data.success && data.data) {
                setHotspots(data.data);

                //ซูมเข้าไปเมื่อกดเลือกจังหวัด
                if (data.data.length > 0 && filters?.province_code && filters.province_code !== 'ทั้งหมด') {
                    const firstPoint = data.data[0];
                    if(firstPoint.lat && firstPoint.lng) {
                        setMapCenter([parseFloat(firstPoint.lat), parseFloat(firstPoint.lng)]);
                        setMapZoom(9);
                    } 
                } else {
                        setMapCenter(THAILAND_CENTER);
                        setMapZoom(5);
                    }
                }   
        } catch (error) {
            console.error("Error fetching map hotspots:", error);
        } finally {
            setLoading(false);
        }
    };

    const getMarkerColor = (score, level) => {
        if (level === 'high' || score >= 50) return '#dc2626';
        if (level === 'medium' || score >= 20) return '#f97316';
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

                    <MapFlyTo center={mapCenter} zoom={mapZoom} />

                    {hotspots.map((item, idx) => {
                        // if (!item.lat || !item.lng) return null;
                        // const color = getMarkerColor(item.risk_score, item.risk_level);

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
                                // center={[parseFloat(item.lat), parseFloat(item.lng)]}
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
                                            อ.{item.district_name || '-'} จ.{item.province_name || '-'} 
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