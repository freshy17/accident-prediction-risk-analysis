import { Activity, Settings } from "lucide-react";

const NavBar = ( { onAdminClick }) => {
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

            <div className="nav-bar-actions">
                <button
                    onClick={onAdminClick}
                    title="Admin Login"
                    className="setting-btn"
                >
                    <Settings size={24} className="gear-icon" />
                </button>
            </div>
        </nav>
    );
};

export default NavBar;