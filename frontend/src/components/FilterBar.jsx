import React from "react";
import { Filter, Flame, RotateCcw } from "lucide-react";

const FilterBar = ({ filters, setfilters, yearList, provinceList, onReset }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setfilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="filter-card">
      <div className="filter-header">
        <Filter size={16} color="#2563eb" />
        <span>ตัวกรองข้อมูล (Filters)</span>
      </div>

      <div className="filter-grid">
        {/*  เลืือกปี */}
        <div className="form-group">
          <label className="form-label">เลือกปี</label>
          <select
            name="year"
            value={filters?.year || ""}
            onChange={handleChange}
            className="form-select"
          >
            {yearList?.map((item) => (
              <option key={item.year} value={item.year}>
                พ.ศ. {Number(item.year) + 543} ({item.year}) 
              </option>
            ))}
          </select>
        </div>

        {/*  จังหวัด */}
        <div className="form-group">
          <label className="form-label">จังหวัด</label>
          <select
            name="province"
            value={filters?.province || ""}
            onChange={handleChange}
            className="form-select"
          >
            <option value="">-- ทั้งประเทศ --</option>
            {provinceList?.map((prov) => (
              <option key={prov.code} value={prov.code}>
                {prov.name_th}
              </option>
            ))}
          </select>
        </div>

        {/*  ช่วงเวลา */}
        <div className="form-group">
          <label className="form-label">ช่วงเวลา</label>
          <select
            name="timeRange"
            value={filters?.timeRange || ""}
            onChange={handleChange}
            className="form-select"
          >
            <option value="">ทั้งหมด</option>
            <option value="morning">เช้า (06:00 - 11:59)</option>
            <option value="afternoon">บ่าย (12:00 - 17:59)</option>
            <option value="night">กลางคืน (18:00 - 05:59)</option>
          </select>
        </div>

        {/*  ปรพเภทวัน + ปุ่ม Reset */}
        <div className="filter-action-group">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">ประเภทวัน</label>
            <select
              name="dayType"
              value={filters?.dayType || ""}
              onChange={handleChange}
              className="form-select"
            >
              <option value="">ทั้งหมด</option>
              <option value="weekday">วันธรรมดา (จ.-ศ.)</option>
              <option value="weekend">วันหยุดสุดสัปดาห์ (ส.-อา.)</option>
              <option value="holiday">วันหยุดเทศกาล</option>
            </select>
          </div>

          <button onClick={onReset} title="รีเซ็ตตัวกรอง" className="reset-btn">
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
