import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, AlertTriangle, Zap } from 'lucide-react';

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

//Mock Data พิกัดจุดเสี่ยงสำหรับทดสอบ
const defaultMockAccidents = [
  { id: 1, lat: 13.7563, lng: 100.5018, location: 'ถนนสุขุมวิท กรุงเทพฯ', deaths: 2, injuries: 5, severity: 'high' },
  { id: 2, lat: 18.7883, lng: 98.9853, location: 'ถนนซุปเปอร์ไฮเวย์ เชียงใหม่', deaths: 0, injuries: 3, severity: 'medium' },
  { id: 3, lat: 7.8804, lng: 98.3923, location: 'ถนนเทพกระษัตรี ภูเก็ต', deaths: 1, injuries: 1, severity: 'high' },
  { id: 4, lat: 14.9707, lng: 102.0882, location: 'ถนนมิตรภาพ นครราชสีมา', deaths: 0, injuries: 2, severity: 'low' },
];

function MapView({ accidentData = defaultMockAccidents }) {
    //พิกัดจุดศูนย์กลางประเทศไทย
    const thailandCenter = [13.736717, 100.523186];

    return (
        <div className="map-card">
            <div className="map-header">
                <MapPin size={20} color="#dc2626"/>
                <h3>แผนที่แสดงจุดเสี่ยงอุบัติเหตุ</h3>
            </div>

            <div className="map-container-wrapper">
                <MapContainer
                    center={thailandCenter}
                    zoom={5}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {accidentData.map((item) => (
                        <Marker key={item.id} position={[item.lat, item.lng]}>
                            <Popup>
                                <div className="popup-content">
                                    <h4 className="popup-title">{item.location}</h4>
                                    <div className="popup-details">
                                        <span>🔴 ผู้เสียชีวิต: <strong>{item.deaths}</strong> ราย</span>
                                        <span>🟡 ผู้บาดเจ็บ: <strong>{item.injuries}</strong> ราย</span>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
};

export default MapView;