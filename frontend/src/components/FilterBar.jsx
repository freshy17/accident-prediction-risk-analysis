import { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { getYearList, getProvinceList, getFilterOptions } from "../api/apiService";
import { DAY_TYPE_MAP } from "../utils/labels";

const FilterBar = ({ filters, setFilters, onReset }) => {
  const [yearList, setYearList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [timeRanges, setTimeRanges] = useState([]);
  const [dayTypes, setDayTypes] = useState([]);
  const [yearsLoaded, setYearsLoaded] = useState(false);

  //ดึงข้อมูลปี จังหวัด ช่วงเวลา และประเภทวัน ตอนเปิดหน้าเว็บ
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [yearData, provinceData, optionData] = await Promise.all([
          getYearList(),
          getProvinceList(),
          //ถ้าดึงตัวเลือกไม่สำเร็จ ให้ปีกับจังหวัดยังแสดงได้ตามปกติ
          getFilterOptions().catch((err) => {
            console.error("Error fetching filter options:", err);
            return null;
          }),
        ]);

        console.log("ปีที่ได้จาก Backend:", yearData);
        console.log("จังหวัดที่ได้จาก Backend:", provinceData);

        setYearList(yearData?.data || []);
        setProvinceList(provinceData?.data || []);

        const opt = optionData?.data || optionData;
        setTimeRanges(opt?.timeRanges || []);
        setDayTypes(opt?.dayTypes || []);

        setYearsLoaded(true);
      } catch (error) {
        console.error("Error fetching dropdown data:", error);
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
    const first = yearList[0]?.year ?? yearList[0]; // API เรียงปีล่าสุดขึ้นก่อน
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
        province_name: selectedProv ? selectedProv.pro_name_th : "",
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  return (
    <div className="filter-card">
      <div className="filter-grid">
        {/* เลือกปี */}
        <div className="form-group">
          <label className="form-label">เลือกปี</label>
          <select
            name="year"
            value={filters?.year || ""}
            onChange={handleChange}
            className="form-select"
            disabled={!yearsLoaded || yearList.length === 0}
          >
            {!yearsLoaded ? (
              <option value="">กำลังโหลดข้อมูลปี...</option>
            ) : yearList.length === 0 ? (
              <option value="">ไม่มีข้อมูลในระบบ</option>
            ) : (
              yearList.map((item, index) => {
                const value = item.year || item;
                return (
                  <option key={index} value={value}>
                    พ.ศ. {Number(value) + 543} ({value})
                  </option>
                );
              })
            )}
          </select>
        </div>

        {/* จังหวัด */}
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

        {/* ช่วงเวลา */}
        <div className="form-group">
          <label className="form-label">ช่วงเวลา</label>
          <select
            name="timeRange"
            value={filters?.timeRange || ""}
            onChange={handleChange}
            className="form-select"
          >
            <option value="">--ทั้งหมด--</option>
            {timeRanges.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* ประเภทวัน + ปุ่ม Reset */}
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
              {dayTypes.map((d) => (
                <option key={d} value={d}>
                  {DAY_TYPE_MAP[d] || d}
                </option>
              ))}
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