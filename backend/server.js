const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

//import routes
const provinceRoutes = require('./routes/provinces');
const districtRoutes = require('./routes/districts');
const accidentRoutes = require('./routes/accidents');
const risk_scoresRoutes = require('./routes/risk_scores');
const hotspotsRoutes = require('./routes/hotspots');
const summariesRoutes = require('./routes/summaries');

//api ทดสอบว่า server ทำงานได้ปกติไหม
app.get('/', (req, res) => {
    res.send('Accident Database API is running!');
});

app.use('/api/provinces', provinceRoutes);
app.use('/api/districts', districtRoutes);
app.use('/api/accidents', accidentRoutes);
app.use('/api/risk_scores', risk_scoresRoutes);
app.use('/api/hotspots', hotspotsRoutes);
app.use('/api/summaries', summariesRoutes);

//สั่งให้ server ทำงาน
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});