const openWeatherApiKey = "ed03c60b237355c3fb689a8a4a2706ee";

const weatherDiv = document.getElementById("weather");
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationNameEl = document.getElementById("locationName");
const dateSelector = document.getElementById("dateSelector");

let weatherDataGlobal = null; // tárolja a lekért adatokat
let selectedDate = null; // kiválasztott dátum string (YYYY-MM-DD)

searchBtn.addEventListener("click", () => {
  const city = cityInput.value.trim();
  if (city) {
    getWeatherByCity(city);
  }
});

cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const city = cityInput.value.trim();
    if (city) {
      getWeatherByCity(city);
    }
  }
});

// AUTOMATIKUS HELYMEGHATÁROZÁS
window.onload = () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log("Pozíció megkapva:", latitude, longitude);
        getWeatherByCoords(latitude, longitude);
      },
      (error) => {
        console.error("Helymeghatározási hiba:", error);
        locationNameEl.textContent = "Város: -- (helyadat nem elérhető)";
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  } else {
    locationNameEl.textContent = "A böngésző nem támogatja a helymeghatározást.";
  }
};


async function getWeatherByCity(city) {
  weatherDiv.innerHTML = "⏳ Betöltés...";
  locationNameEl.textContent = "Város: ...";
  dateSelector.innerHTML = "";

  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        city
      )}&limit=1&appid=${openWeatherApiKey}`
    );
    const geoData = await geoRes.json();

    if (!geoData.length) {
      weatherDiv.innerHTML = "❌ Nem található a város!";
      locationNameEl.textContent = "Város: --";
      return;
    }

    const { lat, lon, name } = geoData[0];
    cityInput.value = name;

    getWeatherByCoords(lat, lon, name);
  } catch (error) {
    console.error(error);
    weatherDiv.innerHTML = "❌ Hiba történt az adatok lekérésekor.";
    locationNameEl.textContent = "Város: --";
  }
}

async function getWeatherByCoords(lat, lon, cityName) {
  weatherDiv.innerHTML = "⏳ Betöltés...";
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

    // dátumok legyártása (7 napra előre)
    createDateButtons();

    // alapértelmezett kiválasztott nap: mai nap
    const todayStr = new Date().toISOString().split("T")[0];
    selectDate(todayStr);
  } catch (error) {
    console.error(error);
    weatherDiv.innerHTML = "❌ Hiba történt az időjárás lekérésekor.";
  }
}

function createDateButtons() {
  dateSelector.innerHTML = "";
  const today = new Date();

  for (let i = 0; i < 3; i++) {
    const date = new Date(today.getTime() + i * 86400000);
    const isoStr = date.toISOString().split("T")[0];
    const displayStr =
      ("0" + (date.getMonth() + 1)).slice(-2) + "." + ("0" + date.getDate()).slice(-2);

    const btn = document.createElement("button");
    btn.classList.add("date-button");
    btn.textContent = displayStr;
    btn.dataset.date = isoStr;

    btn.addEventListener("click", () => {
      selectDate(isoStr);
    });

    dateSelector.appendChild(btn);
  }
}

function renderWeatherForDate(dateStr) {
  if (!weatherDataGlobal) return;

  const hoursForDay = weatherDataGlobal.hourly.filter((hour) => {
    const dt = new Date(hour.dt * 1000);
    return dt.toISOString().startsWith(dateStr);
  });

  if (hoursForDay.length === 0) {
    weatherDiv.innerHTML = `<p>Nem elérhető adat erre a napra.</p>`;
    return;
  }

  // Átlag, max, min hőmérséklet számítása
  const temps = hoursForDay.map(h => h.temp);
  const avgTemp = (temps.reduce((a,b) => a + b, 0) / temps.length).toFixed(1);
  const maxTemp = Math.max(...temps).toFixed(1);
  const minTemp = Math.min(...temps).toFixed(1);

  const now = new Date();
  const currentHour = now.getHours();
  const currentDateStr = now.toISOString().split("T")[0];

  weatherDiv.innerHTML = `
    <div class="day-section">
      <h2>${dateStr === currentDateStr ? "Mai nap" : dateStr}</h2>
      <p><strong>Átlag: ${avgTemp}°C | Max: ${maxTemp}°C | Min: ${minTemp}°C</strong></p>
      <div class="weather-container">
        ${hoursForDay
          .map(hour => renderHour(hour, dateStr === currentDateStr, currentHour))
          .join("")}
      </div>
    </div>
  `;
}


function renderHour(hour, isToday, currentHour) {
  const dt = new Date(hour.dt * 1000);
  const hh = dt.getHours().toString().padStart(2, "0");
  const temp = Math.round(hour.temp);
  const desc = hour.weather[0].description;
  const icon = hour.weather[0].icon;
  const iconUrl = `https://openweathermap.org/img/wn/${icon}@2x.png`;

  const isCurrentHour = isToday && dt.getHours() === currentHour;

  return `
    <div class="weather-card${isCurrentHour ? " current-hour" : ""}">
      <strong>${hh}:00</strong><br>
      <img src="${iconUrl}" alt="${desc}" title="${desc}" style="width:48px; height:48px;" /><br>
      🌡️ ${temp}°C<br>
      ☁️ ${desc}
    </div>
  `;
}

