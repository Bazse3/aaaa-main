const openWeatherApiKey = "ed03c60b237355c3fb689a8a4a2706ee";

const weatherDiv = document.getElementById("weather");
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationNameEl = document.getElementById("locationName");
const dateSelector = document.getElementById("dateSelector");

let weatherDataGlobal = null;
let selectedDate = null;

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

window.onload = () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
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
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${openWeatherApiKey}`
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

async function getWeatherByCoords(lat, lon, cityName = null) {
  weatherDiv.innerHTML = "⏳ Betöltés...";
  locationNameEl.textContent = "Város: ...";
  dateSelector.innerHTML = "";

  try {
    // Ha nincs megadva városnév, kérjük le
    if (!cityName) {
      const geoRes = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${openWeatherApiKey}`
      );
      const geoData = await geoRes.json();
      if (geoData.length > 0) {
        cityName = geoData[0].name;
      } else {
        cityName = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      }
    }

    locationNameEl.textContent = `Város: ${cityName}`;

    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,daily,alerts&units=metric&lang=hu&appid=${openWeatherApiKey}`
    );
    const weatherData = await weatherRes.json();

    weatherDataGlobal = weatherData;
    createDateButtons();
    const todayStr = new Date().toISOString().split("T")[0];
    selectDate(todayStr);
  } catch (error) {
    console.error(error);
    weatherDiv.innerHTML = "❌ Hiba történt az időjárás lekérésekor.";
    locationNameEl.textContent = "Város: --";
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

  const now = new Date();
  const currentDateStr = now.toISOString().split("T")[0];
  const currentHour = now.getHours();

  const selected = new Date(dateStr + "T00:00:00");
  const nextDay = new Date(selected.getTime() + 24 * 60 * 60 * 1000);

  // 📦 Ha a mai napról van szó és nincs mentett adat, elmentjük
  if (dateStr === currentDateStr) {
    const fullTodayData = weatherDataGlobal.hourly.filter((hour) => {
      const dt = new Date(hour.dt * 1000);
      return dt >= selected && dt < nextDay;
    });

    // Csak ha legalább 1 óra van
    if (fullTodayData.length > 0) {
      localStorage.setItem("weather_backup_" + currentDateStr, JSON.stringify(fullTodayData));
    }
  }

  // 📥 Megnézzük, van-e mentett adat az adott napra
  const savedData = localStorage.getItem("weather_backup_" + dateStr);
  let hoursForDay;

  if (savedData) {
    hoursForDay = JSON.parse(savedData);
  } else {
    hoursForDay = weatherDataGlobal.hourly.filter((hour) => {
      const dt = new Date(hour.dt * 1000);
      return dt >= selected && dt < nextDay;
    });
  }

  // 🔁 ha nincs adat
  if (hoursForDay.length === 0) {
    weatherDiv.innerHTML = `<p>Nem elérhető adat erre a napra.</p>`;
    document.getElementById("atlag").innerHTML = "";
    frissitsSzottyadasMerce(null);
    return;
  }

  // ⏬ további renderelés változatlanul ...


  const temps = hoursForDay.map(h => h.temp);
  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;

  const avgTempStr = avgTemp.toFixed(1);
  const maxTemp = Math.max(...temps).toFixed(1);
  const minTemp = Math.min(...temps).toFixed(1);

  const isToday = (dateStr === currentDateStr);

  // Szottyadás mérce frissítése
  if (isToday) {
    const currentHourData = hoursForDay.find(h => {
      const hour = new Date(h.dt * 1000).getHours();
      return hour === currentHour;
    });
    if (currentHourData) {
      frissitsSzottyadasMerce(currentHourData.temp);
    } else {
      frissitsSzottyadasMerce(avgTemp); // fallback
    }
  } else {
    frissitsSzottyadasMerce(avgTemp);
  }

  // Átlag/max/min megjelenítése külön szekcióban
  const atlagDiv = document.getElementById("atlag");
  atlagDiv.innerHTML = `
    <h2>${isToday ? "Mai nap" : dateStr}</h2>
    <p><strong>Átlag: ${avgTempStr}°C | Max: ${maxTemp}°C | Min: ${minTemp}°C</strong></p>
  `;

  // Óránkénti kártyák megjelenítése külön
  weatherDiv.innerHTML = `
    <div class="weather-container">
      ${hoursForDay
        .map(hour => renderHour(hour, isToday, currentHour))
        .join("")}
    </div>
  `;
}


function renderHour(hour, isToday, currentHour) {
  const dt = new Date(hour.dt * 1000);
  const hh = dt.getHours().toString().padStart(2, "0");
  const temp = Math.round(hour.temp);
  const originalDesc = hour.weather[0].description;
  const desc = customDescriptions[originalDesc.toLowerCase()] || originalDesc;
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

function selectDate(dateStr) {
  selectedDate = dateStr;
  Array.from(dateSelector.children).forEach(btn => {
    btn.classList.toggle("active", btn.dataset.date === dateStr);
  });
  renderWeatherForDate(dateStr);
}

function szamitsSzottyadasSzint(homerseklet) {
  if (homerseklet <= -5) return 1;
  if (homerseklet <= 0) return 2;
  if (homerseklet <= 5) return 3;
  if (homerseklet <= 13) return 4;
  if (homerseklet <= 20) return 5;
  if (homerseklet <= 27) return 6;
  if (homerseklet <= 30) return 7;
  if (homerseklet <= 34) return 8;
  if (homerseklet <= 37) return 9;
  return 10;
}

function frissitsSzottyadasMerce(homerseklet) {
  const szint = szamitsSzottyadasSzint(homerseklet);
  document.getElementById("szottyadasSzint").textContent = szint;
  const sávok = document.querySelectorAll(".szint");
  sávok.forEach((sáv, index) => {
    if (index < szint) {
      sáv.classList.add("active");
    } else {
      sáv.classList.remove("active");
    }
  });
}

// Egyedi időjárási leírások
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


  const weather = document.getElementById("weather");

  function ellenorizWeatherTartalom() {
    if (weather.children.length === 0) {
      document.body.classList.add("weather-empty");
      console.log("empty");
    } else {
      document.body.classList.remove("weather-empty");
      console.log("van benne");
    }
  }

  ellenorizWeatherTartalom();

  const observer = new MutationObserver(ellenorizWeatherTartalom);
  observer.observe(weather, { childList: true });



  function toltReklamot(elemId, kulcs) {
    const target = document.getElementById(elemId);
    if (target) {
      const atOptions = {
        'key': kulcs,
        'format': 'iframe',
        'height': 90,
        'width': 728,
        'params': {}
      };
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = "//www.highperformanceformat.com/" + kulcs + "/invoke.js";
      target.appendChild(script);
    }
  }

  const szelesseg = window.innerWidth;

  if (szelesseg >= 768) {
    // 🖥️ Asztali eszköz – reklámok betöltése
    toltReklamot("ad1", "16bad07b7a4714bb272fd2eb08c44791"); // 468x60
    toltReklamot("ad2", "8e146b349def58eb449e117d7fee4221"); // 728x90
    toltReklamot("ad3", "29a246baa8f6ee357125520269d2d34d"); // 320x50
  } else {
    // 📱 Mobil – reklámok elrejtése
    const footer = document.getElementById("bottom-ads");
    if (footer) footer.style.display = "none";
  }