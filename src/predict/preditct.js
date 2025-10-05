import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './predict.css'; // For basic styling

// Define the cities and their corresponding data files
const cityDataFiles = {
  'Hanoi': '/data/hanoi_monthly_long.csv',
  'Ho Chi Minh City': '/data/hcm_monthly_long.csv',
  'Jakarta': '/data/Jakarta_monthly_long.csv',
  'Kuala Lumpur': '/data/KL_monthly_long.csv',
  'Manila': '/data/Manila_monthly_long.csv',
  'Vientiane': '/data/Vientiane_monthly.csv',
};

const CITIES = Object.keys(cityDataFiles);

// Helper function to parse CSV data
const parseCSV = (csvText, city) => {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const data = lines.slice(1).map(line => {
    const values = line.split(',');
    const entry = headers.reduce((obj, header, index) => {
      obj[header] = values[index].trim();
      return obj;
    }, {});
    return entry;
  });
  return data;
};

// Helper to normalize data from different CSV formats into a consistent structure for the chart
const normalizeDataForChart = (parsedData, city) => {
  if (!parsedData || parsedData.length === 0) return [];

  // Vientiane has a different, historical format
  if (city === 'Vientiane') {
    return parsedData.map(d => ({
      name: `${d.Year}-${String(d.Month_num).padStart(2, '0')}`,
      'PM2.5 Level': parseFloat(d['PM2.5']),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  // All other cities have the projected format: Year,Month,Level (AVG)
  return parsedData.map(d => ({
    name: `${d.Year}-${String(d.Month).padStart(2, '0')}`,
    'PM2.5 Level': parseFloat(d['Level (AVG)']),
  })).sort((a, b) => a.name.localeCompare(b.name));
};


function Predict() {
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const filePath = cityDataFiles[selectedCity];
      try {
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        const parsedData = parseCSV(csvText, selectedCity);
        const normalizedData = normalizeDataForChart(parsedData, selectedCity);
        setChartData(normalizedData);
      } catch (e) {
        setError(`Failed to load data for ${selectedCity}. Please check if the file exists at ${filePath}.`);
        setChartData([]);
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCity]);

  return (
    <div className="predict-container">
      <h1 className="predict-title">PM2.5 Monthly Prediction</h1>
      <div className="predict-selector-wrapper">
        <label htmlFor="city-selector">Select a City:</label>
        <select
          id="city-selector"
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="predict-selector"
        >
          {CITIES.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      <div className="predict-chart-wrapper">
        {loading && <p>Loading chart data...</p>}
        {error && <p className="predict-error">{error}</p>}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
              <YAxis label={{ value: 'PM2.5 (µg/m³)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="PM2.5 Level" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && chartData.length === 0 && (
            <p>No data available for the selected city.</p>
        )}
      </div>
    </div>
  );
}

export default Predict;