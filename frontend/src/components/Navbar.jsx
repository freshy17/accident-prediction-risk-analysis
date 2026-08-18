import React from "react";
import { Activity } from "lucide-react";

const NavBar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <div className="icon-box">
                    <Activity />
                </div>
                <div>
                    <h1 className="navbar-title">
                        แผนที่แสดงจุดเสี่ยงอุบัติเหตุบนโครงข่ายทางหลวงในประเทศไทย
                    </h1>
                    <p className="navbar-subtitle"> 
                        (ทางหลวงแผ่นดิน / ทางหลวงชนบท / และทางพิเศษ)
                    </p>
                </div>
            </div>
        </nav>
    );
};

export default NavBar;