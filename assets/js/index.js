function getUserLocation() {
  if (navigator.geolocation) {
    // suucessful function ie if the user allows loactaion
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log(position.coords);

        const myCoords = position.coords;

        getTemperatureByLocation(myCoords.latitude, myCoords.longitude);
      },
      // error callback if the user denies location, you will then have to make use of the ip address to  get weather condition

      (error) => {
        console.log(error);
        getUserIPAddress();
      }
    );

    // if naviagtor.geolocation.getcurrentposition is not supported by the browser Use the user ip address
  } else {
    console.error("Geolocation is not supportted by this browser.");
    getUserIPAddress();
  }
}
getUserLocation();

function getTemperatureByLocation(latitude, longitude) {
  const appId = "96d0d50c9d416b7b9f249d42b9bae6e5";
  const url = "https://api.openweathermap.org/data/2.5/weather";

  axios({
    method: "get",
    url,
    params: {
      lat: latitude,
      lon: longitude,
      appid: appId,
      units: "metric", //  get value in deg celcius
    },
  })
    .then((value) => {
      console.log(value);
      if (value) {
        mySpinner();
        displayTemperature(value.data);
      }
    })

    .catch((error) => console.log(error));
}
function getUserIPAddress() {
  axios({
    url: "https://ipinfo.io",
    method: "get",
    params: {
      token: "8ff70be1bd282d",
    },
  })
    .then((value) => {
      console.log(value);
      const location = value.data.loc;

      const latAndLong = location.split(",");
      getTemperatureByLocation(latAndLong[0], latAndLong[1]);
    })

    .catch((error) => console.log(error));
}

function displayTemperature(tempDetails) {
  const weatherIcon = document.querySelector(".weather-icon i");
  const city = document.querySelector(".city-name");
  const country = document.querySelector(".country");
  const desc = document.querySelector(".description-of-weather");
  const temperature = document.querySelector(".temp-data");

  const tempDescription = tempDetails.weather[0].description;
  const weatherImage = tempDetails.weather[0].icon;
  // console.log(weatherImage)
  const isDay = weatherImage.includes("d"); //conatains a bbolean true if the letter d is containe

  city.textContent = `${tempDetails.name},`;
  country.textContent = tempDetails.sys.country;
  desc.textContent = tempDescription;
  desc.style.textTransform = "capitalize";
  temperature.textContent = Math.round(tempDetails.main.temp);

  switch (tempDescription) {
    case "clear sky":
      if (isDay) {
        weatherIcon.classList.add("wi-day-sunny");
      } else {
        weatherIcon.classList.add("wi-night-clear");
      }

      break;
    case "few clouds":
      if (isDay) {
        weatherIcon.classList.add("wi-day-cloudy");
      } else {
        weatherIcon.classList.add("wi-night-alt-cloudy");
      }
      break;
    case "scattered clouds":
      weatherIcon.classList.add("wi-cloud");
      break;
    case "broken clouds":
    case "overcast clouds":
      weatherIcon.classList.add("wi-cloudy");
      break;

    case "light rain":
    case "very heavy rain":
    case "extreme rain":
    case "moderate rain":
      if (isDay) {
        weatherIcon.classList.add("wi-day-showers");
      } else {
        weatherIcon.classList.add("wi-night-alt-showers");
      }
      break;

    case "shower rain":
      weatherIcon.classList.add("wi-showers");
      break;

    case "thunderstorm":
    case "heavy thunderstorm":
      if (isDay) {
        weatherIcon.classList.add("wi-day-lightning");
      } else {
        weatherIcon.classList.add("wi-night-alt-lightning");
      }
      break;

    case "thunderstorm with light rain":
    case "thunderstorm with rain":
    case "thunderstorm with heavy rain":
      weatherIcon.classList.add("wi-storm-showers");
      break;

    default:
      break;
  }
}

function convertCelsiusToFarenheit() {
  let initialDegreeCelcius = "";

  document
    .querySelector(".description-wrap-2 .temp-unit")
    .addEventListener("click", (event) => {
      const tempData = document.querySelector(".temp-data");
      const degCelsius = parseInt(tempData.textContent);

      event.target.classList.toggle("temp-convert");

      if (event.target.classList.contains("temp-convert")) {
        event.target.textContent = "F";
        const fahrenheitresult = Math.round((degCelsius * 9) / 5 + 32);
        initialDegreeCelcius = tempData.textContent;
        tempData.textContent = fahrenheitresult;
      } else {
        event.target.textContent = "C";
        tempData.textContent = initialDegreeCelcius;
      }
    });
}
convertCelsiusToFarenheit();

function mySpinner() {
  document.querySelector(".spinner-grow").style.display = "none";
  document.querySelector(".weather-content-wrap").style.display = "block";
}
