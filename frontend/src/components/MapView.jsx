import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

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

const getLatLng = (item) => {
    if (!item) return { lat: NaN, lng: NaN };
    const lat = parseFloat(item.lat ?? item.latitude ?? item.lat_centroid ?? item.y);
    const lng = parseFloat(item.lng ?? item.longitude ?? item.lng_centroid ?? item.x);
    return { lat, lng };
};

//Component วาด Heatmap ภาพรวมทั้งประเทศ
function HeatmapLayer({ points }) {
    const map = useMap();

    useEffect(() => {
        if (!map || !points || points.length === 0) return;

        //แปลงข้อมูลพิกัดให้อยู่ในรูปแบบ [lat, lng, intensity]
        const heatArray = points
            .map(p => {
                const { lat, lng } = getLatLng(p);
                if(isNaN(lat) || isNaN(lng)) return null;
                
                //ดึงค่าความเสี่ยง/จำนวนอุบัติเหตุ มาใช้ทำเป็นความเข้มของสี
                const intensity = Number(p.risk_score || p.total_accidents || 1);

                return [lat , lng, intensity];
            })
            .filter(Boolean); //กรองเอาพิกัดที่ไม่สมบูรณ์ออกไป

        if (heatArray.length === 0) return;

        const heatLayer = L.heatLayer(heatArray, {
            radius: 12, // รัศมีความกระจายของสีในแต่ละจุด (พิกเซล)
            blur: 8, // ระดับความฟุ้งเบลอของขอบสี
            maxZoom: 12, //ระดับการซูมสูงสุดที่จะแสดงผลความหนาแน่น
            gradient: { 0.2: 'blue', 0.5: 'lime', 0.8: 'yellow', 1.0: 'red '} // การไล่เฉดสี (น้อย -> มาก)
        }).addTo(map); // สั่งให้ Layer นี้ไปวางแปะบนแผนที่จริง

        return () => {
            map.removeLayer(heatLayer);
        };
    }, [map, points]);

    return null;
}

//ควบคุมการซูมและย้ายพิกัดของแผนที่
function MapController({ hotspots, hasSelectedProvince }) {
    const map = useMap();

    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();

            if (!hotspots || hotspots.length === 0) {
                // ถ้าไม่มีข้อมูลให้กลับมาที่กึ่งกลางประเทศไทย
                map.flyTo(THAILAND_CENTER, 5, { duration: 1.0 });
                return;
            }

            if (hasSelectedProvince) {
                // รวบรวมพิกัดของ lat/lng ทั้งหมดที่มีอยู่จริงในจังหวัดนั้น
                const validBounds = hotspots
                    .map(item => {
                        const { lat, lng } = getLatLng(item);
                        return (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : null;
                    })
                    .filter(Boolean);
                
                if (validBounds.length > 0) {
                    // คำนวณขอบเขตทุกอำเภอ แล้วให้ fitBounds เพื่อย้ายแผนที่ไปศูนย์กลางของจังหวัดนั้น
                    const bounds = L.latLngBounds(validBounds);
                    
                    //ซูมเจาะจงไปที่ขอบเขตของจังหวัดนั้นๆ
                    map.fitBounds(bounds, {
                        padding: [50, 50],
                        maxZoom: 12,
                        animate: true,
                        duration: 1.0
                    });
                    return;
                }
            } 
            //ถ้าไม่ได้เลือกจังหวัด หรือจังหวัดนั้นไม่มีข้อมูลจุดเสี่ยง ให้กลับมาซูมภาพรวมทั้งประเทศ
            if (!hasSelectedProvince) {
                map.flyTo(THAILAND_CENTER, 6, { duration: 1.0 });
            }
        }, 150); 

        return () => clearTimeout(timer);
    }, [hotspots, hasSelectedProvince, map]);

    return null;
}

