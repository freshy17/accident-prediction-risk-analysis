import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Timer } from 'lucide-react';
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

const getLatLng = (item) => {
    if (!item) return { lat: NaN, lng: NaN };
    const lat = parseFloat(item.lat ?? item.latitude ?? item.lat_centroid ?? item.y);
    const lng = parseFloat(item.lng ?? item.longitude ?? item.lng_centroid ?? item.x);
    return { lat, lng };
};

//สั่งซูมแผนที่ไปยังจุดที่เลือก
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
                    map.fitBounds(bounds, {
                        padding: [40, 40],
                        maxZoom: 11,
                        animate: true,
                        duration: 1.0
                    });
                }
            } else {
                map.flyTo(THAILAND_CENTER, 5, { duration: 1.0 });
            }
        }, 100); 

        return () => clearTimeout(timer);
    }, [hotspots, hasSelectedProvince, map]);

    return null;
}

// function MapFlyTo({ lat, lng, zoom }) {
//     const map = useMap();
    
//     useEffect(() => {
//         if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
//             map.flyTo([lat, lng], zoom, { duration: 1.2 });
//         }
//     }, [lat, lng, zoom, map]);

//     return null;
// }

function MapView({ filters }) {
   
    const [hotspots, setHotspots] = useState([]);
    // const [districts, setDistricts] = useState([]);
    // const [mapCenter, setMapCenter] = useState(THAILAND_CENTER);
    // const [mapZoom, setMapZoom] = useState(5);
    const [loading, setLoading] = useState(false);

    //เช็กว่า user กดเลือกจังหวัดไหม
    const selectedProv = filters?.province_code || filters?.province;
    const hasSelectedProvince = selectedProv && selectedProv !== '' && selectedProv !== 'ทั้งหมด';

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

            // if (data.success && data.data && data.data.length > 0) {
            //     setHotspots(data.data); //เก็บข้อมูลเข้า state

                // ซูมเข้าไปเมื่อกดเลือกจังหวัด
                // if (data.data.length > 0 && hasSelectedProvince) {

                //     const firstPoint = data.data[0];
                    
                //         if (firstPoint) {
                //             const targetLat = parseFloat(firstPoint.lat || firstPoint.latitude);
                //             const targetLng = parseFloat(firstPoint.lng || firstPoint.longitude);

                //             if(!isNaN(targetLat) && !isNaN(targetLng)) {
                //             setMapCenter([targetLat, targetLng]);
                //             setMapZoom(9); //ซูมระดับจังหวัดให้เห็นอำเภอ
                //         }
                //     }
                // } else {
                //         setMapCenter(THAILAND_CENTER);
                //         setMapZoom(5); //ภาพรวมทั้งประเทศ
                //     }
                // } else {
                //     setHotspots([]);
                //     setMapCenter(THAILAND_CENTER);
                //     setMapZoom(5);
                // }    
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
    
    const getMarkerColor = (score, level) => {
        if (level === 'high' || score >= 8) return '#dc2626';
        if (level === 'medium' || score >= 3) return '#f97316';
        return '#eab308';
    }; 

    return (
        <div className="map-card">
            <div className="map-header">
                <MapPin size={20} color="#dc2626"/>
                <h3>
                    {hasSelectedProvince ? "แผนที่แสดงจุดเสี่ยงอุบัติเหตุภายในจังหวัด" : "แผนที่แสดงจุดเสี่ยงอุบัติเหตุทั้งประเทศ"}
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

                    {/* <MapFlyTo lat={mapCenter[0]} lng={mapCenter[1]} zoom={mapZoom} /> */}

                    <MapController hotspots={hotspots} hasSelectedProvince={hasSelectedProvince}/>

                    {hotspots.map((item, idx) => {
                        const { lat, lng } = getLatLng(item);

                        // แปลงค่าให้เป็น Float เผื่อ API ส่งมาเป็น String
                        // const lat = parseFloat(item.lat || item.latitude);
                        // const lng = parseFloat(item.lng || item.longitude);

                        // ถ้าไม่มีพิกัด หรือพิกัดไม่ใช่ตัวเลขให้ข้าม
                        if (isNaN(lat) || isNaN(lng)) return null;

                        const score = Number(item.risk_score) || 0;
                        const color = getMarkerColor(score, item.risk_level);

                        const district_name = item.district_name || item.dis_name_th;

                        return (
                            <CircleMarker
                                key={item.district_code || item.hotspot_id || idx} 
                                center={[lat, lng]}
                                radius={hasSelectedProvince ? 10 : 8}
                                pathOptions={{
                                    color: hasSelectedProvince ? '#ffffff' : color, //ใส่ขอบขาวแสดงของอำเภอ
                                    fillColor: color,
                                    fillOpacity: 0.8, //ระดับความโปร่งแสงของสีพื้นด้านใน
                                    weight: hasSelectedProvince ? 2 : 1
                                }}
                            >
                                {/* Popup แสดงรายละเอียด */}
                                <Popup>
                                    <div className="popup-content">
                                        {hasSelectedProvince ? (
                                            <div className="district-popup" style={{ textAlign: 'center', padding: '4px 8px' }}>
                                                <h4 className="popup-title" style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 'bold' }}>
                                                    อำเภอ {district_name}
                                                </h4>
                                                <div className="popup-row" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                                    <span style={{ color: '#666' }}>Risk Score:</span>
                                                    <strong style={{ color: color, fontSize: '14px' }}>
                                                        {score.toFixed(2)} 
                                                    </strong>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
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

                                            </div>
                                        </div>
                                        )}
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