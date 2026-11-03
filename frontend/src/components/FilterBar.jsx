import { useState, useEffect} from "react";
import { RotateCcw } from "lucide-react";
import { getYearList, getProvinceList } from "../api/apiService";

const FilterBar = ({ filters, setFilters, onReset }) => {
  const [yearList, setYearList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [yearsLoaded, setYearsLoaded] = useState(false);

//ดึงข้อมูลปีและจังหวัดตอนเปิดหน้าเว็บ
useEffect(() => {
  const fetchDropdownData = async () => {
    try {
        const [yearData, provinceData] = await Promise.all([
          getYearList(),
          getProvinceList()
        ]);

      console.log("ปีที่ได้จาก Backend:", yearData);
      console.log("จังหวัดที่ได้จาก Backend:", provinceData);    

        setYearList(yearData?.data || []);
        setProvinceList(provinceData?.data || []);
        setYearsLoaded(true);
    } catch (error) {
      console.error("Error fetching dropdown data:", error)
    }
  };

  fetchDropdownData();
}, []);

//ถ้าปีที่เลือกอยู่ไม่มีในฐานข้อมูล ให้เปลี่ยนเป็นปีล่าสุดที่มีจริง (หรือว่างถ้าไม่มีข้อมูลเลย)
useEffect(() => {
  if (!yearsLoaded) return;
  const years = yearList.map((item) => String(item.year || item));
  const current = String(filters?.year ?? "");

  if (years.length === 0) {
    if (current !== "") setFilters((prev) => ({ ...prev, year: "" }));
  } else if (!years.includes(current)) {
    setFilters((prev) => ({ ...prev, year: years[0] })); //backend เรียงปีใหม่ไปเก่า
  }
}, [yearsLoaded, yearList, filters?.year]);

useEffect(() => {
  if (filters?.year || yearList.length === 0) return;
  const first = yearList[0]?.year ?? yearList[0];   // API เรียงปีล่าสุดขึ้นก่อน
  setFilters((prev) => (prev.year ? prev : { ...prev, year: String(first) }));
}, [yearList, filters?.year]);

const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "province") {
        const selectedProv = provinceList.find(
            (p) => String(p.province_code) === String(value)
        );
        
        setFilters((prev) => ({
            ...prev,
            province: value,
            province_name: selectedProv ? selectedProv.pro_name_th : ""
        }));
    } else {
        setFilters((prev) => ({
            ...prev,
            [name]: value
        }));
    }
};

  return (
    <div className="filter-card">
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
            {yearList?.map((item, index) => {
              const value = item.year || item;
              return (
                <option key={index} value={value}>
                พ.ศ. {Number(value) + 543} ({value}) 
              </option>
              );
            })}
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
            <option value="">--ทั้งประเทศ--</option>
            {provinceList?.map((prov) => (
              <option key={prov.province_code} value={prov.province_code}>
                {prov.pro_name_th}
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
           <option value="">--ทั้งหมด--</option>
           <option value="เช้ามืด (04:00 - 07:59)">เช้ามืด (04:00 - 07:59)</option>
           <option value="เช้า (08:00 - 11:59)">เช้า (08:00 - 11:59)</option>
           <option value="บ่าย (12:00 - 15:59)">บ่าย (12:00 - 15:59)</option>
           <option value="เย็น (16:00 - 19:59)">เย็น (16:00 - 19:59)</option>
           <option value="กลางคืน (20:00 - 23:59)">กลางคืน (20:00 - 23:59)</option>
           <option value="ดึก (00:00 - 03:59)">ดึก (00:00 - 03:59)</option>
           <option value="ไม่ระบุ">ไม่ระบุ</option>
          </select>
        </div>

        {/*  ประเภทวัน + ปุ่ม Reset */}
        <div className="filter-action-group">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">ประเภทวัน</label>
            <select
              name="dayType"
              value={filters?.dayType || ""}
              onChange={handleChange}
              className="form-select"
            >
              <option value="">--ทั้งหมด--</option>
              <option value="normal">วันธรรมดา (จ.-ศ.)</option>
              <option value="weekend">วันหยุดสุดสัปดาห์ (ส.-อา.)</option>
              <option value="new_year">เทศกาลปีใหม่</option>
              <option value="songkran">เทศกาลสงกรานต์</option>
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