function MapView({ filters }) {
   
    const [hotspots, setHotspots] = useState([]);
    const [loading, setLoading] = useState(false);

    //เช็กว่า user กดเลือกจังหวัดไหม
    const selectedProv = filters?.province_code || filters?.province;
    const hasSelectedProvince = Boolean(selectedProv && selectedProv !== '' && selectedProv !== 'ทั้งหมด');

    useEffect(() => {
        fetchHotspots();
    }, [filters]);

    const fetchHotspots = async () => {
        setLoading(true);
        setHotspots([]);
        try {
            const queryParams = new URLSearchParams(filters || {}).toString();

            const endpoint = hasSelectedProvince
                ? `http://localhost:5000/api/districts/risk?${queryParams}`
                : `http://localhost:5000/api/hotspots?${queryParams}`;

            const res = await fetch(endpoint);
            const data = await res.json();

            if (data.success && data.data && data.data.length > 0) {
                setHotspots(data.data);
            } else {
                setHotspots([]);
            }
        } catch (error) {
            console.error("Error fetching map hotspots:", error);
            setHotspots([]);
        } finally {
            setLoading(false);
        }
    };

    //กำหนดสีและคำอธิบายตามระดับความเสี่ยง
    const getRiskInfo = (score, level) => {
        const numScore = Number(score) || 0;
        const normalizedLevel = String(level || '').toLowerCase();

        if (normalizedLevel === 'high' || normalizedLevel === 'สูง' || numScore >= 7) {
            return { color: '#dc2626', label: 'สูง', radius: 14 };
        }
        if (normalizedLevel === 'medium' || normalizedLevel === 'ปานกลาง' || numScore >= 4) {
            return { color: '#f97316', label: 'ปานกลาง', radius: 11 };
        }
        return { color: '#eab308', label: 'ต่ำ', radius: 8 };
    };

    const currentProvinceName = hotspots[0]?.province_name || filters?.province_name || filters?.province;
    
    return (
        <div className="map-card">
            <div className="map-header">
                <MapPin size={20} color="#dc2626"/>
                <h3>
                    {hasSelectedProvince 
                        ? `แผนที่แสดงจุดเสี่ยงอุบัติเหตุจังหวัด${currentProvinceName}` 
                        : "แผนที่แสดงจุดเสี่ยงอุบัติเหตุทั้งประเทศไทย"}
                </h3>
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

                    <MapController hotspots={hotspots} hasSelectedProvince={hasSelectedProvince}/>

                    {/* Heatmap */}
                    <HeatmapLayer points={hotspots} />

                    {/* Bubble map */}
                    {hasSelectedProvince && hotspots.map((item, idx) => {
                        const { lat, lng } = getLatLng(item);
                        if (isNaN(lat) || isNaN(lng)) return null;

                        const totalAccidents = item.total_accidents || item.accident_count || item.count || 0;
                        const riskInfo = getRiskInfo(item.risk_score, item.risk_level);
                        const districtName = item.district_name || item.dis_name_th || 'ไม่ระบุอำเภอ';

                        return (
                            <CircleMarker
                                key={item.district_code || idx} 
                                center={[lat, lng]}
                                radius={riskInfo.radius}
                                pathOptions={{
                                    color: '#ffffff', 
                                    fillColor: riskInfo.color,
                                    fillOpacity: 0.8, //ระดับความโปร่งแสงของสีพื้นด้านใน
                                    weight:  2 
                                }}
                            >
                                {/* Popup แสดงรายละเอียด */}
                                <Popup>
                                    <div className="popup-content">
                                        <div className="district-popup">
                                            <h4 className="popup-title">
                                                อำเภอ {districtName}
                                            </h4>
                                            <div className="popup-row">
                                                <span className="popup-label">อุบัติเหตุทั้งหมด:</span>
                                                <strong className="popup-value">{totalAccidents.toLocaleString()} ครั้ง</strong>
                                            </div>
                                            <div className="popup-row">
                                                <span className="popup-label">ระดับความเสี่ยง:</span>
                                                <strong className="popup-value" style={{ color: riskInfo.color }}>
                                                    {riskInfo.label}
                                                </strong>
                                            </div>
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