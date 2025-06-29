const openWeatherApiKey = "ed03c60b237355c3fb689a8a4a2706ee";

const weatherDiv = document.getElementById("weather");
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationNameEl = document.getElementById("locationName");
const dateSelector = document.getElementById("dateSelector");
const szottyadasSzintEl = document.getElementById("szottyadasSzint");

let weatherDataGlobal = null;  // Globális időjárásadatok tárolása
let selectedDate = null;        // Kiválasztott dátum (YYYY-MM-DD)

// VÁROS KERESÉS GOMB ÉS ENTER ESEMÉNYKEZELŐK
searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (city) getWeatherByCity(city);
});
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const city = cityInput.value.trim();
    if (city) getWeatherByCity(city);
  }
});

// AUTOMATIKUS HELYMEGHATÁROZÁS OLDAL BETÖLTÉSKOR
window.onload = () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        getWeatherByCoords(latitude, longitude);
      },
      (error) => {
        console.warn("Helymeghatározási hiba:", error.message);
        locationNameEl.textContent = "Város: -- (helyadat nem elérhető)";
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    locationNameEl.textContent = "A böngésző nem támogatja a helymeghatározást.";
  }
};

// VÁROS KOORDINÁTÁINAK LEKÉRÉSE NÉV ALAPJÁN
async function getWeatherByCity(city) {
  weatherDiv.textContent = "⏳ Betöltés...";
  locationNameEl.textContent = "Város: ...";
  dateSelector.innerHTML = "";

  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${openWeatherApiKey}`
    );
    const geoData = await geoRes.json();

    if (!geoData.length) {
      weatherDiv.textContent = "❌ Nem található a város!";
      locationNameEl.textContent = "Város: --";
      return;
    }

    const { lat, lon, name } = geoData[0];
    cityInput.value = name;
    getWeatherByCoords(lat, lon, name);
  } catch (e) {
    console.error(e);
    weatherDiv.textContent = "❌ Hiba történt az adatok lekérésekor.";
    locationNameEl.textContent = "Város: --";
  }
}

// IDŐJÁRÁS LEKÉRÉSE KOORDINÁTÁK ALAPJÁN
async function getWeatherByCoords(lat, lon, cityName = null) {
  weatherDiv.textContent = "⏳ Betöltés...";
  locationNameEl.textContent = cityName
    ? `Város: ${cityName}`
    : `Város: ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  dateSelector.innerHTML = "";

  try {
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,daily,alerts&units=metric&lang=hu&appid=${openWeatherApiKey}`
    );
    const weatherData = await weatherRes.json();

    weatherDataGlobal = weatherData;
    createDateButtons();

    // Alapértelmezett a mai nap legyen kiválasztva
    const todayStr = new Date().toISOString().split("T")[0];
    selectDate(todayStr);
  } catch (e) {
    console.error(e);
    weatherDiv.textContent = "❌ Hiba történt az időjárás lekérésekor.";
  }
}

// DÁTUM VÁLASZTÓ GOMBOK LÉTREHOZÁSA (3 NAP: MA, HOLNAP, HOLNAPUTÁN)
function createDateButtons() {
  dateSelector.innerHTML = "";
  const now = new Date();

  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const isoDate = d.toISOString().split("T")[0];
    const displayDate = ("0" + (d.getMonth() + 1)).slice(-2) + "." + ("0" + d.getDate()).slice(-2);

    const btn = document.createElement("button");
    btn.textContent = displayDate;
    btn.classList.add("date-button");
    btn.dataset.date = isoDate;

    btn.addEventListener("click", () => selectDate(isoDate));

    dateSelector.appendChild(btn);
  }
}

// ADOTT NAP IDŐJÁRÁSÁNAK MEGJELENÍTÉSE
function renderWeatherForDate(dateStr) {
  if (!weatherDataGlobal) return;

  // Kiszűrjük a kiválasztott nap óráit
  const hoursForDay = weatherDataGlobal.hourly.filter((h) => {
    const dt = new Date(h.dt * 1000);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    const localDate = `${y}-${m}-${d}`;
    return localDate === dateStr;
  });

  if (hoursForDay.length === 0) {
    weatherDiv.innerHTML = "<p>Nem elérhető adat erre a napra.</p>";
    return;
  }

  // Hőmérsékleti statisztikák
  const temps = hoursForDay.map(h => h.temp);
  const avgTemp = (temps.reduce((a,b) => a + b, 0) / temps.length).toFixed(1);
  const maxTemp = Math.max(...temps).toFixed(1);
  const minTemp = Math.min(...temps).toFixed(1);

  // Szottyadás mérce frissítése
  frissitsSzottyadasMerce(parseFloat(avgTemp));

  const now = new Date();
  const currentHour = now.getHours();
  const currentDateStr = now.toISOString().split("T")[0];

  weatherDiv.innerHTML = `
    <h2>${dateStr === currentDateStr ? "Mai nap" : dateStr}</h2>
    <p><strong>Átlag: ${avgTemp}°C | Max: ${maxTemp}°C | Min: ${minTemp}°C</strong></p>
    <div class="weather-container">
      ${hoursForDay.map(h => renderHour(h, dateStr === currentDateStr, currentHour)).join("")}
    </div>
  `;
}

// ÓRÁNKÉNTI IDŐJÁRÁS KÁRTYA MEGJELENÍTÉSE
function renderHour(hour, isToday, currentHour) {
  const dt = new Date(hour.dt * 1000);
  const hh = dt.getHours().toString().padStart(2, "0");
  const temp = Math.round(hour.temp);
  const originalDesc = hour.weather[0].description.toLowerCase();
  const desc = customDescriptions[originalDesc] || hour.weather[0].description;
  const icon = hour.weather[0].icon;
  const iconUrl = `https://openweathermap.org/img/wn/${icon}@2x.png`;

  const isCurrentHour = isToday && dt.getHours() === currentHour;

  return `
    <div class="weather-card${isCurrentHour ? " current-hour" : ""}">
      <strong>${hh}:00</strong><br />
      <img src="${iconUrl}" alt="${desc}" title="${desc}" style="width:48px; height:48px;" /><br />
      🌡️ ${temp}°C<br />
      ☁️ ${desc}
    </div>
  `;
}

// SZOTTYADÁS LEÍRÁSOK
const customDescriptions = {
  "tiszta égbolt": "Nincs zötyi az égen",
  "enyhén felhős": "Pár zötyike lebeg az égen",
  "kevés felhő": "Pár zötyi pihenget az égen",
  "részben felhős": "Zötyi csak részidőben van jelen",
  "többnyire felhős": "Zötyik már uralják az eget",
  "felhős égbolt": "Zötyi mindenütt",
  "erősen felhős": "Durva zötyitakarás",
  "borult égbolt": "Teljes zötyitakarás, no napfény",
  "köd": "Zötyi a föld szintjén, semmit se látsz",
  "füst": "Zötyiszagú a levegő",
  "hamu": "Zötyihamu hullik le",
  "szmog": "Ragacsos zötyilevegő",
  "por": "Száll a zötyipor mindenfelé",
  "homok": "Zötyi homokkal spékelve",
  "homokvihar": "Zötyi tomboló porral",
  "száraz köd": "Párás zötyike burkol be",
  "zápor": "Roncik potyognak bőszen",
  "eső": "RONCII ESIIIK, nedves roncis idő",
  "enyhe eső": "Csak csepeg, de zötyis",
  "mérsékelt eső": "Normálisan roncizik",
  "heves eső": "Zúdul a zötyifelhőből",
  "záporok": "Zötyifürdő szakaszosan",
  "heves zápor": "Rohadó zötyizápor",
  "intenzív zápor": "Nagyon zötyis",
  "szitáló eső": "Finom ronciszitálás",
  "jégeső": "Ronci jég módba kapcsolt",
  "havazás": "Ronci potyog pelyhekben",
  "enyhe havazás": "Csak picit zötyizik",
  "heves havazás": "Totális zötyihócsapás",
  "havas eső": "Vegyes zötyi: víz + hó",
  "hózápor": "Zötyihó sprintel lefelé",
  "jég": "Kőkemény zötyifagy",
  "havaseső": "Zötyis zagyvaság hullik",
  "zivatar": "Zötyi tombol, dorcájka dörög",
  "enyhe zivatar": "Zötyike csak próbálkozik",
  "erős zivatar": "Totál dorcázós zötyi",
  "villámlás esővel": "Dorcájka + ronci kombó",
  "villámlás eső nélkül": "Száraz dorcájka-villanás",
  "széllökés": "Zötyiszél borzolja a hajad",
  "viharos szél": "Zötyihurrikán jelleg",
  "tornádó": "Totál zötyipusztító mód",
  "párás idő": "Zötyi lebeg a semmiben",
  "ködös idő": "Zötyihomály mindenhol",
  "derült idő": "Zötyimentes örömnap",
};

// SZOTTYADÁS MÉRCE KISZÁMOLÁSA HŐMÉRSÉKLET ALAPJÁN
function szamitsSzottyadasSzint(homerseklet) {
  if (homerseklet <= -5) return 1;
  if (homerseklet <= 0) return 2;
  if (homerseklet <= 5) return 3;
  if (homerseklet <= 10) return 4;
  if (homerseklet <= 18) return 5;
  if (homerseklet <= 24) return 6;
  if (homerseklet <= 29) return 7;
  if (homerseklet <= 32) return 8;
  if (homerseklet <= 35) return 9;
  return 10;
}

// SZOTTYADÁS MÉRCE FRISSÍTÉSE A KIJELZŐN
function frissitsSzottyadasMerce(homerseklet) {
  const szint = szamitsSzottyadasSzint(homerseklet);
  szottyadasSzintEl.textContent = szint;

  const szintElemek = document.querySelectorAll(".szint");
  szintElemek.forEach((elem, index) => {
    if (index < szint) {
      elem.classList.add("active");
    } else {
      elem.classList.remove("active");
    }
  });
}

// Ezzel a kóddal indul az egész, akár a gép helyzetével, akár városkereséssel.
