import json
import os

import numpy as np
from shapely import STRtree, points as make_points
from shapely.geometry import shape

GEO_DIR = os.path.dirname(os.path.abspath(__file__))
SUB_FILE = os.path.join(GEO_DIR, "subdistricts.geojson")
DIST_FILE = os.path.join(GEO_DIR, "districts.geojson")

#ถ้าพิกัดไม่ตกในขอบเขตไหนเลย (ริมทะเล/ชายแดน/พิกัดคลาด) ยอมใช้ตำบลที่ใกล้ที่สุด
#ถ้าเกิน 5 กม.ปล่อยเป็นค่าว่าง
MAX_NEAREST_DEG = 0.05

class GeoAssigner:
    def __init__(self):
        with open(SUB_FILE, encoding="utf-8") as f:
            sub = json.load(f)["features"]
        with open(DIST_FILE, encoding="utf-8") as f:
            dist = json.load(f)["features"]

        self.sub_geoms = [shape(x["geometry"]) for x in sub]
        self.sub_props = [x["properties"] for x in sub]
        self.sub_tree = STRtree(self.sub_geoms)

        self.dist_geoms = [shape(x["geometry"]) for x in dist]
        self.dist_props = [x["properties"] for x in dist]
        self.dist_tree = STRtree(self.dist_geoms)

    def assign(self, lat, lon):
        """รับ array ของ lat/lon คืน dict ของ list ความยาวเท่ากัน + วิธีที่จับคู่ได้"""
        lat = np.asarray(lat, dtype=float)
        lon = np.asarray(lon, dtype=float)
        n = len(lat)
        pts = make_points(lon, lat)  #shapely ใช้ลำดับ (x=lon, y=lat)

        sub_code = [None] * n
        dist_code = [None] * n
        tambon = [None] * n
        method = ["none"] * n

        #1)จุดตกในตำบลไหน (polygon จริง)
        pt_idx, poly_idx = self.sub_tree.query(pts, predicate="within")
        for i, j in zip(pt_idx, poly_idx):
            if method[i] == "none":  #ตำบลซ้อนทับกันเล็กน้อย เอาตัวแรกที่เจอ
                p = self.sub_props[j]
                sub_code[i] = p["tam_code"]
                dist_code[i] = p["amp_code"]
                tambon[i] = p["tam_th"]
                method[i] = "polygon"

        #2)จุดที่ไม่ตกตำบลใด: ลองใช้ขอบเขตอำเภอแทนเพื่ออย่างน้อยจะได้ district_code ที่ถูก
        miss = [i for i in range(n) if method[i] == "none"]
        if miss:
            m_pts = pts[miss]
            pi, di = self.dist_tree.query(m_pts, predicate="within")
            for k, j in zip(pi, di):
                i = miss[k]
                if method[i] == "none":
                    dist_code[i] = self.dist_props[j]["amp_code"]
                    method[i] = "district_only"

        #3)ยังไม่ได้เลย: ตำบลที่ใกล้ที่สุดในระยะที่ยอมรับ
        miss = [i for i in range(n) if method[i] in ("none", "district_only")]
        if miss:
            m_pts = pts[miss]
            near_idx = self.sub_tree.nearest(m_pts)
            for k, j in enumerate(near_idx):
                i = miss[k]
                if j is None or np.isnan(lat[i]) or np.isnan(lon[i]):
                    continue
                d = m_pts[k].distance(self.sub_geoms[j])
                if d <= MAX_NEAREST_DEG:
                    p = self.sub_props[j]
                    sub_code[i] = p["tam_code"]
                    tambon[i] = p["tam_th"]
                    #ถ้ามี district_code จากขอบเขตอำเภอแล้ว ให้เชื่อของอำเภอ
                    if dist_code[i] is None:
                        dist_code[i] = p["amp_code"]
                    method[i] = "nearest"

        return {
            "subdistrict_code": sub_code,
            "district_code": dist_code,
            "tambon": tambon,
            "geo_method": method,
        }


#โหมดบรรทัดคำสั่ง: เติมรหัสพื้นที่ให้ไฟล์ CSV (เรียกจาก backend/routes/auth.js)
def _code_str(v):
    """รหัสเป็นสตริงตัวเลขล้วน (เช่น 100101) ว่างถ้าไม่มี"""
    import pandas as pd
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        return str(v).strip()


def _cli(src, dst):
    import sys
    import pandas as pd

    df = pd.read_csv(src, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    for col in ("latitude", "longitude"):
        if col not in df.columns:
            print(f"ไม่พบคอลัมน์ {col}")
            sys.exit(1)

    lat = pd.to_numeric(df["latitude"], errors="coerce")
    lon = pd.to_numeric(df["longitude"], errors="coerce")
    valid = (lat.notna() & lon.notna()).to_numpy()

    n = len(df)
    sub = [""] * n
    dist = [""] * n
    tambon = [""] * n
    method = ["none"] * n

    if valid.any():
        idx = valid.nonzero()[0]
        r = GeoAssigner().assign(lat.to_numpy()[idx], lon.to_numpy()[idx])
        for k, i in enumerate(idx):
            sub[i] = _code_str(r["subdistrict_code"][k])
            dist[i] = _code_str(r["district_code"][k])
            tambon[i] = r["tambon"][k] or ""
            method[i] = r["geo_method"][k]

    df["subdistrict_code"] = sub
    df["district_code"] = dist
    df["tambon"] = tambon
    df["geo_method"] = method
    df.to_csv(dst, index=False, encoding="utf-8")


if __name__ == "__main__":
    import sys
    _cli(sys.argv[1], sys.argv[2])