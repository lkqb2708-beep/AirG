import vietnam from "./Vietnam.json";

const vietnamGeo = vietnam || { type: "FeatureCollection", features: [] };

export default vietnamGeo;