function renderEmptyHour() {
  return `
    <div class="weather-card" style="opacity:0.3; color:#888;">
      <strong>--:--</strong>
      <br>–<br>–
    </div>
  `;
}

function selectDate(dateStr) {
  selectedDate = dateStr;

  // Aktiváljuk a kiválasztott gombot, kikapcsoljuk a többit
  Array.from(dateSelector.children).forEach(btn => {
    btn.classList.toggle("active", btn.dataset.date === dateStr);
  });

  renderWeatherForDate(dateStr);
}

let watchId = null;

function startWatching() {
  if ("geolocation" in navigator) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        getWeatherByCoords(latitude, longitude);
      },
      (error) => {
        console.error("Helymeghatározási hiba:", error);
        locationNameEl.textContent = "Város: -- (helyadat nem elérhető)";
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  }
}

function stopWatching() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
}

// indítsd el pl window.onload-ban vagy mikor kell
startWatching();



const customDescriptions = {
  'tiszta égbolt': 'Tiszta a zötyi ég, roncájtól nemkell féni',
  'kevés felhő': 'Kevés ronci van az égen, egész fasza',
  'szórványos felhőzet': 'Roncáj észlelve, azért baszó',
  'megszakításokkal felhős': 'Roncik random felbukkannak az égen',
  'felhőzet': 'Ronci észlelve, de nem csepereg',
  'erősen felhős': 'Telibe ronci, dorciméter maxon',
  'borús égbolt': 'Borús a dorcájka',
  
  'záporeső': 'RONCIII!!! VIGYÁZZZ!!, eső lesz zötyi haza',
  'szakaszos eső': 'Egyszer van, egyszer nincs — tipikus dorcieső',
  'eső': 'RONCII ESIIIK, nedves roncis idő',
  'enyhe esö': 'Esik a dorciii de csak picikééétt',
  'közepes eső': 'Normál mennyiségű roncipatak',
  'heves eső': 'RONCIZUHATAG, dorcit elmoshatja',
  'hosszan tartó eső': 'Dorci szomorkás hosszú roncipatakban',
  'szakadó eső': 'Zúdul a ronci, tető aláaa',
  'jégeső': 'JÉGRONCIK hullanak! Sisakot vegyé!',
  'fagyott eső': 'Fagyott dorci koppan az ablakon',
  
  'zivatar': 'DORCI CSATTOG, villámlás',
  'enyhe zivatar': 'Pici dorcimorgás, de nem vészes',
  'heves zivatar': 'DORCIMAX vihar, zötyi bunkerbe!',
  'zivatar esővel': 'Villámcsapás és roncipatak, együtt a buli',
  'zivatar hóval': 'Villámlik, de hó is jön — dorcifura!',
  
  'hó': 'Esik a hó, ronci boldog',
  'enyhe havazás': 'Pihe-puha hó ronci módra',
  'havazás': 'Száll a hó, dorci örül',
  'erős havazás': 'Roncilavina jön, hógolyózz!',
  'hózápor': 'Hirtelen hórobbanás dorci felett',
  'havas eső': 'Dorci nem tudja, most esik vagy havazik',
  'jégtű': 'Jégcsapok szurkálnak, roncikesztyűt fel!',
  'fagyott szitálás': 'Dorci jegesen köhécselget',

  'köd': 'Ködös, dorci befingott',
  'homályos': 'Valami ronciködféle, nem tiszta',
  'füst': 'Valaki égeti a dorcit a zötyi alatt',
  'szmog': 'RONCIFÜST mindenütt, ne szívjál bele',
  'hamu': 'RONCIHÁBORÚ? Hamu hullik az égből',
  'por': 'Minden poros, dorci már prüszköl',
  'szélfútta homok': 'Ronciszél tolja a homokot, zötyögj óvatosan',

  'széllökés': 'Dorci majdnem elrepül a széllel',
  'tornádó': 'DORCINÁDÓ! Csavargó szél',
  'trópusi vihar': 'Forró szél és víz dorcimódra',
  'tölcsérfelhő': 'Fél dorcit beszippantotta egy tölcsér'
};