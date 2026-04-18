export async function getGeoHash() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    return data.country_name || null;
  } catch (err) {
    console.error('Error fetching geo location:', err);
    return null;
  }
}